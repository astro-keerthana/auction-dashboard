let adminData = { teams: [], players: [], state: {}, history: [] };
let adminStateListener = null;

async function loadAdminPage() {
  if (!App.currentEvent) { el('page-admin').innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)"><div style="font-size:1.5rem;margin-bottom:.5rem">🏏</div><div>Please select an event first</div><button class="btn btn-primary" style="margin-top:1rem" onclick="navTo('events')">Go to Events</button></div>`; return; }
  el('page-admin').innerHTML = renderAdminHTML();
  await refreshAdminData();
  // Listen for real-time updates
  if (adminStateListener) document.removeEventListener('ap:state', adminStateListener);
  adminStateListener = (e) => { adminData.teams = e.detail.data.teams || adminData.teams; adminData.players = e.detail.data.players || adminData.players; adminData.state = e.detail.data.state || adminData.state; if (e.detail.data.recentSold) adminData.history = e.detail.data.recentSold; renderAdminComponents(); };
  document.addEventListener('ap:state', adminStateListener);
}

function renderAdminHTML() {
  return `
  <div style="display:flex;flex-direction:column;gap:.85rem;flex:1;overflow:hidden">
    <!-- Status Bar -->
    <div class="admin-card" style="padding:.8rem 1rem;flex-shrink:0">
      <div class="status-bar">
        <div class="sc"><span class="sl">Event</span><span class="sv" id="a-event-name">${App.currentEvent.name}</span></div>
        <div class="sep"></div>
        <div class="sc"><span class="sl">Status</span><span class="sv" id="a-status" style="color:var(--text3)">Not Started</span></div>
        <div class="sep"></div>
        <div class="sc"><span class="sl">Progress</span><span class="sv" id="a-progress">0/0</span></div>
        <div class="sep"></div>
        <div class="sc"><span class="sl">Total Sold</span><span class="sv" id="a-spent" style="color:var(--blue)">₹0L</span></div>
        <div class="sb-actions">
          <button class="btn btn-primary" id="btn-a-start" onclick="auctionStart()">▶ Start Auction</button>
          <button class="btn btn-secondary" id="btn-a-pause" style="display:none" onclick="auctionPause()">⏸ Pause</button>
          <button class="btn btn-secondary" id="btn-a-resume" style="display:none" onclick="auctionResume()">▶ Resume</button>
          <button class="btn btn-secondary" style="font-size:.75rem" onclick="navTo('live')">📺 Live View</button>
        </div>
      </div>
    </div>
    <!-- Main Grid -->
    <div class="admin-layout" style="flex:1;overflow:hidden">
      <div class="admin-center">
        <!-- On Table -->
        <div class="admin-card">
          <div class="card-hd">On The Table</div>
          <div id="a-on-table"><div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:.85rem">🏏 Start auction or select a player</div></div>
        </div>
        <!-- Bid Controls -->
        <div class="admin-card">
          <div class="card-hd">Bid Controls</div>
          <div class="bid-section">
            <div class="bid-box">
              <div class="bid-box-label">Current Bid</div>
              <div class="bid-box-val"><span class="bsym" id="a-bid-sym">${App.currentEvent.currency}</span><span id="a-bid-val">0</span><span class="bunit">L</span></div>
            </div>
            <div class="bid-controls">
              <div class="bid-input-row">
                <input type="number" id="a-bid-inp" placeholder="Amount (L)" min="0" oninput="onBidInput()">
                <button class="btn btn-secondary btn-sm" onclick="resetBid()">Reset</button>
              </div>
              <div class="incr-row">
                <button class="incr-btn" onclick="addBid(5)">+5L</button>
                <button class="incr-btn" onclick="addBid(10)">+10L</button>
                <button class="incr-btn" onclick="addBid(25)">+25L</button>
                <button class="incr-btn" onclick="addBid(50)">+50L</button>
                <button class="incr-btn" onclick="addBid(100)">+1Cr</button>
                <button class="incr-btn" onclick="addBid(200)">+2Cr</button>
              </div>
            </div>
          </div>
          <!-- Stage -->
          <div style="margin-top:.85rem">
            <div class="card-hd" style="margin-bottom:.45rem">Call Stage</div>
            <div class="stage-row">
              <button class="stage-btn s-live" id="sb-LIVE" onclick="setStage('LIVE')">Live</button>
              <button class="stage-btn" id="sb-ONCE" onclick="setStage('GOING ONCE')">Going Once</button>
              <button class="stage-btn" id="sb-TWICE" onclick="setStage('GOING TWICE')">Going Twice</button>
            </div>
          </div>
          <!-- Leading Team -->
          <div style="margin-top:.85rem">
            <div class="card-hd" style="margin-bottom:.45rem">Leading Team</div>
            <div class="team-grid" id="a-team-picker"></div>
          </div>
          <!-- Actions -->
          <div class="action-row" style="margin-top:.85rem">
            <button class="btn btn-sold" onclick="markSold()">✓ SOLD</button>
            <button class="btn btn-unsold-act" onclick="markUnsold()">✕ UNSOLD</button>
            <button class="btn btn-undo-act" onclick="doUndo()">↩ Undo</button>
            <button class="btn btn-secondary" onclick="nextPlayer()">Next ▶</button>
          </div>
        </div>
        <!-- Queue -->
        <div class="admin-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">
            <div class="card-hd" style="margin-bottom:0">Player Queue</div>
            <input type="text" id="a-q-search" placeholder="Search…" style="width:130px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:.75rem;background:var(--bg);outline:none" oninput="renderQueue()">
          </div>
          <div class="queue-list" id="a-queue"></div>
        </div>
      </div>
      <!-- Sidebar -->
      <div class="admin-sidebar-col">
        <div class="admin-card">
          <div class="card-hd">Recently Sold</div>
          <div class="rs-list" id="a-recent-sold"><div style="color:var(--text3);font-size:.78rem;text-align:center;padding:1rem">No sales yet</div></div>
        </div>
        <div class="admin-card">
          <div class="card-hd">Team Purse Board</div>
          <div class="team-board-list" id="a-team-board"></div>
        </div>
        <div class="admin-card">
          <div class="card-hd">Auction Stats</div>
          <div class="mini-stats">
            <div class="ms-card"><div class="msl">Sold</div><div class="msv" id="a-ms-sold" style="color:var(--green)">0</div></div>
            <div class="ms-card"><div class="msl">Unsold</div><div class="msv" id="a-ms-unsold" style="color:var(--red)">0</div></div>
            <div class="ms-card" style="grid-column:1/-1"><div class="msl">Total Spent</div><div class="msv" id="a-ms-spent" style="color:var(--blue)">₹0L</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

async function refreshAdminData() {
  if (!App.currentEvent) return;
  const eid = App.currentEvent.id;
  try {
    [adminData.teams, adminData.players, adminData.history] = await Promise.all([
      API.getTeams(eid), API.getPlayers(eid), API.getHistory(eid)
    ]);
    const s = await API.getState(eid);
    adminData.state = s;
  } catch (e) { toast(e.message, 'error'); }
  renderAdminComponents();
}

function renderAdminComponents() {
  renderOnTable();
  renderTeamPicker();
  renderQueue();
  renderTeamBoard();
  renderRecentSold();
  renderAdminStats();
  syncBidDisplay();
  syncEventStatus();
}

function renderOnTable() {
  const area = el('a-on-table'); if (!area) return;
  const pid = adminData.state?.current_player_id;
  const p = adminData.players.find(x => x.id === pid);
  if (!p) { area.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text3);font-size:.85rem">🏏 Start auction or select a player</div>`; return; }
  area.innerHTML = `<div class="on-table-player">
    <div class="otp-photo" style="color:${roleColor(p.role)}">${photoHtml(p.photo_url, p.name)}</div>
    <div class="otp-info">
      <div class="otp-name">${p.name}</div>
      <div class="otp-meta">
        <span class="badge" style="background:${roleColor(p.role)}18;color:${roleColor(p.role)}">${p.role}</span>
        <span class="badge b-gray">Base: ${App.currentEvent.currency}${p.base_price}L</span>
        <span class="badge b-gray">#${p.auction_order}</span>
        ${p.status==='sold'?`<span class="badge b-green">SOLD</span>`:''}
        ${p.status==='unsold'?`<span class="badge b-red">UNSOLD</span>`:''}
      </div>
    </div>
  </div>`;
}

