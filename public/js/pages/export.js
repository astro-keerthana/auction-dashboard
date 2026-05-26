async function loadExportPage() {
  const page = el('page-export');
  if (!App.currentEvent) { page.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)"><div style="font-size:1.5rem;margin-bottom:.5rem">⬇</div><div>Please select an event first</div><button class="btn btn-primary" style="margin-top:1rem" onclick="navTo('events')">Go to Events</button></div>`; return; }
  page.innerHTML = `
    <div class="page-header"><div><div class="page-title">Export</div><div class="page-subtitle">${App.currentEvent.name}</div></div></div>
    <div style="display:flex;flex-direction:column;gap:1rem;max-width:800px">
      <div class="card" style="padding:1rem"><div class="sec-title">📊 Auction Summary</div><div id="export-summary-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem"></div></div>
      <div class="card" style="padding:1rem">
        <div class="sec-title">⬇ Download Reports</div>
        <div class="export-grid">
          <div class="exp-card" onclick="doExport('sold')"><div class="exp-icon">✅</div><div class="exp-title">Sold Players</div><div class="exp-desc">Player, team, sold price</div></div>
          <div class="exp-card" onclick="doExport('unsold')"><div class="exp-icon">❌</div><div class="exp-title">Unsold Players</div><div class="exp-desc">All unsold with base price</div></div>
          <div class="exp-card" onclick="doExport('teams')"><div class="exp-icon">🏆</div><div class="exp-title">Team Summary</div><div class="exp-desc">Purse, spend, full squad</div></div>
          <div class="exp-card" onclick="doExport('full')"><div class="exp-icon">📦</div><div class="exp-title">Full Results</div><div class="exp-desc">All players + status</div></div>
          <div class="exp-card" onclick="doExport('history')"><div class="exp-icon">🕐</div><div class="exp-title">Sale History</div><div class="exp-desc">Chronological log</div></div>
          <div class="exp-card" onclick="printResults()"><div class="exp-icon">🖨</div><div class="exp-title">Print Summary</div><div class="exp-desc">Formatted print report</div></div>
        </div>
      </div>
      <div class="card" style="padding:1rem"><div class="sec-title">📋 Squad Lists by Team</div><div id="export-squads"></div></div>
    </div>`;
  await loadExportData();
}

let exportCache = {};

async function loadExportData() {
  try {
    exportCache = await API.getExport(App.currentEvent.id);
    renderExportSummary(); renderExportSquads();
  } catch(e) { toast(e.message,'error'); }
}

function renderExportSummary() {
  const grid = el('export-summary-grid'); if (!grid) return;
  const {players=[],teams=[]} = exportCache;
  const sold = players.filter(p=>p.status==='sold');
  const spent = sold.reduce((s,p)=>s+(p.sold_amount||0),0);
  const cur = App.currentEvent.currency;
  grid.innerHTML = [['Total Players',players.length,'var(--text)'],['Sold',sold.length,'var(--green)'],['Unsold',players.filter(p=>p.status==='unsold').length,'var(--red)'],['Total Spent',cur+spent+'L','var(--blue)']].map(([l,v,c])=>`<div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:.75rem;text-align:center"><div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.8px;color:var(--text3)">${l}</div><div style="font-family:var(--font-head);font-size:1.6rem;font-weight:700;color:${c}">${v}</div></div>`).join('');
}

