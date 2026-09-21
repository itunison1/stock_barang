// WMS Stock Opname — Portal Supervisor/Admin. Vanilla JS, no build step.
// Semua data dari API PHP nyata (staging .140/stockopname_test). Tidak ada mock/dummy.
const API = '../api/';
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const c of children) n.append(c && c.nodeType ? c : document.createTextNode(c ?? ''));
  return n;
};

let state = {
  token: localStorage.getItem('wms_admin_token'),
  user: JSON.parse(localStorage.getItem('wms_admin_user') || 'null'),
  tab: 'proposals',
  proposals: [],
  exceptions: [],
  audit: [],
  loading: false,
};

function toast(msg, isErr = false) {
  const t = el('div', { class: 'toast' + (isErr ? ' err' : '') }, msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': state.token, ...(opts.headers || {}) },
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Respon server tidak valid.' }));
  if (res.status === 401) {
    logout();
    throw new Error(data.message || 'Sesi berakhir, silakan login ulang.');
  }
  if (!data.success) throw new Error(data.message || 'Terjadi kesalahan.');
  return data.data;
}

function logout() {
  localStorage.removeItem('wms_admin_token');
  localStorage.removeItem('wms_admin_user');
  state = { ...state, token: null, user: null };
  render();
}

async function doLogin(username, password) {
  const res = await fetch(API + 'login.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Login gagal.');
  if (![1, 2].includes(data.data.user_level)) {
    throw new Error('Akun ini bukan Admin/Supervisor. Portal ini khusus approval.');
  }
  state.token = data.data.token;
  state.user = data.data;
  localStorage.setItem('wms_admin_token', state.token);
  localStorage.setItem('wms_admin_user', JSON.stringify(state.user));
  await loadAll();
}

async function loadAll() {
  state.loading = true;
  render();
  try {
    const [proposals, exceptions, audit] = await Promise.all([
      api('proposal_queue.php?status=pending'),
      api('location_exception_queue.php'),
      api('audit_log.php?limit=100'),
    ]);
    state.proposals = proposals;
    state.exceptions = exceptions;
    state.audit = audit;
  } catch (e) {
    toast(e.message, true);
  }
  state.loading = false;
  render();
}

async function approveProposal(clientUuid) {
  try {
    await api('proposal_review.php', { method: 'POST', body: JSON.stringify({ client_uuid: clientUuid, decision: 'approve' }) });
    toast('Proposal disetujui.');
    await loadAll();
  } catch (e) { toast(e.message, true); }
}

async function rejectProposal(clientUuid, reason) {
  try {
    await api('proposal_review.php', { method: 'POST', body: JSON.stringify({ client_uuid: clientUuid, decision: 'reject', reason }) });
    toast('Proposal ditolak.');
    await loadAll();
  } catch (e) { toast(e.message, true); }
}

async function reviewException(id, status, reason) {
  try {
    await api('location_exception_review.php', { method: 'POST', body: JSON.stringify({ id, status, reason }) });
    toast('Exception diperbarui.');
    await loadAll();
  } catch (e) { toast(e.message, true); }
}

// ---- Rejection reason modal ----
function openReasonModal(title, onConfirm, opts = {}) {
  const bg = el('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) bg.remove(); } });
  const reasonInput = el('textarea', { rows: 3, placeholder: 'Alasan wajib diisi...' });
  let statusSelect = null;
  const body = [reasonInput];
  if (opts.statuses) {
    statusSelect = el('select', {});
    for (const s of opts.statuses) statusSelect.append(el('option', { value: s }, s));
    body.unshift(statusSelect);
  }
  const modal = el('div', { class: 'modal' },
    el('h3', {}, title),
    ...body,
    el('div', { class: 'row' },
      el('button', { class: 'btn btn-ghost', onclick: () => bg.remove() }, 'Batal'),
      el('button', {
        class: 'btn btn-primary', onclick: () => {
          const reason = reasonInput.value.trim();
          if (!reason) { toast('Alasan wajib diisi.', true); return; }
          onConfirm(reason, statusSelect ? statusSelect.value : null);
          bg.remove();
        }
      }, 'Konfirmasi')
    )
  );
  bg.append(modal);
  document.body.appendChild(bg);
  reasonInput.focus();
}

function openZoom(url) {
  const bg = el('div', { class: 'zoom-bg', onclick: () => bg.remove() }, el('img', { src: url }));
  document.body.appendChild(bg);
}

// ---- Views ----
function loginView() {
  const userIn = el('input', { placeholder: 'Username', autofocus: true, style: 'width:100%;padding:12px;margin-bottom:10px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;color:#e2e8f0' });
  const passIn = el('input', { type: 'password', placeholder: 'Password', style: 'width:100%;padding:12px;margin-bottom:16px;background:#0f172a;border:1px solid #1e293b;border-radius:10px;color:#e2e8f0' });
  const errBox = el('div', { style: 'color:#fda4af;font-size:12px;margin-bottom:10px;min-height:16px' });
  const submit = async () => {
    errBox.textContent = '';
    try {
      await doLogin(userIn.value.trim(), passIn.value);
      render();
    } catch (e) { errBox.textContent = e.message; }
  };
  passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  return el('div', { style: 'max-width:380px;margin:80px auto;background:rgba(15,23,42,.7);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:28px;backdrop-filter:blur(20px)' },
    el('h2', { style: "font-family:'Rajdhani',sans-serif;margin-bottom:4px" }, 'Portal Supervisor / Admin'),
    el('p', { style: 'color:#94a3b8;font-size:12px;margin-bottom:20px' }, 'WMS Stock Opname — PT Unison Industrial Indonesia'),
    userIn, passIn, errBox,
    el('button', { class: 'btn btn-primary', style: 'width:100%;padding:12px', onclick: submit }, 'Masuk')
  );
}

function proposalCard(p) {
  return el('div', { class: 'item-card' },
    el('div', { class: 'body' },
      el('img', { src: API + p.photo_url, onclick: () => openZoom(API + p.photo_url) }),
      el('div', { class: 'meta' },
        el('div', { class: 'name' }, p.name),
        el('div', { class: 'barcode' }, p.barcode),
        el('div', {}, 'Gudang: ', el('b', {}, p.warehouse_code)),
        el('div', {}, 'Qty: ', el('b', {}, String(p.proposed_qty))),
        el('div', {}, 'Oleh: ', el('b', {}, p.username)),
        p.notes ? el('div', { style: 'margin-top:4px;font-style:italic;color:#cbd5e1' }, '"' + p.notes + '"') : ''
      )
    ),
    el('div', { class: 'actions' },
      el('button', {
        class: 'btn btn-danger', onclick: () => openReasonModal('Tolak Proposal', (reason) => rejectProposal(p.client_uuid, reason))
      }, el('i', { class: 'fa-solid fa-xmark' }), ' Tolak'),
      el('button', { class: 'btn btn-primary', onclick: () => approveProposal(p.client_uuid) }, el('i', { class: 'fa-solid fa-check' }), ' Setujui')
    )
  );
}

function proposalsView() {
  if (state.proposals.length === 0) {
    return el('div', { class: 'empty' }, el('i', { class: 'fa-solid fa-circle-check' }), el('div', {}, 'Tidak ada proposal pending.'));
  }
  return el('div', { class: 'grid' }, ...state.proposals.map(proposalCard));
}

function exceptionsView() {
  if (state.exceptions.length === 0) {
    return el('div', { class: 'empty' }, el('i', { class: 'fa-solid fa-circle-check' }), el('div', {}, 'Tidak ada exception lokasi menunggu review.'));
  }
  const rows = state.exceptions.map((x) => el('tr', {},
    el('td', {}, el('span', { class: 'status-pill st-' + x.status }, x.status)),
    el('td', {}, x.item_code),
    el('td', {}, x.expected_warehouse, ' → ', el('b', { style: 'color:#fbbf24' }, x.found_warehouse)),
    el('td', {}, x.username),
    el('td', {}, x.evidence_note || '-'),
    el('td', {},
      el('button', {
        class: 'btn btn-primary', style: 'font-size:11px;padding:5px 10px;margin-right:4px',
        onclick: () => openReasonModal('Review Exception #' + x.id, (reason, status) => reviewException(x.id, status, reason),
          { statuses: ['APPROVED_RETURN', 'APPROVED_TRANSFER', 'RECOUNT_REQUIRED', 'REJECTED'] })
      }, 'Review')
    )
  ));
  return el('div', { class: 'card' }, el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Status'), el('th', {}, 'Item'), el('th', {}, 'Lokasi'), el('th', {}, 'Operator'), el('th', {}, 'Catatan'), el('th', {}, 'Aksi'))),
    el('tbody', {}, ...rows)
  ));
}

function auditView() {
  if (state.audit.length === 0) {
    return el('div', { class: 'empty' }, el('i', { class: 'fa-solid fa-clock-rotate-left' }), el('div', {}, 'Belum ada log audit.'));
  }
  const rows = state.audit.map((a) => el('tr', {},
    el('td', {}, a.server_received_at),
    el('td', {}, a.username),
    el('td', {}, a.action),
    el('td', {}, a.entity_type),
    el('td', {}, a.description || '-')
  ));
  return el('div', { class: 'card' }, el('table', {},
    el('thead', {}, el('tr', {}, el('th', {}, 'Waktu'), el('th', {}, 'User'), el('th', {}, 'Aksi'), el('th', {}, 'Entitas'), el('th', {}, 'Deskripsi'))),
    el('tbody', {}, ...rows)
  ));
}

function dashboardView() {
  const tabs = [
    ['proposals', 'Antrean Proposal', 'fa-box-open', state.proposals.length],
    ['exceptions', 'Exception Lokasi', 'fa-map-pin', state.exceptions.length],
    ['audit', 'Riwayat Audit', 'fa-clock-rotate-left', 0],
  ];
  const tabBtns = tabs.map(([key, label, icon, count]) =>
    el('div', { class: 'tab' + (state.tab === key ? ' active' : ''), onclick: () => { state.tab = key; render(); } },
      el('i', { class: 'fa-solid ' + icon }), label, count > 0 ? el('span', { class: 'count-pill' }, String(count)) : '')
  );
  let content;
  if (state.loading) content = el('div', { class: 'loading' }, el('i', { class: 'fa-solid fa-spinner spin' }), ' Memuat data...');
  else if (state.tab === 'proposals') content = proposalsView();
  else if (state.tab === 'exceptions') content = exceptionsView();
  else content = auditView();

  return el('div', {},
    el('header', {},
      el('div', {},
        el('h1', {}, 'WMS ', el('span', {}, 'Approval'), ' Portal'),
        el('span', { class: 'badge' }, 'PT UNISON — STAGING .140')
      ),
      el('div', { class: 'user-chip' },
        el('span', {}, state.user.username),
        el('span', { class: 'lvl' }, state.user.user_level === 1 ? 'ADMIN' : 'SUPERVISOR'),
        el('button', { class: 'btn btn-ghost', onclick: () => loadAll() }, el('i', { class: 'fa-solid fa-rotate-right' })),
        el('button', { class: 'btn btn-ghost', onclick: logout }, 'Keluar')
      )
    ),
    el('div', { class: 'tabs' }, ...tabBtns),
    content
  );
}

function render() {
  const app = $('#app');
  app.innerHTML = '';
  app.append(state.token && state.user ? dashboardView() : loginView());
}

if (state.token && state.user) loadAll();
else render();