function renderTeamPicker() {
  const grid = el('a-team-picker'); if (!grid) return;
  const curBid = adminData.state?.current_bid || 0;
  const curTeamId = adminData.state?.current_team_id;
  grid.innerHTML = adminData.teams.map(t => {
    const soldCount = adminData.players.filter(p => p.sold_to === t.id && p.status === 'sold').length;
    const noBudget = t.purse_left < curBid && curBid > 0;
    const maxed = soldCount >= t.max_players;
    const picked = curTeamId === t.id;
    return `<div class="team-tile${picked?' picked':''}${(noBudget||maxed)?' no-budget':''}" onclick="selectTeam(${t.id})">
      <div class="team-tile-logo" style="background:${t.color}22;color:${t.color}">${t.logo_url ? `<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">` : t.short_name}</div>
      <div class="team-tile-name">${t.name}</div>
      <div class="team-tile-purse">${App.currentEvent.currency}${t.purse_left}L</div>
    </div>`;
  }).join('');
}

function renderQueue() {
  const list = el('a-queue'); if (!list) return;
  const search = (el('a-q-search')?.value || '').toLowerCase();
  const sorted = [...adminData.players].sort((a,b) => a.auction_order - b.auction_order).filter(p => !search || p.name.toLowerCase().includes(search));
  const curId = adminData.state?.current_player_id;
  list.innerHTML = sorted.map(p => {
    let sc = '', cls = '';
    if (p.status==='sold') { sc=`<span class="q-stat qs-sold">Sold</span>`; cls='q-sold'; }
    else if (p.status==='unsold') { sc=`<span class="q-stat qs-unsold">Unsold</span>`; cls='q-unsold'; }
    else if (p.id===curId) { sc=`<span class="q-stat qs-cur">On Table</span>`; cls='q-cur'; }
    return `<div class="q-item ${cls}" onclick="selectPlayerFromQueue(${p.id})">
      <span class="q-num">${p.auction_order}</span>
      <div class="q-av" style="color:${roleColor(p.role)}">${photoHtml(p.photo_url, p.name)}</div>
      <span class="q-name">${p.name}</span>
      <span class="q-price">${App.currentEvent.currency}${p.base_price}L</span>
      ${sc}
    </div>`;
  }).join('');
}

function renderTeamBoard() {
  const board = el('a-team-board'); if (!board) return;
  board.innerHTML = adminData.teams.map(t => {
    const soldCount = adminData.players.filter(p => p.sold_to === t.id && p.status === 'sold').length;
    return `<div class="tb-row">
      <div class="tb-logo" style="background:${t.color}22;color:${t.color}">${t.logo_url ? `<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">` : t.short_name}</div>
      <div class="tb-info"><div class="tb-name">${t.name}</div><div class="tb-purse">${App.currentEvent.currency}${t.purse_left}L left</div></div>
      <div class="tb-count">${soldCount}p</div>
    </div>`;
  }).join('');
}

function renderRecentSold() {
  const list = el('a-recent-sold'); if (!list) return;
  const recent = [...(adminData.history||[])].filter(h=>h.action==='sold').slice(0,7);
  if (!recent.length) { list.innerHTML=`<div style="color:var(--text3);font-size:.78rem;text-align:center;padding:1rem">No sales yet</div>`; return; }
  list.innerHTML = recent.map(h => {
    const t = adminData.teams.find(x=>x.id===h.team_id);
    return `<div class="rs-item"><div class="rs-dot" style="background:${t?.color||'#888'}"></div><div class="rs-name">${h.player_name}</div><div class="rs-team">${t?.short_name||'?'}</div><div class="rs-price">${App.currentEvent.currency}${h.amount}L</div></div>`;
  }).join('');
}

function renderAdminStats() {
  const sold = adminData.players.filter(p=>p.status==='sold');
  const unsold = adminData.players.filter(p=>p.status==='unsold');
  const spent = sold.reduce((s,p)=>s+(p.sold_amount||0),0);
  set('a-ms-sold', sold.length);
  set('a-ms-unsold', unsold.length);
  set('a-ms-spent', `${App.currentEvent.currency}${spent}L`);
  set('a-progress', `${sold.length}/${adminData.players.length}`);
  set('a-spent', `${App.currentEvent.currency}${spent}L`);
}

function syncBidDisplay() {
  const bid = adminData.state?.current_bid || 0;
  set('a-bid-val', bid);
  const inp = el('a-bid-inp'); if (inp && document.activeElement !== inp) inp.value = bid;
  // Stage buttons
  const stage = adminData.state?.current_stage || 'LIVE';
  const stageMap = {'LIVE':'LIVE','GOING ONCE':'ONCE','GOING TWICE':'TWICE'};
  ['LIVE','GOING ONCE','GOING TWICE'].forEach(s => {
    const btn = el('sb-' + stageMap[s]);
    if (!btn) return; btn.className = 'stage-btn';
    if (stage===s) btn.classList.add({LIVE:'s-live','GOING ONCE':'s-once','GOING TWICE':'s-twice'}[s]);
  });
}

function syncEventStatus() {
  const ev = App.currentEvent;
  if (!ev) return;
  const statusEl = el('a-status');
  if (!statusEl) return;
  const colors = { draft:'var(--text3)', live:'var(--green)', paused:'var(--amber)', ended:'var(--red)' };
  const labels = { draft:'Not Started', live:'LIVE', paused:'Paused', ended:'Ended' };
  statusEl.textContent = labels[ev.status] || ev.status;
  statusEl.style.color = colors[ev.status] || 'var(--text3)';
  const startBtn = el('btn-a-start'), pauseBtn = el('btn-a-pause'), resumeBtn = el('btn-a-resume');
  const mobileBadge = el('mobile-live-badge');
  if (ev.status === 'live') {
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = '';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (mobileBadge) mobileBadge.style.display = '';
  } else if (ev.status === 'paused') {
    if (startBtn) startBtn.style.display = 'none';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = '';
    if (mobileBadge) mobileBadge.style.display = 'none';
  } else {
    if (startBtn) startBtn.style.display = '';
    if (pauseBtn) pauseBtn.style.display = 'none';
    if (resumeBtn) resumeBtn.style.display = 'none';
    if (mobileBadge) mobileBadge.style.display = 'none';
  }
}

// ── AUCTION ACTIONS ──
function auctionStart() {
  if (!adminData.players.length) { toast('Add players first', 'error'); return; }
  if (!adminData.teams.length) { toast('Add teams first', 'error'); return; }
  App.emit('auction:start');
  App.currentEvent.status = 'live';
  syncEventStatus();
}
function auctionPause() { App.emit('auction:pause'); App.currentEvent.status='paused'; syncEventStatus(); }
function auctionResume() { App.emit('auction:resume'); App.currentEvent.status='live'; syncEventStatus(); }

function addBid(v) {
  const cur = adminData.state?.current_bid || 0;
  const newBid = cur + v;
  adminData.state = { ...adminData.state, current_bid: newBid };
  set('a-bid-val', newBid);
  const inp = el('a-bid-inp'); if (inp) inp.value = newBid;
  App.emit('auction:set_bid', { amount: newBid });
}

function onBidInput() {
  const v = parseInt(el('a-bid-inp')?.value) || 0;
  adminData.state = { ...adminData.state, current_bid: v };
  set('a-bid-val', v);
  App.emit('auction:set_bid', { amount: v });
}

function resetBid() {
  const curId = adminData.state?.current_player_id;
  const p = adminData.players.find(x => x.id === curId);
  if (p) { adminData.state = { ...adminData.state, current_bid: p.base_price }; set('a-bid-val', p.base_price); const inp = el('a-bid-inp'); if(inp) inp.value=p.base_price; App.emit('auction:set_bid', { amount: p.base_price }); }
}

function selectTeam(teamId) {
  adminData.state = { ...adminData.state, current_team_id: teamId };
  renderTeamPicker();
  App.emit('auction:set_team', { teamId });
}

function setStage(stage) {
  adminData.state = { ...adminData.state, current_stage: stage };
  syncBidDisplay();
  App.emit('auction:set_stage', { stage });
}

function selectPlayerFromQueue(playerId) {
  App.emit('auction:select_player', { playerId });
}

function markSold() { App.emit('auction:mark_sold'); }
function markUnsold() { App.emit('auction:mark_unsold'); }
function doUndo() { App.emit('auction:undo'); }
function nextPlayer() { App.emit('auction:next_player'); }
