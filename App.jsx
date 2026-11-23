import React, { useState, useEffect, useCallback } from 'react';

const DEFAULT_PACKAGES = [
  { name: '10 Mbps', price: 110000, label: '10 Mbps — Rp 110.000', profile: 'Profile-10Mbps', active: true },
  { name: '20 Mbps', price: 150000, label: '20 Mbps — Rp 150.000', profile: 'Profile-20Mbps', active: true },
  { name: '30 Mbps', price: 200000, label: '30 Mbps — Rp 200.000', profile: 'Profile-30Mbps', active: true },
  { name: '50 Mbps', price: 300000, label: '50 Mbps — Rp 300.000', profile: 'Profile-50Mbps', active: true }
];

const MENUS = [
  { key: 'dashboard', label: '📊 Dashboard' },
  { key: 'register', label: '📝 Register' },
  { key: 'activation', label: '⚡ Aktivasi' },
  { key: 'customers', label: '👥 Data Pelanggan' },
  { key: 'ubah-paket', label: '📦 Ubah Paket' },
  { key: 'kelola-paket', label: '📶 Kelola Paket' },
  { key: 'billing', label: '💳 Billing' },
  { key: 'tickets', label: '🎫 Tiket' },
  { key: 'history', label: '🕒 Riwayat' },
  { key: 'distributor', label: '🔀 Distribusi ODC/ODP' },
  { key: 'network', label: '🌐 Network & OLT' },
  { key: 'reminder', label: '📲 Reminder WA' },
  { key: 'developer', label: '🛠️ Developer (RBAC)' }
];

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

function normalizeWa(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('0') ? '62' + digits.slice(1) : digits;
}

function formatPackageLabel(pkg) {
  const priceNum = Number(pkg.price) || 0;
  return `${pkg.name} — Rp ${priceNum.toLocaleString('id-ID')}`;
}

