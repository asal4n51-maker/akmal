/**
 * HACHI NET WARNASARI — Backend Express & Bridge API (MikroTik + OLT + Shared DB)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { RouterOSAPI } = require('node-routeros');
const { Telnet } = require('telnet-client');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const API_KEY = (process.env.API_KEY || '').trim();
const DB_FILE = path.join(__dirname, 'data', 'shared-db.json');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
const FRONTEND_PUBLIC = path.join(__dirname, '..', 'frontend');

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = { updatedAt: new Date().toISOString(), state: null };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (err) {
    console.error('Gagal membaca database:', err.message);
    return { updatedAt: new Date().toISOString(), state: null };
  }
}

function writeDb(payload) {
  const doc = {
    updatedAt: new Date().toISOString(),
    state: payload
  };
  fs.writeFileSync(DB_FILE, JSON.stringify(doc, null, 2), 'utf8');
  return doc;
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error('Origin tidak diizinkan oleh CORS'));
    }
  })
);
app.use(express.json({ limit: '5mb' }));

function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      ok: false,
      message: 'API_KEY belum diatur di file .env backend.'
    });
  }
  const provided = String(req.headers['x-api-key'] || req.body?.apiKey || '').trim();
  if (!provided || provided !== API_KEY) {
    return res.status(401).json({
      ok: false,
      message: 'Akses ditolak: API Key tidak valid atau belum dikirim.'
    });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'hachinet-backend', uptime: process.uptime() });
});

app.use('/api', requireApiKey);

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
} else if (fs.existsSync(path.join(FRONTEND_PUBLIC, 'index.html'))) {
  app.use(express.static(FRONTEND_PUBLIC));
}

app.get('/api/state', (req, res) => {
  const db = readDb();
  res.json({ ok: true, data: db });
});

app.post('/api/state', (req, res) => {
  const incoming = req.body?.sharedState;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ ok: false, message: 'Payload sharedState tidak valid.' });
  }
  const saved = writeDb(incoming);
  res.json({ ok: true, data: saved });
});

function resolveConfig(clientCfg = {}) {
  return {
    mtkHost: clientCfg.mtkHost || process.env.MTK_HOST || '',
    mtkPort: Number(clientCfg.mtkPort || process.env.MTK_PORT || 8728),
    mtkUser: clientCfg.mtkUser || process.env.MTK_USER || 'admin',
    mtkPass: clientCfg.mtkPass || process.env.MTK_PASS || '',
    oltVendor: clientCfg.oltVendor || process.env.OLT_VENDOR || 'hioso',
    oltHost: clientCfg.oltHost || process.env.OLT_HOST || '',
    oltPort: Number(clientCfg.oltPort || process.env.OLT_PORT || 23),
    oltUser: clientCfg.oltUser || process.env.OLT_USER || 'admin',
    oltPass: clientCfg.oltPass || process.env.OLT_PASS || ''
  };
}

async function getMikrotik(cfg) {
  if (!cfg.mtkHost) throw new Error('Host / IP MikroTik belum diisi.');
  const api = new RouterOSAPI({
    host: cfg.mtkHost,
    user: cfg.mtkUser,
    password: cfg.mtkPass,
    port: cfg.mtkPort,
    timeout: 6000
  });
  await api.connect();
  return api;
}

async function runOltCommands(cfg, commands) {
  if (!cfg.oltHost) return 'OLT Host tidak diisi';
  const conn = new Telnet();
  await conn.connect({
    host: cfg.oltHost,
    port: cfg.oltPort,
    shellPrompt: /#|>/,
    loginPrompt: /Username:|login:/i,
    passwordPrompt: /Password:/i,
    username: cfg.oltUser,
    password: cfg.oltPass,
    timeout: 6000
  });
  let out = '';
  for (const cmd of commands) {
    out += (await conn.exec(cmd)) + '\n';
  }
  await conn.end();
  return out;
}

app.post('/api/connect', async (req, res) => {
  const cfg = resolveConfig(req.body?.config);
  try {
    const api = await getMikrotik(cfg);
    const [idRes] = await api.write('/system/identity/print');
    const [sysRes] = await api.write('/system/resource/print');
    const secrets = await api.write('/ppp/secret/print');
    const active = await api.write('/ppp/active/print');
    await api.close();

    res.json({
      ok: true,
      data: {
        identity: idRes?.name || 'MikroTik',
        version: sysRes?.version || '-',
        uptime: sysRes?.uptime || '-',
        cpuLoad: sysRes?.['cpu-load'] || 0,
        pppActive: active.length,
        pppSecret: secrets.length,
        oltStatus: cfg.oltHost ? `${cfg.oltVendor.toUpperCase()} (${cfg.oltHost})` : 'Belum diisi'
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/sync', async (req, res) => {
  const cfg = resolveConfig(req.body?.config);
  try {
    const api = await getMikrotik(cfg);
    const secrets = await api.write('/ppp/secret/print');
    const active = await api.write('/ppp/active/print');
    const [sysRes] = await api.write('/system/resource/print');
    await api.close();

    const activeMap = {};
    active.forEach((a) => {
      activeMap[a.name] = a;
    });

    const customers = secrets.map((s, i) => {
      const act = activeMap[s.name];
      const isIsolir = (s.profile || '').toLowerCase().includes('isolir');
      return {
        id: 'HCN-' + (2000 + i),
        name: s.comment || s.name,
        phone: '081200000000',
        addr: 'Warnasari',
        lat: '-6.6245',
        lng: '106.8040',
        odpName: 'ODP-WNS-01',
        odpPort: 'Port ' + ((i % 8) + 1),
        odcName: 'ODC-WNS-01',
        pppoeUser: s.name,
        pppoeSecret: s.password || '***',
        pppoeProfile: s.profile || 'Profile-20Mbps',
        modemIp: act ? act.address : '-',
        modemSn: s['caller-id'] || '-',
        ponPort: 'EPON0/1:' + (i + 1),
        rxDbm: act ? '-19.0 dBm' : 'LOS',
        ontTemp: act ? '41°C' : '-',
        pkg: (s.profile || '').includes('50')
          ? '50 Mbps'
          : (s.profile || '').includes('30')
            ? '30 Mbps'
            : (s.profile || '').includes('10')
              ? '10 Mbps'
              : '20 Mbps',
        price: 'Rp 150.000',
        status: isIsolir ? 'Isolir' : act ? 'Aktif' : 'Offline'
      };
    });

    res.json({
      ok: true,
      data: {
        customers,
        pppActive: active.length,
        pppSecret: secrets.length,
        cpuLoad: sysRes?.['cpu-load'] || 0
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/change-package', async (req, res) => {
  const cfg = resolveConfig(req.body?.config);
  const { pppoeUser, newProfile } = req.body;
  try {
    const api = await getMikrotik(cfg);
    const secrets = await api.write('/ppp/secret/print', [`?name=${pppoeUser}`]);
    if (secrets.length > 0) {
      await api.write('/ppp/secret/set', [`=.id=${secrets[0]['.id']}`, `=profile=${newProfile}`]);
    }
    const actives = await api.write('/ppp/active/print', [`?name=${pppoeUser}`]);
    if (actives.length > 0) {
      await api.write('/ppp/active/remove', [`=.id=${actives[0]['.id']}`]);
    }
    await api.close();
    res.json({ ok: true, data: { message: `Profile ${pppoeUser} diubah ke ${newProfile}` } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/provision', async (req, res) => {
  const cfg = resolveConfig(req.body?.config);
  const { customer } = req.body;
  try {
    const api = await getMikrotik(cfg);
    await api.write('/ppp/secret/add', [
      `=name=${customer.pppoeUser}`,
      `=password=${customer.pppoeSecret}`,
      '=service=pppoe',
      `=profile=${customer.pppoeProfile}`,
      `=comment=${customer.name}`
    ]);
    await api.close();

    if (cfg.oltHost && cfg.oltVendor === 'zte') {
      await runOltCommands(cfg, [
        'configure terminal',
        `interface gpon-olt_${customer.ponPort.split(':')[0]}`,
        `onu ${customer.ponPort.split(':')[1] || 1} type ZTE-F609 sn ${customer.modemSn}`,
        'exit',
        'write'
      ]);
    }

    res.json({ ok: true, data: { message: 'Provisioning selesai' } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.post('/api/action', async (req, res) => {
  const cfg = resolveConfig(req.body?.config);
  const { action, customer } = req.body;
  try {
    const api = await getMikrotik(cfg);
    if (action === 'Isolir') {
      const secrets = await api.write('/ppp/secret/print', [`?name=${customer.pppoeUser}`]);
      if (secrets.length > 0) {
        await api.write('/ppp/secret/set', [`=.id=${secrets[0]['.id']}`, `=profile=${customer.pppoeProfile}`]);
      }
      const actives = await api.write('/ppp/active/print', [`?name=${customer.pppoeUser}`]);
      if (actives.length > 0) {
        await api.write('/ppp/active/remove', [`=.id=${actives[0]['.id']}`]);
      }
    }
    await api.close();

    if (action === 'Reboot' && cfg.oltHost) {
      await runOltCommands(cfg, [
        'configure terminal',
        `pon-onu-mng gpon-onu_${customer.ponPort}`,
        'reboot',
        'yes',
        'end'
      ]);
    }

    res.json({ ok: true, data: { message: `Aksi ${action} selesai` } });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HachiNet Backend aktif di http://0.0.0.0:${PORT}`);
});