function renderExportSquads() {
  const el2 = el('export-squads'); if (!el2) return;
  const {teams=[],players=[]} = exportCache;
  if (!teams.length) { el2.innerHTML = `<div style="color:var(--text3);font-size:.82rem">No teams yet.</div>`; return; }
  el2.innerHTML = teams.map(t=>{
    const squad = players.filter(p=>p.sold_to===t.id&&p.status==='sold');
    const spent = squad.reduce((s,p)=>s+(p.sold_amount||0),0);
    return `<div style="margin-bottom:.85rem;padding:.85rem;border:1px solid var(--border);border-radius:var(--r2);border-left:3px solid ${t.color}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;flex-wrap:wrap;gap:.4rem">
        <div style="display:flex;align-items:center;gap:.5rem">
          <div style="width:24px;height:24px;border-radius:50%;background:${t.color}22;color:${t.color};display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;overflow:hidden">${t.logo_url?`<img src="${t.logo_url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`:t.short_name}</div>
          <strong style="font-size:.88rem">${t.name}</strong>
        </div>
        <div style="font-size:.75rem;color:var(--text2)">Start: ${App.currentEvent.currency}${t.purse_start}L &nbsp;·&nbsp; Spent: ${App.currentEvent.currency}${spent}L &nbsp;·&nbsp; Left: ${App.currentEvent.currency}${t.purse_left}L</div>
      </div>
      ${squad.length?`<div style="display:flex;flex-wrap:wrap;gap:4px">${squad.map(p=>`<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 9px;font-size:.75rem"><strong>${p.name}</strong> <span style="color:var(--text3)">${App.currentEvent.currency}${p.sold_amount}L</span></div>`).join('')}</div>`:`<div style="color:var(--text3);font-size:.78rem">No players purchased</div>`}
    </div>`;
  }).join('');
}

async function doExport(type) {
  try {
    const data = exportCache.players ? exportCache : await API.getExport(App.currentEvent.id);
    const {event,teams,players,history} = data;
    const cur = event.currency;
    let csv='',fn='';
    if (type==='sold') {
      csv=`Order,Player,Role,Base(${cur}L),Team,Sold Price(${cur}L)\n`;
      players.filter(p=>p.status==='sold').sort((a,b)=>a.auction_order-b.auction_order).forEach(p=>{const t=teams.find(x=>x.id===p.sold_to);csv+=`${p.auction_order},"${p.name}",${p.role},${p.base_price},"${t?.name||'?'}",${p.sold_amount}\n`;});
      fn=event.name.replace(/\s+/g,'_')+'_sold.csv';
    } else if (type==='unsold') {
      csv=`Order,Player,Role,Base(${cur}L)\n`;
      players.filter(p=>p.status==='unsold').sort((a,b)=>a.auction_order-b.auction_order).forEach(p=>{csv+=`${p.auction_order},"${p.name}",${p.role},${p.base_price}\n`;});
      fn=event.name.replace(/\s+/g,'_')+'_unsold.csv';
    } else if (type==='teams') {
      csv=`Team,Short,Purse Start,Spent,Remaining,Players,Squad\n`;
      teams.forEach(t=>{const sq=players.filter(p=>p.sold_to===t.id&&p.status==='sold');csv+=`"${t.name}",${t.short_name},${t.purse_start},${t.purse_start-t.purse_left},${t.purse_left},${sq.length},"${sq.map(p=>p.name).join('; ')}"\n`;});
      fn=event.name.replace(/\s+/g,'_')+'_teams.csv';
    } else if (type==='full') {
      csv=`Order,Player,Role,Base,Status,Team,Sold\n`;
      players.sort((a,b)=>a.auction_order-b.auction_order).forEach(p=>{const t=teams.find(x=>x.id===p.sold_to);csv+=`${p.auction_order},"${p.name}",${p.role},${p.base_price},${p.status},"${t?.name||''}",${p.sold_amount||''}\n`;});
      fn=event.name.replace(/\s+/g,'_')+'_full.csv';
    } else if (type==='history') {
      csv=`Player,Team,Amount,Action,Time\n`;
      history.forEach(h=>{const t=teams.find(x=>x.id===h.team_id);csv+=`"${h.player_name}","${t?.name||'?'}",${h.amount},${h.action},"${new Date(h.created_at*1000).toLocaleString()}"\n`;});
      fn=event.name.replace(/\s+/g,'_')+'_history.csv';
    }
    dlFile(csv,fn); toast('Download started','success');
  } catch(e) { toast(e.message,'error'); }
}

async function printResults() {
  try {
    const data = exportCache.players ? exportCache : await API.getExport(App.currentEvent.id);
    const {event,teams,players} = data;
    const cur=event.currency;
    const sold=players.filter(p=>p.status==='sold');
    const unsold=players.filter(p=>p.status==='unsold');
    const w=window.open('','_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>${event.name} Results</title><style>body{font-family:Arial,sans-serif;padding:2rem;max-width:950px;margin:0 auto}h1{color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:.4rem}h2{margin-top:1.5rem;color:#374151;font-size:1rem}table{width:100%;border-collapse:collapse;margin:.5rem 0;font-size:.82rem}th{background:#eff6ff;padding:6px 10px;text-align:left;font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;color:#1d4ed8}td{border:1px solid #e5e7eb;padding:6px 10px}.sq{display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;padding:2px 8px;border-radius:4px;font-size:.75rem;margin:2px}footer{color:#9ca3af;margin-top:1.5rem;font-size:.72rem;border-top:1px solid #e5e7eb;padding-top:.5rem}</style></head><body>
    <h1>${event.name} — Final Results</h1>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:1.5rem">
      ${[['Players',players.length],['Sold',sold.length],['Unsold',unsold.length],['Spent',cur+sold.reduce((s,p)=>s+(p.sold_amount||0),0)+'L']].map(([l,v])=>`<div style="border:1px solid #e5e7eb;border-radius:8px;padding:.6rem;text-align:center"><div style="font-size:.68rem;color:#6b7280">${l}</div><div style="font-size:1.4rem;font-weight:700">${v}</div></div>`).join('')}
    </div>
    <h2>Sold Players (${sold.length})</h2>
    <table><tr><th>#</th><th>Player</th><th>Role</th><th>Team</th><th>Base</th><th>Sold For</th></tr>
    ${sold.sort((a,b)=>a.auction_order-b.auction_order).map(p=>{const t=teams.find(x=>x.id===p.sold_to);return`<tr><td>${p.auction_order}</td><td><strong>${p.name}</strong></td><td>${p.role}</td><td>${t?.name||'?'}</td><td>${cur}${p.base_price}L</td><td><strong>${cur}${p.sold_amount}L</strong></td></tr>`;}).join('')}
    </table>
    <h2>Team Summary</h2>
    ${teams.map(t=>{const sq=players.filter(p=>p.sold_to===t.id&&p.status==='sold');const sp=sq.reduce((s,p)=>s+(p.sold_amount||0),0);return`<div style="margin:.5rem 0;padding:.75rem;border:1px solid #e5e7eb;border-left:3px solid ${t.color};border-radius:8px"><strong>${t.name}</strong> &nbsp;·&nbsp; ${cur}${t.purse_start}L start &nbsp;·&nbsp; ${cur}${sp}L spent &nbsp;·&nbsp; ${cur}${t.purse_left}L left &nbsp;·&nbsp; ${sq.length} players<br><div style="margin-top:.35rem">${sq.map(p=>`<span class="sq"><strong>${p.name}</strong> ${cur}${p.sold_amount}L</span>`).join('')||'<em style="color:#9ca3af">No players</em>'}</div></div>`;}).join('')}
    <h2>Unsold (${unsold.length})</h2><p style="color:#6b7280">${unsold.map(p=>p.name).join(', ')||'None'}</p>
    <footer>AuctionPro Live &nbsp;·&nbsp; ${event.name} &nbsp;·&nbsp; Generated: ${new Date().toLocaleString()}</footer>
    </body></html>`);
    w.document.close(); w.print();
  } catch(e) { toast(e.message,'error'); }
}
