// ── API CLIENT ──
const API = {
  token: null,

  getToken() { return localStorage.getItem('ap_token'); },
  setToken(t) { localStorage.setItem('ap_token', t); this.token = t; },
  clearToken() { localStorage.removeItem('ap_token'); this.token = null; },

  async req(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.getToken()}` }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get: (path) => API.req('GET', path),
  post: (path, body) => API.req('POST', path, body),
  put: (path, body) => API.req('PUT', path, body),
  delete: (path) => API.req('DELETE', path),

  // Auth
  login: (username, password) => API.post('/auth/login', { username, password }),
  me: () => API.get('/auth/me'),

  // Events
  getEvents: () => API.get('/events'),
  getEvent: (id) => API.get(`/events/${id}`),
  createEvent: (d) => API.post('/events', d),
  updateEvent: (id, d) => API.put(`/events/${id}`, d),
  deleteEvent: (id) => API.delete(`/events/${id}`),

  // Event access
  getEventAccess: (eid) => API.get(`/events/${eid}/access`),
  grantAccess: (eid, uid, perm) => API.post(`/events/${eid}/access`, { user_id: uid, permission: perm }),
  revokeAccess: (eid, uid) => API.delete(`/events/${eid}/access/${uid}`),

  // Teams
  getTeams: (eid) => API.get(`/events/${eid}/teams`),
  createTeam: (eid, d) => API.post(`/events/${eid}/teams`, d),
  updateTeam: (eid, tid, d) => API.put(`/events/${eid}/teams/${tid}`, d),
  deleteTeam: (eid, tid) => API.delete(`/events/${eid}/teams/${tid}`),
  bulkTeams: (eid, teams) => API.post(`/events/${eid}/teams/bulk`, { teams }),

  // Players
  getPlayers: (eid) => API.get(`/events/${eid}/players`),
  createPlayer: (eid, d) => API.post(`/events/${eid}/players`, d),
  updatePlayer: (eid, pid, d) => API.put(`/events/${eid}/players/${pid}`, d),
  deletePlayer: (eid, pid) => API.delete(`/events/${eid}/players/${pid}`),
  bulkPlayers: (eid, players) => API.post(`/events/${eid}/players/bulk`, { players }),
  resetPlayers: (eid) => API.post(`/events/${eid}/players/reset`, {}),

  // State
  getState: (eid) => API.get(`/events/${eid}/state`),
  getHistory: (eid) => API.get(`/events/${eid}/history`),
  getExport: (eid) => API.get(`/events/${eid}/export/full`),

  // Users
  getUsers: () => API.get('/users'),
  createUser: (d) => API.post('/users', d),
  updateUser: (id, d) => API.put(`/users/${id}`, d),
  deleteUser: (id) => API.delete(`/users/${id}`),
};

// ── UI HELPERS ──
function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  const icons = { success: '✓', error: '✕', info: 'ℹ', warn: '⚠' };
  t.className = `toast t-${type}`;
  t.innerHTML = `<span>${icons[type] || '•'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'tOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

function modal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target.classList.contains('modal-overlay'))closeModal()">${html}</div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function el(id) { return document.getElementById(id); }
function set(id, v) { const e = el(id); if (e) e.textContent = v; }
function show(id) { const e = el(id); if (e) e.style.display = ''; }
function hide(id) { const e = el(id); if (e) e.style.display = 'none'; }

function logoHtml(url, initials, color) {
  if (url) return `<img src="${url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" style="width:100%;height:100%;object-fit:cover;border-radius:50%"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${initials}</span>`;
  return initials;
}
function photoHtml(url, name) {
  if (url) return `<img src="${url}" style="width:100%;height:100%;object-fit:cover;object-position:top" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${name.charAt(0)}</span>`;
  return `<span>${name.charAt(0).toUpperCase()}</span>`;
}

function roleColor(role) {
  return { 'Batsman': '#2563eb', 'Bowler': '#dc2626', 'All-Rounder': '#16a34a', 'Wicket-Keeper': '#d97706' }[role] || '#6b7280';
}

function fmtCurrency(amount, currency = '₹') {
  return `${currency}${amount}L`;
}

function dlFile(content, filename, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
}

function parseCSVLine(line) {
  const cols = []; let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}
