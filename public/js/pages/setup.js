let setupData = { teams: [], players: [] };

async function loadSetupPage() {
  const page = el('page-setup');
  if (!App.currentEvent) {
    page.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)"><div style="font-size:1.5rem;margin-bottom:.5rem">⚙</div><div>Please select an event first</div><button class="btn btn-primary" style="margin-top:1rem" onclick="navTo('events')">Go to Events</button></div>`;
    return;
  }
  page.innerHTML = renderSetupHTML();
  await refreshSetupData();
}

function renderSetupHTML() {
  const ev = App.currentEvent;
  return `
  <div style="display:flex;flex-direction:column;gap:1rem;flex:1">
    <div class="page-header" style="margin-bottom:0">
      <div><div class="page-title">Event Setup</div><div class="page-subtitle">${ev.name}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="showEventSettingsModal()">⚙ Event Settings</button>
        <button class="btn btn-danger btn-sm" onclick="confirmResetAuction()">↺ Reset Auction</button>
      </div>
    </div>
    <div class="card" style="padding:1rem">
      <div class="sec-title">📋 Bulk Import</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div>
          <div style="font-size:.75rem;font-weight:600;color:var(--text2);margin-bottom:.4rem">Players CSV</div>
          <div class="import-zone" onclick="el('csv-players').click()">
            <div class="iz-icon">📥</div><div class="iz-title">Import Players</div>
            <div class="iz-sub">Name, Role, Base Price, Order, Photo URL</div>
          </div>
          <input type="file" id="csv-players" accept=".csv" style="display:none" onchange="importPlayersCSV(event)">
        </div>
        <div>
          <div style="font-size:.75rem;font-weight:600;color:var(--text2);margin-bottom:.4rem">Teams CSV</div>
          <div class="import-zone" onclick="el('csv-teams').click()">
            <div class="iz-icon">📥</div><div class="iz-title">Import Teams</div>
            <div class="iz-sub">Name, Short, Purse, Max Players, Color, Logo URL</div>
          </div>
          <input type="file" id="csv-teams" accept=".csv" style="display:none" onchange="importTeamsCSV(event)">
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:.75rem;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="dlPlayerTemplate()">⬇ Players Template</button>
        <button class="btn btn-secondary btn-sm" onclick="dlTeamsTemplate()">⬇ Teams Template</button>
        <button class="btn btn-secondary btn-sm" onclick="loadSampleEventData()">🏏 Load Sample Data</button>
      </div>
      <div style="margin-top:.6rem;font-size:.72rem;color:var(--text3);line-height:1.7">
        <strong style="color:var(--text2)">Players:</strong> Name, Role, Base Price (L), Auction Order, Photo URL &nbsp;|&nbsp;
        <strong style="color:var(--text2)">Teams:</strong> Name, Short Name, Purse (L), Max Players, Color (#hex), Logo URL
      </div>
    </div>
    <div class="card" style="padding:1rem">
      <div class="sec-title">
        <span>👥 Teams <span id="setup-team-count" style="font-size:.8rem;color:var(--text3);font-weight:400"></span></span>
        <button class="btn btn-primary btn-sm" onclick="showTeamModal(null)">+ Add Team</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th></th><th>Team Name</th><th>Short</th><th>Purse Start</th><th>Purse Left</th><th>Players</th><th>Max</th><th>Color</th><th>Logo URL</th><th>Actions</th></tr></thead>
        <tbody id="setup-teams-tbody"></tbody>
      </table></div>
    </div>
    <div class="card" style="padding:1rem">
      <div class="sec-title">
        <span>🏏 Players <span id="setup-player-count" style="font-size:.8rem;color:var(--text3);font-weight:400"></span></span>
        <div style="display:flex;gap:6px">
          <select id="setup-role-filter" style="font-size:.75rem;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);outline:none" onchange="renderSetupPlayersTable()">
            <option value="">All Roles</option><option>Batsman</option><option>Bowler</option><option>All-Rounder</option><option>Wicket-Keeper</option>
          </select>
          <button class="btn btn-primary btn-sm" onclick="showPlayerModal(null)">+ Add Player</button>
        </div>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>#</th><th>Ord</th><th>Photo</th><th>Player Name</th><th>Role</th><th>Base Price</th><th>Status</th><th>Sold To</th><th>Sold For</th><th>Actions</th></tr></thead>
        <tbody id="setup-players-tbody"></tbody>
      </table></div>
    </div>
  </div>`;
}

async function refreshSetupData() {
  if (!App.currentEvent) return;
  try {
    [setupData.teams, setupData.players] = await Promise.all([API.getTeams(App.currentEvent.id), API.getPlayers(App.currentEvent.id)]);
    renderSetupTeamsTable(); renderSetupPlayersTable();
  } catch (e) { toast(e.message, 'error'); }
}