function getPkgObj(pkgName, pkgList = DEFAULT_PACKAGES) {
  const list = Array.isArray(pkgList) && pkgList.length > 0 ? pkgList : DEFAULT_PACKAGES;
  return list.find((p) => p.name === pkgName) || list[0];
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginUser, setLoginUser] = useState('admin');
  const [loginPass, setLoginPass] = useState('admin');
  const [loginError, setLoginError] = useState('');

  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [toast, setToast] = useState('');

  const [user, setUser] = useState({ username: 'admin', name: 'HachiNet Root Dev', role: 'Dev' });
  const [rootAuth, setRootAuth] = useState(() =>
    loadLocal('hn_react_root', { username: 'admin', password: 'admin', name: 'HachiNet Root Dev', role: 'Dev' })
  );
  const [accounts, setAccounts] = useState(() => loadLocal('hn_react_accounts', []));

  const [packages, setPackages] = useState(() => loadLocal('hn_react_packages', DEFAULT_PACKAGES));

  const [customers, setCustomers] = useState(() =>
    loadLocal('hn_react_customers', [
      {
        id: 'HCN-1001',
        name: 'Dole',
        phone: '081234567890',
        addr: 'Kp. Warnasari RT 02/09',
        odpName: 'ODP-WNS-01',
        odpPort: 'Port 1',
        pppoeUser: 'dole@hachinet',
        pppoeSecret: '123456',
        pppoeProfile: 'Profile-20Mbps',
        modemIp: '192.168.10.11',
        modemSn: 'ZTEGC7129A01',
        ponPort: 'EPON0/1:1',
        pkg: '20 Mbps',
        price: 'Rp 150.000',
        status: 'Aktif'
      }
    ])
  );

  const [activationQueue, setActivationQueue] = useState(() => loadLocal('hn_react_queue', []));
  const [billing, setBilling] = useState(() =>
    loadLocal('hn_react_billing', [
      { id: 'INV-1001', customerId: 'HCN-1001', customerName: 'Dole', phone: '081234567890', pkg: '20 Mbps', amount: 150000, status: 'Belum Lunas' }
    ])
  );
  const [tickets, setTickets] = useState(() => loadLocal('hn_react_tickets', []));
  const [history, setHistory] = useState(() =>
    loadLocal('hn_react_history', [{ id: 'HIS-1', time: '08:00:00', category: 'Sistem', detail: 'HachiNet App.jsx siap digunakan.' }])
  );
  const [odcList, setOdcList] = useState(() =>
    loadLocal('hn_react_odc', [{ id: 'ODC-WNS-01', name: 'ODC-WNS-01', coord: '-6.6235, 106.8025', area: 'Warnasari' }])
  );
  const [odpList, setOdpList] = useState(() =>
    loadLocal('hn_react_odp', [{ id: 'ODP-WNS-01', odcId: 'ODC-WNS-01', name: 'ODP-WNS-01', coord: '-6.6240, 106.8031', splitter: '1:8' }])
  );
  const [reminders, setReminders] = useState(() =>
    loadLocal('hn_react_reminders', [
      { id: 'REM-1', name: 'Akmal', phone: '088212935747', day: 10, note: 'Reminder bulanan' },
      { id: 'REM-2', name: 'Nurafiansyah', phone: '6289627244450', day: 15, note: 'Reminder bulanan' }
    ])
  );

  const [bridgeCfg, setBridgeCfg] = useState(() =>
    loadLocal('hn_react_bridge', {
      connected: false,
      backendUrl: 'http://localhost:3001',
      apiKey: '',
      isolirProfile: 'Profile-ISOLIR',
      mtkHost: '',
      mtkPort: '8728',
      mtkUser: 'admin',
      mtkPass: '',
      oltVendor: 'hioso',
      oltHost: '',
      oltPort: '23',
      oltUser: 'admin',
      oltPass: ''
    })
  );

  const [liveStats, setLiveStats] = useState({
    identity: '-',
    version: '-',
    uptime: '-',
    cpuLoad: 0,
    pppActive: 0,
    pppSecret: 0,
    logs: ['[Backend] Atur Backend URL & API Key, lalu klik Tes & Hubungkan.']
  });

  // Form states
  const [regForm, setRegForm] = useState({
    name: '',
    phone: '',
    addr: '',
    odpName: 'ODP-WNS-01',
    odpPort: 'Port 2',
    pkg: '20 Mbps',
    ip: '192.168.10.25',
    pppoe: '',
    sn: ''
  });
  const [selectedPkgCust, setSelectedPkgCust] = useState('HCN-1001');
  const [newPkgName, setNewPkgName] = useState('30 Mbps');

  // State form tambah / ubah paket internet
  const [editingPkgOriginalName, setEditingPkgOriginalName] = useState('');
  const [pkgForm, setPkgForm] = useState({
    name: '',
    price: '',
    profile: '',
    active: true
  });

  const [credForm, setCredForm] = useState({ username: 'admin', password: '', confirm: '' });
  const [accForm, setAccForm] = useState({ name: '', username: '', password: '', role: 'Admin' });

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  }, []);

  const addLog = useCallback((category, detail) => {
    const item = { id: 'HIS-' + Date.now(), time: new Date().toLocaleTimeString('id-ID'), category, detail };
    setHistory((prev) => {
      const next = [item, ...prev];
      saveLocal('hn_react_history', next);
      return next;
    });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    saveLocal('hn_react_packages', packages);
    saveLocal('hn_react_customers', customers);
    saveLocal('hn_react_queue', activationQueue);
    saveLocal('hn_react_billing', billing);
    saveLocal('hn_react_tickets', tickets);
    saveLocal('hn_react_odc', odcList);
    saveLocal('hn_react_odp', odpList);
    saveLocal('hn_react_reminders', reminders);
    saveLocal('hn_react_bridge', bridgeCfg);
    saveLocal('hn_react_accounts', accounts);
    saveLocal('hn_react_root', rootAuth);
  }, [packages, customers, activationQueue, billing, tickets, odcList, odpList, reminders, bridgeCfg, accounts, rootAuth]);

  const activePackages = packages.filter((p) => p.active !== false);
  const selectablePackages = activePackages.length > 0 ? activePackages : packages;

  useEffect(() => {
    if (selectablePackages.length > 0 && !selectablePackages.some((p) => p.name === newPkgName)) {
      setNewPkgName(selectablePackages[0].name);
    }
    if (selectablePackages.length > 0 && !selectablePackages.some((p) => p.name === regForm.pkg)) {
      setRegForm((prev) => ({ ...prev, pkg: selectablePackages[0].name }));
    }
  }, [packages]);

  async function callBackend(endpoint, payload = {}, method = 'POST') {
    const base = (bridgeCfg.backendUrl || 'http://localhost:3001').trim().replace(/\/+$/, '');
    const headers = { 'Content-Type': 'application/json' };
    if (bridgeCfg.apiKey) headers['x-api-key'] = bridgeCfg.apiKey.trim();
    const opts = { method, headers };
    if (method !== 'GET') opts.body = JSON.stringify({ ...payload, config: bridgeCfg });
    const res = await fetch(`${base}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok || data.ok === false) throw new Error(data.message || `HTTP ${res.status}`);
    return data.data;
  }

  async function syncStateFromBackend() {
    try {
      const res = await callBackend('/api/state', {}, 'GET');
      const s = res?.state;
      if (!s) return;
      if (Array.isArray(s.packages) && s.packages.length) setPackages(s.packages);
      if (Array.isArray(s.customers)) setCustomers(s.customers);
      if (Array.isArray(s.activationQueue)) setActivationQueue(s.activationQueue);
      if (Array.isArray(s.billing)) setBilling(s.billing);
      if (Array.isArray(s.tickets)) setTickets(s.tickets);
      if (Array.isArray(s.history)) setHistory(s.history);
      if (Array.isArray(s.odcList)) setOdcList(s.odcList);
      if (Array.isArray(s.odpList)) setOdpList(s.odpList);
      if (Array.isArray(s.reminders)) setReminders(s.reminders);
      addLog('Sync DB', 'Data tersinkronisasi dari database backend.');
    } catch {}
  }

  async function pushStateToBackend(override = {}) {
    if (!bridgeCfg.connected) return;
    try {
      await callBackend('/api/state', {
        sharedState: {
          packages,
          customers,
          activationQueue,
          billing,
          tickets,
          history,
          odcList,
          odpList,
          reminders,
          ...override
        }
      });
    } catch {}
  }

  function handleLoginSubmit(e) {
    e.preventDefault();
    const u = loginUser.trim();
    const p = loginPass.trim();
    if (u.toLowerCase() === rootAuth.username.toLowerCase() && p === rootAuth.password) {
      setLoggedIn(true);
      setUser({ username: rootAuth.username, name: rootAuth.name, role: 'Dev' });
      setLoginError('');
      addLog('Login', `Masuk sebagai ${rootAuth.name} (Dev)`);
      syncStateFromBackend();
      return;
    }
    const found = accounts.find((a) => a.username.toLowerCase() === u.toLowerCase() && a.password === p);
    if (found) {
      setLoggedIn(true);
      setUser(found);
      setLoginError('');
      addLog('Login', `Masuk sebagai ${found.name} (${found.role})`);
      syncStateFromBackend();
      return;
    }
    setLoginError('Username atau password salah. Default Dev: admin / admin');
  }

  async function testConnect() {
    try {
      const data = await callBackend('/api/connect');
      setBridgeCfg((prev) => ({ ...prev, connected: true }));
      setLiveStats((prev) => ({
        ...prev,
        identity: data.identity || 'MikroTik',
        version: data.version || '-',
        uptime: data.uptime || '-',
        cpuLoad: data.cpuLoad || 0,
        pppActive: data.pppActive || 0,
        pppSecret: data.pppSecret || 0,
        logs: [`[${new Date().toLocaleTimeString('id-ID')}] Terhubung ke ${data.identity} (${data.version})`, ...prev.logs]
      }));
      addLog('Koneksi', `Terhubung ke backend & MikroTik (${data.identity})`);
      notify('Koneksi backend & MikroTik berhasil!');
      pushStateToBackend();
    } catch (err) {
      setBridgeCfg((prev) => ({ ...prev, connected: false }));
      setLiveStats((prev) => ({
        ...prev,
        logs: [`[${new Date().toLocaleTimeString('id-ID')}] Gagal konek: ${err.message}`, ...prev.logs]
      }));
      notify(`Gagal konek: ${err.message}`);
    }
  }

  function handleSavePackage(e) {
    e.preventDefault();
    const cleanName = pkgForm.name.trim();
    const priceNum = Number(String(pkgForm.price).replace(/\D/g, ''));
    if (!cleanName) {
      return notify('Nama paket internet wajib diisi.');
    }
    if (!priceNum || priceNum <= 0) {
      return notify('Harga paket bulanan harus lebih dari Rp 0.');
    }

    const slug = cleanName.replace(/\s+/g, '');
    const cleanProfile = (pkgForm.profile || `Profile-${slug}`).trim();
    const newItem = {
      name: cleanName,
      price: priceNum,
      label: formatPackageLabel({ name: cleanName, price: priceNum }),
      profile: cleanProfile,
      active: Boolean(pkgForm.active)
    };

    let updatedList = [];
    if (editingPkgOriginalName) {
      updatedList = packages.map((p) => (p.name === editingPkgOriginalName ? newItem : p));
      setCustomers((prev) =>
        prev.map((c) =>
          c.pkg === editingPkgOriginalName
            ? {
                ...c,
                pkg: newItem.name,
                price: `Rp ${newItem.price.toLocaleString('id-ID')}`,
                pppoeProfile: newItem.profile
              }
            : c
        )
      );
      setBilling((prev) =>
        prev.map((b) =>
          b.pkg === editingPkgOriginalName && b.status !== 'Lunas'
            ? { ...b, pkg: newItem.name, amount: newItem.price }
            : b
        )
      );
      addLog('Ubah Paket', `Paket "${editingPkgOriginalName}" diperbarui menjadi "${newItem.name}" (Rp ${newItem.price.toLocaleString('id-ID')}).`);
      notify(`Paket "${newItem.name}" berhasil diperbarui!`);
    } else {
      const exists = packages.some((p) => p.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        return notify(`Paket "${cleanName}" sudah ada. Klik Edit untuk mengubahnya.`);
      }
      updatedList = [...packages, newItem];
      addLog('Tambah Paket', `Paket baru "${newItem.name}" (Rp ${newItem.price.toLocaleString('id-ID')}) ditambahkan.`);
      notify(`Paket baru "${newItem.name}" ditambahkan!`);
    }

    setPackages(updatedList);
    setEditingPkgOriginalName('');
    setPkgForm({ name: '', price: '', profile: '', active: true });
    pushStateToBackend({ packages: updatedList });
  }

  function handleEditPackageClick(pkg) {
    setEditingPkgOriginalName(pkg.name);
    setPkgForm({
      name: pkg.name,
      price: String(pkg.price || ''),
      profile: pkg.profile || `Profile-${pkg.name.replace(/\s+/g, '')}`,
      active: pkg.active !== false
    });
  }

  function handleTogglePackageActive(pkgName) {
    const updatedList = packages.map((p) =>
      p.name === pkgName ? { ...p, active: p.active === false ? true : false } : p
    );
    setPackages(updatedList);
    addLog('Status Paket', `Status aktif paket "${pkgName}" diubah.`);
    notify(`Status paket "${pkgName}" diperbarui.`);
    pushStateToBackend({ packages: updatedList });
  }

  function handleDeletePackage(pkgName) {
    if (packages.length <= 1) {
      return notify('Minimal harus ada 1 paket internet tersisa.');
    }
    const updatedList = packages.filter((p) => p.name !== pkgName);
    setPackages(updatedList);
    if (editingPkgOriginalName === pkgName) {
      setEditingPkgOriginalName('');
      setPkgForm({ name: '', price: '', profile: '', active: true });
    }
    addLog('Hapus Paket', `Paket "${pkgName}" dihapus dari daftar.`);
    notify(`Paket "${pkgName}" dihapus.`);
    pushStateToBackend({ packages: updatedList });
  }

  async function handleChangePackage(custId, targetPkg) {
    const pkgObj = getPkgObj(targetPkg, packages);
    let targetCustomer = null;

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id !== custId) return c;
        targetCustomer = {
          ...c,
          pkg: pkgObj.name,
          price: `Rp ${pkgObj.price.toLocaleString('id-ID')}`,
          pppoeProfile: pkgObj.profile
        };
        return targetCustomer;
      })
    );

    setBilling((prev) =>
      prev.map((b) => (b.customerId === custId && b.status !== 'Lunas' ? { ...b, pkg: pkgObj.name, amount: pkgObj.price } : b))
    );

    if (bridgeCfg.connected && targetCustomer) {
      try {
        await callBackend('/api/change-package', {
          pppoeUser: targetCustomer.pppoeUser,
          newProfile: pkgObj.profile
        });
      } catch (err) {
        notify(`Tersimpan lokal, gagal sync MikroTik: ${err.message}`);
      }
    }

    addLog('Ubah Paket', `Pelanggan ${custId} diubah ke paket ${pkgObj.name} (${pkgObj.profile})`);
    pushStateToBackend();
    notify(`Paket diubah ke ${pkgObj.name}`);
  }

  function handleRegisterSubmit(e) {
    e.preventDefault();
    const defaultPkg = selectablePackages[0]?.name || '20 Mbps';
    const item = {
      id: 'ACT-' + Date.now().toString().slice(-4),
      ...regForm,
      pkg: regForm.pkg || defaultPkg,
      sn: regForm.sn.toUpperCase()
    };
    setActivationQueue((prev) => [item, ...prev]);
    addLog('Register', `${item.name} (${item.pkg}) masuk antrean aktivasi.`);
    setRegForm({ name: '', phone: '', addr: '', odpName: 'ODP-WNS-01', odpPort: 'Port 2', pkg: defaultPkg, ip: '192.168.10.25', pppoe: '', sn: '' });
    setPage('activation');
    notify(`${item.name} masuk ke antrean Aktivasi.`);
  }

  async function activateQueueItem(item) {
    const pkgObj = getPkgObj(item.pkg, packages);
    const custId = 'HCN-' + Date.now().toString().slice(-4);
    const newCust = {
      id: custId,
      name: item.name,
      phone: item.phone,
      addr: item.addr,
      odpName: item.odpName,
      odpPort: item.odpPort,
      pppoeUser: item.pppoe,
      pppoeSecret: '123456',
      pppoeProfile: pkgObj.profile,
      modemIp: item.ip,
      modemSn: item.sn,
      ponPort: 'EPON0/1:1',
      pkg: pkgObj.name,
      price: `Rp ${pkgObj.price.toLocaleString('id-ID')}`,
      status: 'Aktif'
    };

    if (bridgeCfg.connected) {
      try {
        await callBackend('/api/provision', { customer: newCust });
      } catch (err) {
        notify(`Aktif lokal, gagal push perangkat: ${err.message}`);
      }
    }

    setCustomers((prev) => [newCust, ...prev]);
    setBilling((prev) => [
      { id: 'INV-' + Date.now().toString().slice(-4), customerId: custId, customerName: newCust.name, phone: newCust.phone, pkg: newCust.pkg, amount: pkgObj.price, status: 'Belum Lunas' },
      ...prev
    ]);
    setActivationQueue((prev) => prev.filter((x) => x.id !== item.id));
    addLog('Aktivasi', `${newCust.name} (${newCust.pppoeUser}) diaktifkan.`);
    setPage('customers');
    notify(`${newCust.name} berhasil diaktifkan!`);
  }

  function handleCredentialUpdate(e) {
    e.preventDefault();
    if (!credForm.username.trim() || credForm.password.length < 4) {
      return notify('Username wajib diisi & password minimal 4 karakter.');
    }
    if (credForm.password !== credForm.confirm) {
      return notify('Konfirmasi password tidak cocok.');
    }
    const updatedRoot = { ...rootAuth, username: credForm.username.trim(), password: credForm.password };
    setRootAuth(updatedRoot);
    setUser((prev) => ({ ...prev, username: updatedRoot.username }));
    setCredForm({ username: updatedRoot.username, password: '', confirm: '' });
    addLog('Keamanan', `Kredensial root diperbarui (${updatedRoot.username})`);
    notify('Username & password Dev berhasil disimpan!');
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form onSubmit={handleLoginSubmit} className="card w-full max-w-sm p-6 space-y-4">
          <div>
            <div className="text-xs font-black tracking-wider uppercase text-amber-400">HACHI NET WARNASARI</div>
            <h1 className="text-xl font-black mt-1">Login Portal HachiNet</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Default Dev: <span className="font-mono">admin</span> / <span className="font-mono">admin</span>
            </p>
          </div>
          {loginError && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl">{loginError}</div>}
          <input className="input-field" placeholder="Username" value={loginUser} onChange={(e) => setLoginUser(e.target.value)} required />
          <input type="password" className="input-field" placeholder="Password" value={loginPass} onChange={(e) => setLoginPass(e.target.value)} required />
          <button type="submit" className="btn btn-primary w-full py-2.5">Masuk ke Dashboard</button>
        </form>
      </div>
    );
  }

  const totalOmzet = billing.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r p-3 space-y-1" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
        <div className="px-2 py-2 flex items-center justify-between">
          <div>
            <div className="font-black text-base">HachiNet</div>
            <div className="text-[10px] font-bold text-amber-400">HACHI NET WARNASARI</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-400">{user.role}</span>
        </div>
        {MENUS.map((m) => (
          <button
            key={m.key}
            onClick={() => setPage(m.key)}
            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between"
            style={{
              background: page === m.key ? '#2563EB' : 'transparent',
              color: page === m.key ? '#FFFFFF' : 'var(--text-secondary)'
            }}
          >
            <span>{m.label}</span>
            {m.key === 'activation' && activationQueue.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">{activationQueue.length}</span>
            )}
            {m.key === 'kelola-paket' && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-400/20 text-emerald-300 font-black">{activePackages.length}</span>
            )}
          </button>
        ))}
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 px-4 border-b flex items-center justify-between gap-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
          <div className="text-xs font-bold truncate" style={{ color: 'var(--text-secondary)' }}>
            Login: <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong> ({user.role}) • Backend:{' '}
            <span className={bridgeCfg.connected ? 'text-emerald-400' : 'text-amber-400'}>
              {bridgeCfg.connected ? 'Terhubung' : 'Lokal / Belum Konek'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className="btn btn-ghost text-xs py-1.5 px-2.5">
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button onClick={() => setLoggedIn(false)} className="btn btn-danger text-xs py-1.5 px-2.5">
              Keluar
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 space-y-4 flex-1">
          {page === 'dashboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Pelanggan</div>
                <div className="text-2xl font-black mt-1">{customers.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Antrean Aktivasi</div>
                <div className="text-2xl font-black mt-1 text-amber-400">{activationQueue.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Paket Aktif</div>
                <div className="text-2xl font-black mt-1 text-emerald-400">{activePackages.length} / {packages.length}</div>
              </div>
              <div className="card p-4">
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Tagihan</div>
                <div className="text-2xl font-black mt-1 text-blue-400">Rp {totalOmzet.toLocaleString('id-ID')}</div>
              </div>
            </div>
          )}

          {page === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="card p-5 space-y-3 max-w-2xl">
              <h2 className="font-black text-base">Registrasi Pelanggan Baru</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input className="input-field" placeholder="Nama Lengkap" value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} required />
                <input className="input-field" placeholder="No. WhatsApp (08...)" value={regForm.phone} onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })} required />
                <input className="input-field" placeholder="Alamat (Kp. Warnasari...)" value={regForm.addr} onChange={(e) => setRegForm({ ...regForm, addr: e.target.value })} required />
                <select className="select-field" value={regForm.pkg} onChange={(e) => setRegForm({ ...regForm, pkg: e.target.value })}>
                  {selectablePackages.map((p) => (
                    <option key={p.name} value={p.name}>
                      {formatPackageLabel(p)}{p.active === false ? ' (Nonaktif)' : ''}
                    </option>
                  ))}
                </select>
                <input className="input-field" placeholder="Username PPPoE" value={regForm.pppoe} onChange={(e) => setRegForm({ ...regForm, pppoe: e.target.value })} required />
                <input className="input-field" placeholder="Serial Number ONU / Modem" value={regForm.sn} onChange={(e) => setRegForm({ ...regForm, sn: e.target.value })} required />
              </div>
              <button type="submit" className="btn btn-success">Kirim ke Antrean Aktivasi</button>
            </form>
          )}

          {page === 'activation' && (
            <div className="card p-4 space-y-3">
              <h2 className="font-black text-base">Antrean Aktivasi ({activationQueue.length})</h2>
              {activationQueue.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Belum ada antrean aktivasi.</p>
              ) : (
                activationQueue.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border-color)' }}>
                    <div>
                      <div className="font-bold text-sm">{item.name} <span className="text-xs font-mono text-amber-400">({item.pkg})</span></div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>PPPoE: {item.pppoe} • SN: {item.sn} • {item.addr}</div>
                    </div>
                    <button onClick={() => activateQueueItem(item)} className="btn btn-success text-xs">⚡ Aktifkan</button>
                  </div>
                ))
              )}
            </div>
          )}

          {page === 'customers' && (
            <div className="card p-4 overflow-x-auto">
              <h2 className="font-black text-base mb-3">Data Pelanggan ({customers.length})</h2>
              <table>
                <thead>
                  <tr><th>Nama</th><th>Paket</th><th>PPPoE & IP</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="font-bold">{c.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{c.id} • {c.addr}</div>
                      </td>
                      <td>
                        <div className="font-bold text-amber-400">{c.pkg}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{c.price}</div>
                      </td>
                      <td className="font-mono text-xs">{c.pppoeUser} / {c.modemIp}</td>
                      <td><span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400">{c.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {page === 'ubah-paket' && (
            <div className="card p-5 space-y-3 max-w-lg">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-base">📦 Ubah Paket Pelanggan</h2>
                <button type="button" onClick={() => setPage('kelola-paket')} className="btn btn-ghost text-xs py-1 px-2.5">
                  + Tambah / Edit Paket
                </button>
              </div>
              <select className="select-field" value={selectedPkgCust} onChange={(e) => setSelectedPkgCust(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — Aktif: {c.pkg}</option>
                ))}
              </select>
              <select className="select-field" value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)}>
                {selectablePackages.map((p) => (
                  <option key={p.name} value={p.name}>{formatPackageLabel(p)}</option>
                ))}
              </select>
              <button onClick={() => handleChangePackage(selectedPkgCust, newPkgName)} className="btn btn-primary w-full">
                Terapkan Paket Baru
              </button>
            </div>
          )}

          {page === 'kelola-paket' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <form onSubmit={handleSavePackage} className="card p-5 space-y-3 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-base">
                    {editingPkgOriginalName ? `✏️ Ubah Paket: ${editingPkgOriginalName}` : '➕ Tambah Paket Internet'}
                  </h2>
                  {editingPkgOriginalName && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPkgOriginalName('');
                        setPkgForm({ name: '', price: '', profile: '', active: true });
                      }}
                      className="btn btn-ghost text-xs py-1 px-2"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Nama Paket / Kecepatan
                  </label>
                  <input
                    className="input-field"
                    placeholder="Contoh: 40 Mbps atau Paket Hemat 15 Mbps"
                    value={pkgForm.name}
                    onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Tarif Bulanan (Rp)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    className="input-field"
                    placeholder="Contoh: 175000"
                    value={pkgForm.price}
                    onChange={(e) => setPkgForm({ ...pkgForm, price: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>
                    PPP Profile MikroTik (Opsional)
                  </label>
                  <input
                    className="input-field font-mono"
                    placeholder="Otomatis: Profile-<NamaPaket>"
                    value={pkgForm.profile}
                    onChange={(e) => setPkgForm({ ...pkgForm, profile: e.target.value })}
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={pkgForm.active}
                    onChange={(e) => setPkgForm({ ...pkgForm, active: e.target.checked })}
                  />
                  <span>Aktifkan paket untuk pendaftaran & ubah paket pelanggan</span>
                </label>

                <button type="submit" className="btn btn-success w-full">
                  {editingPkgOriginalName ? '💾 Simpan Perubahan Paket' : '➕ Tambah Paket Internet'}
                </button>
              </form>

              <div className="card p-4 overflow-x-auto lg:col-span-7">
                <h2 className="font-black text-base mb-3">Daftar Paket Internet ({packages.length})</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Paket</th>
                      <th>Tarif / Bulan</th>
                      <th>Profile PPPoE</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packages.map((p) => {
                      const isActive = p.active !== false;
                      return (
                        <tr key={p.name}>
                          <td className="font-bold text-amber-400">{p.name}</td>
                          <td className="font-mono text-xs">Rp {(Number(p.price) || 0).toLocaleString('id-ID')}</td>
                          <td className="font-mono text-xs">{p.profile || `Profile-${p.name.replace(/\s+/g, '')}`}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleTogglePackageActive(p.name)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
                              }`}
                            >
                              {isActive ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditPackageClick(p)}
                                className="btn btn-primary text-xs py-1 px-2.5"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePackage(p.name)}
                                className="btn btn-danger text-xs py-1 px-2.5"
                              >
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {page === 'billing' && (
            <div className="card p-4 overflow-x-auto">
              <h2 className="font-black text-base mb-3">Billing & Tagihan</h2>
              <table>
                <thead>
                  <tr><th>ID</th><th>Pelanggan</th><th>Paket</th><th>Nominal</th><th>Status</th><th>WA</th></tr>
                </thead>
                <tbody>
                  {billing.map((b) => (
                    <tr key={b.id}>
                      <td className="font-mono">{b.id}</td>
                      <td>{b.customerName}</td>
                      <td>{b.pkg}</td>
                      <td>Rp {Number(b.amount).toLocaleString('id-ID')}</td>
                      <td>{b.status}</td>
                      <td>
                        <button
                          onClick={() => window.open(`https://wa.me/${normalizeWa(b.phone)}?text=${encodeURIComponent(`Tagihan ${b.customerName}: Rp ${Number(b.amount).toLocaleString('id-ID')}`)}`, '_blank')}
                          className="btn btn-cyan text-xs py-1 px-2.5"
                        >
                          Kirim WA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {page === 'tickets' && (
            <div className="card p-4 space-y-2">
              <h2 className="font-black text-base">Tiket Gangguan</h2>
              <p className="text-xs text-slate-400">Total tiket tercatat: {tickets.length}</p>
            </div>
          )}

          {page === 'history' && (
            <div className="card p-4 space-y-2">
              <h2 className="font-black text-base">Riwayat Aktivitas</h2>
              {history.map((h) => (
                <div key={h.id} className="text-xs border-b py-2" style={{ borderColor: 'var(--border-color)' }}>
                  <span className="font-mono text-slate-400 mr-2">{h.time}</span>
                  <strong>[{h.category}]</strong> {h.detail}
                </div>
              ))}
            </div>
          )}

          {page === 'distributor' && (
            <div className="card p-4 space-y-2">
              <h2 className="font-black text-base">Distribusi ODC / ODP</h2>
              <p className="text-xs text-slate-400">ODC: {odcList.map((d) => d.name).join(', ')} | ODP: {odpList.map((o) => o.name).join(', ')}</p>
            </div>
          )}

          {page === 'network' && (
            <div className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-black text-base">Koneksi Backend, MikroTik & OLT</h2>
                <button onClick={testConnect} className="btn btn-success text-xs">🔌 Tes & Hubungkan</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input className="input-field" placeholder="Backend URL (http://localhost:3001)" value={bridgeCfg.backendUrl} onChange={(e) => setBridgeCfg({ ...bridgeCfg, backendUrl: e.target.value })} />
                <input type="password" className="input-field" placeholder="API Key Server (x-api-key)" value={bridgeCfg.apiKey} onChange={(e) => setBridgeCfg({ ...bridgeCfg, apiKey: e.target.value })} />
                <input className="input-field" placeholder="IP MikroTik" value={bridgeCfg.mtkHost} onChange={(e) => setBridgeCfg({ ...bridgeCfg, mtkHost: e.target.value })} />
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] h-32 overflow-y-auto">{liveStats.logs.join('\n')}</pre>
            </div>
          )}

          {page === 'reminder' && (
            <div className="card p-4 space-y-2">
              <h2 className="font-black text-base">Reminder WA Bulanan</h2>
              {reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <span><strong>{r.name}</strong> ({r.phone}) — Tgl {r.day}</span>
                  <button onClick={() => window.open(`https://wa.me/${normalizeWa(r.phone)}`, '_blank')} className="btn btn-success text-xs py-1 px-2.5">WA</button>
                </div>
              ))}
            </div>
          )}

          {page === 'developer' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <form onSubmit={handleCredentialUpdate} className="card p-4 space-y-2.5">
                <h2 className="font-black text-sm">🔐 Ganti Username & Password Dev</h2>
                <input className="input-field" placeholder="Username baru" value={credForm.username} onChange={(e) => setCredForm({ ...credForm, username: e.target.value })} required />
                <input type="password" className="input-field" placeholder="Password baru" value={credForm.password} onChange={(e) => setCredForm({ ...credForm, password: e.target.value })} required />
                <input type="password" className="input-field" placeholder="Konfirmasi password" value={credForm.confirm} onChange={(e) => setCredForm({ ...credForm, confirm: e.target.value })} required />
                <button type="submit" className="btn btn-warning w-full">Simpan Kredensial</button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setAccounts((prev) => [...prev, { id: 'ACC-' + Date.now(), ...accForm }]);
                  setAccForm({ name: '', username: '', password: '', role: 'Admin' });
                  notify('Akun staf ditambahkan.');
                }}
                className="card p-4 space-y-2.5"
              >
                <h2 className="font-black text-sm">👤 Tambah Akun Pengguna</h2>
                <input className="input-field" placeholder="Nama" value={accForm.name} onChange={(e) => setAccForm({ ...accForm, name: e.target.value })} required />
                <input className="input-field" placeholder="Username" value={accForm.username} onChange={(e) => setAccForm({ ...accForm, username: e.target.value })} required />
                <input type="password" className="input-field" placeholder="Password" value={accForm.password} onChange={(e) => setAccForm({ ...accForm, password: e.target.value })} required />
                <select className="select-field" value={accForm.role} onChange={(e) => setAccForm({ ...accForm, role: e.target.value })}>
                  <option value="Admin">Admin</option>
                  <option value="Teknisi">Teknisi</option>
                  <option value="Billing">Billing</option>
                </select>
                <button type="submit" className="btn btn-primary w-full">+ Buat Akun</button>
              </form>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-amber-400/40 text-white px-4 py-2.5 rounded-xl shadow-2xl text-xs font-bold">
          ✨ {toast}
        </div>
      )}
    </div>
  );
}
