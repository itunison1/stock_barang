// WMS API client — pakai kontrak resmi Android (/api/*.php), TIDAK duplikat skema sendiri.
// api.php (root) hanya jembatan sesi PHP -> bearer token; semua data/aksi lewat /api/*.php resmi.
const API_ROOT = './api';

let bearerToken = null;
export function setToken(t) { bearerToken = t; }

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`;
  const res = await fetch(`${API_ROOT}/${path}`, { credentials: 'same-origin', ...opts, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(body.message || `HTTP ${res.status} for ${path}`);
  return body.data;
}

// Reads the PHP-session user (set by login.php form POST) and mints a
// bearer token compatible with the official /api/*.php contract (same
// WMS_TOKEN_SECRET), so React doesn't need a separate login step.
export async function fetchSessionUser() {
  const res = await fetch('./api.php?action=session_token', { credentials: 'same-origin' });
  const body = await res.json().catch(() => ({}));
  if (!body.success) return null;
  return body.data; // { token, username }
}

export async function fetchWarehouses() {
  const data = await req('warehouses.php');
  return data.map(w => ({ id: w.code, code: w.code, name: w.name }));
}

export async function fetchUsers() {
  const data = await req('users.php');
  return data.map(u => ({
    id: u.iduser,
    username: u.username,
    division: u.user_divisi,
    level: u.user_level,
    active: u.user_aktif,
    role: u.user_level === 1 ? 'admin' : u.user_level === 2 ? 'supervisor' : 'operator',
  }));
}

export async function fetchAuditLog(limit = 100) {
  const data = await req(`audit_log.php?limit=${limit}`);
  return data.map(a => ({
    id: a.client_uuid,
    username: a.username,
    action: a.action,
    entityType: a.entity_type,
    description: a.description,
    createdAt: a.server_received_at,
  }));
}

export async function fetchProposals(status = 'pending') {
  const data = await req(`proposal_queue.php?status=${status}`);
  return data.map(p => ({
    id: p.client_uuid,
    clientUuid: p.client_uuid,
    username: p.username,
    barcode: p.barcode,
    name: p.name,
    category: p.category,
    proposedQty: p.proposed_qty,
    warehouseCode: p.warehouse_code,
    notes: p.notes,
    photoUrl: p.photo_url ? `./api/${p.photo_url}` : null,
    status: p.status,
    rejectionReason: p.rejection_reason,
    approvedBy: p.approved_by,
    createdAt: p.created_at_device,
  }));
}

export async function reviewProposal(clientUuid, decision, reason = '') {
  return req('proposal_review.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_uuid: clientUuid, decision, reason }),
  });
}

export async function fetchLocationExceptions(status = '') {
  const qs = status ? `?status=${status}` : '';
  return req(`location_exception_queue.php${qs}`);
}

export async function reviewLocationException(id, status, reason = '') {
  return req('location_exception_review.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, status, reason }),
  });
}

export async function fetchStatus() {
  const res = await fetch('./api.php?action=status', { credentials: 'same-origin' });
  return res.json();
}