function renderSetupTeamsTable() {
  const tbody = el('setup-teams-tbody'); if (!tbody) return;
  set('setup-team-count', `(${setupData.teams.length})`);
  if (!setupData.teams.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:1.5rem">No teams yet. Add a team or import from CSV.</td></tr>`; return; }
  tbody.innerHTML = setupData.teams.map(t => {
    const soldCount = setupData.players.filter(p=>p.sold_to===t.id&&p.status==='sold').length;
    return `<tr>
      <td><div class="logo-preview" style="background:${t.color}18;color:${t.color}">${t.logo_url?`<img src="${t.logo_url}" onerror="this.style.display='none'">`:t.short_name}</div></td>
      <td><strong>${t.name}</strong></td><td>${t.short_name}</td>
      <td>${App.currentEvent.currency}${t.purse_start}L</td>
      <td style="color:${t.purse_left<100?'var(--red)':t.purse_left<t.purse_start*0.3?'var(--amber)':'var(--green)'}">${App.currentEvent.currency}${t.purse_left}L</td>
      <td>${soldCount}</td><td>${t.max_players}</td>
      <td><div style="width:18px;height:18px;border-radius:4px;background:${t.color}"></div></td>
      <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.7rem;color:var(--text3)">${t.logo_url||'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm" onclick="showTeamModal(${t.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTeam(${t.id})">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

function renderSetupPlayersTable() {
  const tbody = el('setup-players-tbody'); if (!tbody) return;
  const rf = el('setup-role-filter')?.value||'';
  let players = [...setupData.players].sort((a,b)=>a.auction_order-b.auction_order);
  if (rf) players = players.filter(p=>p.role===rf);
  set('setup-player-count', `(${players.length}/${setupData.players.length})`);
  if (!players.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:1.5rem">No players yet.</td></tr>`; return; }
  tbody.innerHTML = players.map((p,i)=>{
    const team = setupData.teams.find(t=>t.id===p.sold_to);
    const statusHtml = p.status==='sold'?`<span class="badge b-green">SOLD</span>`:p.status==='unsold'?`<span class="badge b-red">UNSOLD</span>`:`<span class="badge b-gray">Pending</span>`;
    return `<tr>
      <td style="color:var(--text3)">${i+1}</td><td>${p.auction_order}</td>
      <td><div class="photo-preview" style="color:${roleColor(p.role)}">${p.photo_url?`<img src="${p.photo_url}" onerror="this.style.display='none'">`:p.name.charAt(0)}</div></td>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge" style="background:${roleColor(p.role)}15;color:${roleColor(p.role)}">${p.role}</span></td>
      <td>${App.currentEvent.currency}${p.base_price}L</td><td>${statusHtml}</td>
      <td style="font-size:.78rem">${team?team.name:'—'}</td>
      <td style="font-size:.78rem">${p.sold_amount?App.currentEvent.currency+p.sold_amount+'L':'—'}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm" onclick="showPlayerModal(${p.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePlayer(${p.id})">Del</button>
      </div></td>
    </tr>`;
  }).join('');
}

let editTeamId=null;
function showTeamModal(id){
  editTeamId=id;
  const t=id?setupData.teams.find(x=>x.id===id):null;
  const defColor=t?.color||['#2563eb','#dc2626','#16a34a','#d97706','#7c3aed','#db2777','#0891b2','#ea580c'][setupData.teams.length%8];
  modal(`<div class="modal">
    <div class="modal-hd">${id?'Edit':'Add'} Team</div>
    <div class="fg"><label>Team Name</label><input id="m-tn" type="text" value="${t?.name||''}" placeholder="e.g. Royal Knights" style="width:100%"></div>
    <div class="fg-row">
      <div class="fg"><label>Short Name (2-3 chars)</label><input id="m-ts" type="text" value="${t?.short_name||''}" maxlength="3" style="width:100%"></div>
      <div class="fg"><label>Team Color</label><input id="m-tc" type="color" value="${defColor}" style="width:100%;height:36px;padding:2px"></div>
    </div>
    <div class="fg-row">
      <div class="fg"><label>Starting Purse (Lakhs)</label><input id="m-tp" type="number" value="${t?.purse_start||800}" style="width:100%"></div>
      <div class="fg"><label>Max Players</label><input id="m-tm" type="number" value="${t?.max_players||15}" style="width:100%"></div>
    </div>
    <div class="fg"><label>Team Logo URL (optional)</label><input id="m-tl" type="text" value="${t?.logo_url||''}" placeholder="https://..." style="width:100%"></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTeam()">Save Team</button>
    </div>
  </div>`);
  setTimeout(()=>el('m-tn')?.focus(),50);
}

async function saveTeam(){
  const name=el('m-tn').value.trim(); if(!name){toast('Team name required','error');return;}
  const data={name,short_name:el('m-ts').value.trim()||name.slice(0,2),color:el('m-tc').value,purse_start:parseInt(el('m-tp').value)||800,max_players:parseInt(el('m-tm').value)||15,logo_url:el('m-tl').value.trim()};
  try{
    if(editTeamId){await API.updateTeam(App.currentEvent.id,editTeamId,data);}
    else{await API.createTeam(App.currentEvent.id,data);}
    closeModal();await refreshSetupData();toast('Team saved','success');
  }catch(e){toast(e.message,'error');}
}

async function deleteTeam(id){
  if(!confirm('Delete this team?'))return;
  try{await API.deleteTeam(App.currentEvent.id,id);await refreshSetupData();toast('Team deleted','info');}
  catch(e){toast(e.message,'error');}
}

let editPlayerId=null;
function showPlayerModal(id){
  editPlayerId=id;
  const p=id?setupData.players.find(x=>x.id===id):null;
  const roles=['Batsman','Bowler','All-Rounder','Wicket-Keeper'];
  modal(`<div class="modal">
    <div class="modal-hd">${id?'Edit':'Add'} Player</div>
    <div class="fg"><label>Player Name</label><input id="m-pn" type="text" value="${p?.name||''}" placeholder="Full name" style="width:100%"></div>
    <div class="fg-row">
      <div class="fg"><label>Role</label><select id="m-pr" style="width:100%">${roles.map(r=>`<option${p?.role===r?' selected':''}>${r}</option>`).join('')}</select></div>
      <div class="fg"><label>Base Price (Lakhs)</label><input id="m-pb" type="number" value="${p?.base_price||50}" style="width:100%"></div>
    </div>
    <div class="fg-row">
      <div class="fg"><label>Auction Order</label><input id="m-po" type="number" value="${p?.auction_order||(setupData.players.length+1)}" style="width:100%"></div>
      <div class="fg"><label>Notes (optional)</label><input id="m-pnotes" type="text" value="${p?.notes||''}" style="width:100%"></div>
    </div>
    <div class="fg"><label>Photo URL (optional)</label><input id="m-pp" type="text" value="${p?.photo_url||''}" placeholder="https://..." style="width:100%"></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePlayer()">Save Player</button>
    </div>
  </div>`);
  setTimeout(()=>el('m-pn')?.focus(),50);
}

async function savePlayer(){
  const name=el('m-pn').value.trim(); if(!name){toast('Player name required','error');return;}
  const data={name,role:el('m-pr').value,base_price:parseInt(el('m-pb').value)||50,auction_order:parseInt(el('m-po').value)||1,photo_url:el('m-pp').value.trim(),notes:el('m-pnotes').value.trim()};
  try{
    if(editPlayerId){await API.updatePlayer(App.currentEvent.id,editPlayerId,data);}
    else{await API.createPlayer(App.currentEvent.id,data);}
    closeModal();await refreshSetupData();toast('Player saved','success');
  }catch(e){toast(e.message,'error');}
}

async function deletePlayer(id){
  if(!confirm('Delete this player?'))return;
  try{await API.deletePlayer(App.currentEvent.id,id);await refreshSetupData();toast('Player deleted','info');}
  catch(e){toast(e.message,'error');}
}

function importPlayersCSV(e){
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const lines=ev.target.result.split('\n').map(l=>l.trim()).filter(l=>l);
    const rows=lines.slice(1).map(parseCSVLine);
    const players=rows.filter(r=>r[0]).map((r,i)=>({name:r[0],role:r[1]||'Batsman',base_price:parseInt(r[2])||50,auction_order:parseInt(r[3])||(setupData.players.length+i+1),photo_url:r[4]||''}));
    if(!players.length){toast('No valid rows found','error');return;}
    try{await API.bulkPlayers(App.currentEvent.id,players);await refreshSetupData();toast(`Imported ${players.length} players`,'success');}
    catch(e){toast(e.message,'error');}
  };
  reader.readAsText(file); e.target.value='';
}

function importTeamsCSV(e){
  const file=e.target.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const lines=ev.target.result.split('\n').map(l=>l.trim()).filter(l=>l);
    const rows=lines.slice(1).map(parseCSVLine);
    const teams=rows.filter(r=>r[0]).map(r=>({name:r[0],short_name:r[1]||r[0].slice(0,2),purse_start:parseInt(r[2])||800,max_players:parseInt(r[3])||15,color:r[4]||'#2563eb',logo_url:r[5]||''}));
    if(!teams.length){toast('No valid rows found','error');return;}
    try{await API.bulkTeams(App.currentEvent.id,teams);await refreshSetupData();toast(`Imported ${teams.length} teams`,'success');}
    catch(e){toast(e.message,'error');}
  };
  reader.readAsText(file); e.target.value='';
}

