let liveStateListener = null;
let liveData = {};

async function loadLivePage() {
  const page = el('page-live');
  if (!App.currentEvent) {
    page.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)"><div style="font-size:1.5rem;margin-bottom:.5rem">📺</div><div>Please select an event first</div></div>`;
    return;
  }
  page.innerHTML = renderLiveHTML();
  await refreshLiveData();

  if (liveStateListener) document.removeEventListener('ap:state', liveStateListener);
  liveStateListener = (e) => {
    liveData = e.detail.data;
    renderLiveComponents();
  };
  document.addEventListener('ap:state', liveStateListener);
}

function renderLiveHTML() {
  const ev = App.currentEvent;
  const brand = ev.brand_color || '#2563eb';
  return `
  <div style="width:100%;height:100%;background:#08090d;display:flex;flex-direction:column;font-family:'Barlow Condensed',sans-serif;overflow:hidden">
    <!-- Header bar -->
    <div style="height:56px;background:linear-gradient(90deg,#0f1929 0%,#141e30 100%);border-bottom:2px solid ${brand};display:flex;align-items:center;padding:0 1.5rem;gap:1rem;flex-shrink:0">
      <div style="width:36px;height:36px;border-radius:8px;overflow:hidden;background:${brand}22;border:1px solid ${brand}44;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;color:${brand}" id="l-header-logo">
        ${ev.logo_url ? `<img src="${ev.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:7px" onerror="this.style.display='none'">` : ev.name.slice(0,2).toUpperCase()}
      </div>
      <div style="font-size:1.3rem;font-weight:700;letter-spacing:.5px;color:#fff" id="l-event-name">${ev.name}</div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:.75rem">
        <div id="l-status-badge" style="display:flex;align-items:center;gap:6px;background:rgba(234,88,12,.1);border:1px solid rgba(234,88,12,.3);padding:4px 12px;border-radius:20px;font-size:.72rem;font-weight:700;color:#ea580c;text-transform:uppercase;letter-spacing:1px">
          <div style="width:6px;height:6px;border-radius:50%;background:#ea580c;animation:blink 1.4s infinite"></div>
          LIVE
        </div>
        <div style="font-size:.78rem;color:rgba(255,255,255,.35)" id="l-date">${ev.date||''}</div>
      </div>
    </div>

    <!-- Main body: 16:9 layout -->
    <div style="flex:1;display:grid;grid-template-columns:1fr 320px;gap:0;overflow:hidden">

      <!-- Left: Player Spotlight + Next -->
      <div style="display:flex;flex-direction:column;padding:1.25rem;gap:1rem;overflow:hidden">

        <!-- Big spotlight card -->
        <div style="background:linear-gradient(145deg,#0d1525 0%,#0f1830 100%);border:1px solid ${brand}22;border-radius:16px;padding:1.75rem;flex:1;position:relative;overflow:hidden" id="l-spotlight">
          <!-- glow -->
          <div style="position:absolute;top:-80px;right:-80px;width:300px;height:300px;background:radial-gradient(circle,${brand}08 0%,transparent 65%);pointer-events:none"></div>
          <div style="font-size:.62rem;font-weight:600;text-transform:uppercase;letter-spacing:2.5px;color:rgba(255,255,255,.3);margin-bottom:1.25rem">NOW ON THE TABLE</div>
          <div id="l-player-content">
            <div style="text-align:center;padding:3rem;color:rgba(255,255,255,.2)">
              <div style="font-size:3rem;margin-bottom:.75rem">🏏</div>
              <div style="font-size:1.5rem;font-weight:600;letter-spacing:.5px">Waiting to Begin</div>
            </div>
          </div>
        </div>

        <!-- Next player preview -->
        <div id="l-next-wrap" style="min-height:0"></div>
      </div>

      <!-- Right panel -->
      <div style="background:#0b0f1a;border-left:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;overflow:hidden">

        <!-- Team Purse Board -->
        <div style="padding:1rem;border-bottom:1px solid rgba(255,255,255,.06)">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.25);margin-bottom:.75rem">TEAM PURSE BOARD</div>
          <div id="l-purse-board" style="display:flex;flex-direction:column;gap:0"></div>
        </div>

        <!-- Recently Sold Ticker -->
        <div style="flex:1;padding:1rem;overflow:hidden">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.25);margin-bottom:.75rem">RECENTLY SOLD</div>
          <div id="l-ticker" style="display:flex;flex-direction:column;gap:0">
            <div style="color:rgba(255,255,255,.2);font-size:.8rem;text-align:center;padding:.5rem">No sales yet</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <style>
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
    @keyframes sold-flash{0%{background:rgba(22,163,74,.15)}100%{background:transparent}}
  </style>`;
}

