// ── APP STATE ──
const App = {
  user: null,
  currentEvent: null,
  socket: null,
  liveState: {},

  async init() {
    const token = API.getToken();
    if (token) {
      try {
        const user = await API.me();
        this.setUser(user);
        this.showApp();
      } catch {
        API.clearToken();
        this.showLogin();
      }
    } else {
      this.showLogin();
    }
  },

  setUser(user) {
    this.user = user;
    set('sidebar-user-name', user.full_name);
    set('sidebar-user-role', user.role === 'superadmin' ? 'Super Admin' : 'Operator');
    el('sidebar-user-av').textContent = user.full_name.charAt(0).toUpperCase();
    if (user.role === 'superadmin') {
      show('nav-users'); show('nav-users-divider');
    }
  },

  showLogin() { el('screen-login').classList.add('active'); el('screen-app').classList.remove('active'); },
  showApp() { el('screen-app').classList.add('active'); el('screen-login').classList.remove('active'); navTo('events'); },

  setEvent(ev) {
    this.currentEvent = ev;
    set('sb-event-name', ev ? ev.name : 'No Event Selected');
    if (ev) {
      show('nav-admin'); show('nav-setup'); show('nav-live'); show('nav-export');
    }
    if (ev) this.connectSocket(ev.id);
  },

  connectSocket(eventId) {
    if (this.socket) this.socket.disconnect();
    this.socket = io({ auth: { token: API.getToken() } });
    this.socket.on('connect', () => {
      this.socket.emit('join_event', { eventId, isAdmin: true });
    });
    // Broadcast handlers - pages subscribe to these
    const events = ['auction:started','auction:bid_updated','auction:team_updated','auction:stage_updated',
      'auction:player_changed','auction:sold','auction:unsold','auction:undo_done','auction:paused',
      'auction:resumed','auction:ended','auction:all_done'];
    events.forEach(evt => {
      this.socket.on(evt, (data) => {
        this.liveState = data;
        document.dispatchEvent(new CustomEvent('ap:state', { detail: { event: evt, data } }));
      });
    });
    this.socket.on('error', (msg) => toast(msg, 'error'));
    this.socket.on('info', (msg) => toast(msg, 'info'));
  },

  emit(event, data = {}) {
    if (!this.socket) return toast('Not connected', 'error');
    this.socket.emit(event, { eventId: this.currentEvent?.id, ...data });
  }
};

// ── AUTH ──
async function doLogin() {
  const username = el('login-user').value.trim();
  const password = el('login-pass').value;
  const errEl = el('login-error');
  if (!username || !password) { errEl.textContent = 'Please enter username and password'; errEl.style.display = ''; return; }
  errEl.style.display = 'none';
  try {
    const res = await API.login(username, password);
    API.setToken(res.token);
    App.setUser(res.user);
    App.showApp();
  } catch (e) {
    errEl.textContent = e.message || 'Invalid credentials';
    errEl.style.display = '';
  }
}

function doLogout() {
  API.clearToken();
  App.user = null;
  App.currentEvent = null;
  if (App.socket) App.socket.disconnect();
  el('screen-app').classList.remove('active');
  el('screen-login').classList.add('active');
  el('login-user').value = '';
  el('login-pass').value = '';
}

// ── NAVIGATION ──
function navTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.snav-item').forEach(n => n.classList.remove('active'));
  const pageEl = el('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  set('mobile-page-title', { events: 'Events', admin: 'Auction Control', setup: 'Event Setup', live: 'Live Display', export: 'Export', users: 'Users' }[page] || page);
  // Close mobile sidebar
  el('sidebar').classList.remove('open');
  // Load page content
  const loaders = { events: loadEventsPage, admin: loadAdminPage, setup: loadSetupPage, live: loadLivePage, export: loadExportPage, users: loadUsersPage };
  if (loaders[page]) loaders[page]();
}

function switchView(page, btn) { navTo(page); }
function toggleSidebar() { el('sidebar').classList.toggle('open'); }

// ── BOOT ──
document.addEventListener('DOMContentLoaded', () => App.init());