function dlPlayerTemplate(){dlFile(`Name,Role,Base Price (L),Auction Order,Photo URL\nAshan Perera,Batsman,100,1,\nKamal Silva,Bowler,80,2,\nNuwan Fernando,All-Rounder,150,3,\n`,'players_template.csv');toast('Downloaded','info');}
function dlTeamsTemplate(){dlFile(`Name,Short Name,Purse (L),Max Players,Color (#hex),Logo URL\nRoyal Knights,RK,800,15,#2563eb,\nStorm Eagles,SE,800,15,#dc2626,\n`,'teams_template.csv');toast('Downloaded','info');}

async function loadSampleEventData(){
  if(!confirm('Add sample teams and players?'))return;
  const eid=App.currentEvent.id;
  try{
    await API.bulkTeams(eid,[
      {name:'Royal Knights',short_name:'RK',color:'#2563eb',purse_start:800,max_players:15,logo_url:''},
      {name:'Storm Eagles',short_name:'SE',color:'#dc2626',purse_start:800,max_players:15,logo_url:''},
      {name:'Thunder Wolves',short_name:'TW',color:'#16a34a',purse_start:800,max_players:15,logo_url:''},
      {name:'Golden Lions',short_name:'GL',color:'#d97706',purse_start:800,max_players:15,logo_url:''},
    ]);
    await API.bulkPlayers(eid,[
      {name:'Ashan Perera',role:'Batsman',base_price:100,auction_order:1,photo_url:''},
      {name:'Kamal Silva',role:'Bowler',base_price:80,auction_order:2,photo_url:''},
      {name:'Nuwan Fernando',role:'All-Rounder',base_price:150,auction_order:3,photo_url:''},
      {name:'Dimuth Ranasinghe',role:'Wicket-Keeper',base_price:120,auction_order:4,photo_url:''},
      {name:'Lakshan Gamage',role:'Batsman',base_price:75,auction_order:5,photo_url:''},
      {name:'Charith Asalanka',role:'All-Rounder',base_price:200,auction_order:6,photo_url:''},
      {name:'Pasindu Jayasuriya',role:'Bowler',base_price:90,auction_order:7,photo_url:''},
      {name:'Harsha Bandara',role:'Batsman',base_price:60,auction_order:8,photo_url:''},
      {name:'Shehan Madushanka',role:'All-Rounder',base_price:110,auction_order:9,photo_url:''},
      {name:'Vishwa Fernando',role:'Bowler',base_price:180,auction_order:10,photo_url:''},
      {name:'Kusal Mendis',role:'Wicket-Keeper',base_price:220,auction_order:11,photo_url:''},
      {name:'Chamika Karunaratne',role:'All-Rounder',base_price:130,auction_order:12,photo_url:''},
    ]);
    await refreshSetupData(); toast('Sample data loaded!','success');
  }catch(e){toast(e.message,'error');}
}