async function refreshLiveData() {
  if (!App.currentEvent) return;
  try {
    const eid = App.currentEvent.id;
    const [teams, players, state, history] = await Promise.all([
      API.getTeams(eid), API.getPlayers(eid), API.getState(eid), API.getHistory(eid)
    ]);
    const currentPlayer = state?.current_player_id ? players.find(p=>p.id===state.current_player_id) : null;
    const currentTeam = state?.current_team_id ? teams.find(t=>t.id===state.current_team_id) : null;
    const nextPlayer = players.filter(p=>p.status==='pending' && p.id!==state?.current_player_id).sort((a,b)=>a.auction_order-b.auction_order)[0];
    liveData = { event: App.currentEvent, teams, players, state, currentPlayer, currentTeam, nextPlayer, recentSold: history.filter(h=>h.action==='sold').slice(0,8) };
    renderLiveComponents();
  } catch (e) { console.error(e); }
}

function renderLiveComponents() {
  renderLiveSpotlight();
  renderLivePurseBoard();
  renderLiveTicker();
}

function renderLiveSpotlight() {
  const content = el('l-player-content'); if (!content) return;
  const nextWrap = el('l-next-wrap'); if (!nextWrap) return;
  const { state, currentPlayer, currentTeam, nextPlayer } = liveData;
  const brand = App.currentEvent?.brand_color || '#2563eb';

  if (!currentPlayer) {
    content.innerHTML = `<div style="text-align:center;padding:3rem;color:rgba(255,255,255,.2)">
      <div style="font-size:3rem;margin-bottom:.75rem">🏏</div>
      <div style="font-size:1.5rem;font-weight:600;letter-spacing:.5px">${App.currentEvent?.status==='live'?'Auction In Progress':'Waiting to Begin'}</div>
    </div>`;
    nextWrap.innerHTML = '';
    return;
  }

  const stageConfig = {
    'LIVE':       { label:'LIVE',         bg:'rgba(234,88,12,.12)',  color:'#ea580c', border:'rgba(234,88,12,.35)' },
    'GOING ONCE': { label:'GOING ONCE',   bg:'rgba(217,119,6,.1)',   color:'#d97706', border:'rgba(217,119,6,.35)' },
    'GOING TWICE':{ label:'GOING TWICE',  bg:'rgba(180,83,9,.12)',   color:'#b45309', border:'rgba(180,83,9,.4)' },
    'SOLD':       { label:'SOLD!',        bg:'rgba(22,163,74,.12)',  color:'#16a34a', border:'rgba(22,163,74,.4)' },
    'UNSOLD':     { label:'UNSOLD',       bg:'rgba(220,38,38,.1)',   color:'#dc2626', border:'rgba(220,38,38,.3)' },
  };
  const stage = stageConfig[state?.current_stage] || stageConfig['LIVE'];
  const cur = App.currentEvent.currency;

  content.innerHTML = `<div style="display:flex;gap:1.5rem;align-items:flex-start;height:100%">
    <!-- Photo -->
    <div style="width:140px;min-width:140px;height:170px;border-radius:12px;background:#1a2030;border:1.5px solid ${brand}30;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:4rem;font-weight:700;color:${brand};flex-shrink:0">
      ${currentPlayer.photo_url ? `<img src="${currentPlayer.photo_url}" style="width:100%;height:100%;object-fit:cover;object-position:top" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;font-size:4rem;font-weight:700;color:${brand};position:absolute">${currentPlayer.name.charAt(0)}</span>` : currentPlayer.name.charAt(0)}
    </div>
    <!-- Info -->
    <div style="flex:1;min-width:0">
      <div style="font-size:3.2rem;font-weight:800;line-height:1;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${currentPlayer.name}</div>
      <div style="font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:${roleColor(currentPlayer.role)};margin-top:5px">${currentPlayer.role}</div>
      <div style="font-size:.75rem;color:rgba(255,255,255,.3);margin-top:3px">Base Price: ${cur}${currentPlayer.base_price}L</div>

      <div style="margin-top:1.25rem">
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,.25);margin-bottom:4px">Current Bid</div>
        <div style="font-size:4rem;font-weight:900;color:${brand};line-height:1">
          <span style="font-size:2rem;vertical-align:super;line-height:0">${cur}</span>${state?.current_bid||0}<span style="font-size:1.6rem;margin-left:2px">L</span>
        </div>
      </div>

      ${currentTeam ? `<div style="display:flex;align-items:center;gap:10px;margin-top:.85rem;padding:.55rem 1rem;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;width:fit-content">
        <div style="width:20px;height:20px;border-radius:50%;background:${currentTeam.color};flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:#fff">
          ${currentTeam.logo_url ? `<img src="${currentTeam.logo_url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">` : ''}
        </div>
        <div>
          <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3)">Leading Team</div>
          <div style="font-size:.95rem;font-weight:600;color:#fff">${currentTeam.name}</div>
        </div>
      </div>` : ''}

      <div style="display:inline-block;margin-top:.85rem;padding:7px 18px;border-radius:8px;font-size:1.1rem;font-weight:700;letter-spacing:2px;background:${stage.bg};color:${stage.color};border:1.5px solid ${stage.border}">${stage.label}</div>
    </div>
  </div>`;

  // Next player
  if (nextPlayer) {
    nextWrap.innerHTML = `<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:.85rem 1rem;display:flex;align-items:center;gap:10px">
      <div style="width:38px;height:44px;border-radius:7px;background:#1a2030;border:1px solid rgba(255,255,255,.1);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.9rem;font-weight:700;color:rgba(255,255,255,.3)">
        ${nextPlayer.photo_url ? `<img src="${nextPlayer.photo_url}" style="width:100%;height:100%;object-fit:cover;object-position:top">` : nextPlayer.name.charAt(0)}
      </div>
      <div>
        <div style="font-size:.6rem;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,.25)">Up Next</div>
        <div style="font-size:.9rem;font-weight:600;color:rgba(255,255,255,.8)">${nextPlayer.name}</div>
        <div style="font-size:.7rem;color:rgba(255,255,255,.3)">${nextPlayer.role} · Base ${App.currentEvent.currency}${nextPlayer.base_price}L</div>
      </div>
    </div>`;
  } else { nextWrap.innerHTML = ''; }
}

function renderLivePurseBoard() {
  const board = el('l-purse-board'); if (!board) return;
  const { teams, players } = liveData;
  if (!teams?.length) { board.innerHTML = ''; return; }
  board.innerHTML = teams.map(t => {
    const soldCount = (players||[]).filter(p=>p.sold_to===t.id&&p.status==='sold').length;
    const pct = t.purse_start > 0 ? Math.round((t.purse_left/t.purse_start)*100) : 100;
    const barColor = pct > 50 ? '#16a34a' : pct > 25 ? '#d97706' : '#dc2626';
    return `<div style="padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:24px;height:24px;border-radius:50%;background:${t.color}22;border:1px solid ${t.color}44;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700;color:${t.color}">
          ${t.logo_url ? `<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'">` : t.short_name}
        </div>
        <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.82rem;font-weight:500;color:rgba(255,255,255,.75)">${t.name}</div>
        <div style="text-align:right">
          <div style="font-size:.95rem;font-weight:700;color:${App.currentEvent?.brand_color||'#e8b84b'}">${App.currentEvent?.currency}${t.purse_left}L</div>
          <div style="font-size:.62rem;color:rgba(255,255,255,.25)">${soldCount} players</div>
        </div>
      </div>
      <div style="height:2px;background:rgba(255,255,255,.06);border-radius:1px;margin-top:5px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:1px;transition:width .5s ease"></div>
      </div>
    </div>`;
  }).join('');
}

function renderLiveTicker() {
  const ticker = el('l-ticker'); if (!ticker) return;
  const recent = liveData.recentSold || [];
  if (!recent.length) { ticker.innerHTML = `<div style="color:rgba(255,255,255,.2);font-size:.8rem;text-align:center;padding:.5rem">No sales yet</div>`; return; }
  ticker.innerHTML = recent.slice(0,7).map(h => {
    const t = (liveData.teams||[]).find(x=>x.id===h.team_id);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div>
        <div style="font-size:.82rem;font-weight:600;color:rgba(255,255,255,.75)">${h.player_name}</div>
        <div style="font-size:.68rem;color:rgba(255,255,255,.3)">${t?.name||'?'}</div>
      </div>
      <div style="font-size:.95rem;font-weight:700;color:${App.currentEvent?.brand_color||'#e8b84b'}">${App.currentEvent?.currency}${h.amount}L</div>
    </div>`;
  }).join('');
}