function showEventSettingsModal(){
  const ev=App.currentEvent;
  modal(`<div class="modal">
    <div class="modal-hd">Event Settings</div>
    <div class="fg"><label>Event Name</label><input id="es-name" type="text" value="${ev.name}" style="width:100%"></div>
    <div class="fg-row">
      <div class="fg"><label>Date</label><input id="es-date" type="text" value="${ev.date||''}" style="width:100%"></div>
      <div class="fg"><label>Currency Symbol</label><input id="es-cur" type="text" value="${ev.currency||'₹'}" style="width:100%"></div>
    </div>
    <div class="fg"><label>Tournament Logo URL</label><input id="es-logo" type="text" value="${ev.logo_url||''}" style="width:100%"></div>
    <div class="fg"><label>Brand / Accent Color</label><input id="es-color" type="color" value="${ev.brand_color||'#2563eb'}" style="width:100%;height:36px;padding:2px"></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEventSettings()">Save Settings</button>
    </div>
  </div>`);
}

async function saveEventSettings(){
  try{
    const updates={name:el('es-name').value,date:el('es-date').value,currency:el('es-cur').value,logo_url:el('es-logo').value,brand_color:el('es-color').value,status:App.currentEvent.status};
    await API.updateEvent(App.currentEvent.id,updates);
    Object.assign(App.currentEvent,updates);
    set('sb-event-name',updates.name);
    closeModal();toast('Settings saved','success');
  }catch(e){toast(e.message,'error');}
}

async function confirmResetAuction(){
  if(!confirm('Reset all auction results? This clears sold/unsold status and restores all purses. Cannot be undone.'))return;
  try{await API.resetPlayers(App.currentEvent.id);await refreshSetupData();toast('Auction reset','warn');}
  catch(e){toast(e.message,'error');}
}
