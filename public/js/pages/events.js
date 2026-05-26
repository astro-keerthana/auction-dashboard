async function loadEventsPage() {
  const page = el('page-events');
  page.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Events</div><div class="page-subtitle">Manage your auction events</div></div>
      <button class="btn btn-primary" onclick="showCreateEventModal()">+ New Event</button>
    </div>
    <div id="events-list" style="display:grid;gap:.75rem"></div>`;
  await refreshEvents();
}

async function refreshEvents() {
  const list = el('events-list');
  if (!list) return;
  try {
    const events = await API.getEvents();
    if (!events.length) {
      list.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)">
        <div style="font-size:2rem;margin-bottom:.5rem">🏏</div>
        <div style="font-weight:600;margin-bottom:.25rem">No events yet</div>
        <div style="font-size:.82rem">Create your first auction event to get started</div>
      </div>`;
      return;
    }
    list.innerHTML = events.map(ev => {
      const statusColor = { draft: 'var(--text3)', live: 'var(--green)', paused: 'var(--amber)', ended: 'var(--red)' }[ev.status] || 'var(--text3)';
      const statusLabel = { draft: 'Draft', live: 'Live', paused: 'Paused', ended: 'Ended' }[ev.status] || ev.status;
      const isCurrent = App.currentEvent?.id === ev.id;
      return `<div class="card" style="padding:1rem;${isCurrent ? 'border-color:var(--blue);box-shadow:0 0 0 3px rgba(37,99,235,.1)' : ''}">
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <div style="width:44px;height:44px;border-radius:10px;background:${ev.brand_color}18;border:1px solid ${ev.brand_color}40;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
            ${ev.logo_url ? `<img src="${ev.logo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:9px" onerror="this.style.display='none'">` : `<span style="font-family:var(--font-head);font-weight:700;font-size:.9rem;color:${ev.brand_color}">${ev.name.charAt(0)}</span>`}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.95rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ev.name}</div>
            <div style="font-size:.75rem;color:var(--text3);margin-top:1px">${ev.date || 'No date set'} · ${ev.currency || '₹'} · by ${ev.creator_name || 'System'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div class="status-live"><div class="status-dot ${ev.status}"></div><span style="font-size:.75rem;font-weight:600;color:${statusColor}">${statusLabel}</span></div>
            ${isCurrent ? `<span class="badge b-blue">Active</span>` : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="selectEvent(${ev.id})">
              ${isCurrent ? '✓ Selected' : 'Select'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="showEditEventModal(${ev.id})">Edit</button>
            ${App.user?.role === 'superadmin' ? `
            <button class="btn btn-secondary btn-sm" onclick="showEventAccessModal(${ev.id})">Access</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvent(${ev.id})">Delete</button>` : ''}
          </div>
        </div>
        ${isCurrent ? `<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="navTo('admin')">⚡ Auction Control</button>
          <button class="btn btn-secondary btn-sm" onclick="navTo('setup')">⚙ Event Setup</button>
          <button class="btn btn-secondary btn-sm" onclick="navTo('live')">📺 Live Display</button>
          <button class="btn btn-secondary btn-sm" onclick="navTo('export')">⬇ Export</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function selectEvent(id) {
  try {
    const ev = await API.getEvent(id);
    App.setEvent(ev);
    await refreshEvents();
    toast(`Event selected: ${ev.name}`, 'success');
  } catch (e) { toast(e.message, 'error'); }
}

function showCreateEventModal() {
  modal(`<div class="modal">
    <div class="modal-hd">Create New Event</div>
    <div class="fg"><label>Event Name</label><input id="m-en" type="text" placeholder="e.g. RPL 2026" style="width:100%"></div>
    <div class="fg-row">
      <div class="fg"><label>Date</label><input id="m-ed" type="text" placeholder="2026-01-15" style="width:100%"></div>
      <div class="fg"><label>Currency</label><input id="m-ec" type="text" value="₹" style="width:100%"></div>
    </div>
    <div class="fg"><label>Tournament Logo URL (optional)</label><input id="m-el" type="text" placeholder="https://..." style="width:100%"></div>
    <div class="fg"><label>Brand Color</label><input id="m-ebr" type="color" value="#2563eb" style="width:100%;height:36px"></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createEvent()">Create Event</button>
    </div>
  </div>`);
  setTimeout(() => el('m-en')?.focus(), 50);
}

async function createEvent() {
  const name = el('m-en').value.trim();
  if (!name) { toast('Event name required', 'error'); return; }
  try {
    const ev = await API.createEvent({ name, date: el('m-ed').value, currency: el('m-ec').value, logo_url: el('m-el').value, brand_color: el('m-ebr').value });
    closeModal();
    App.setEvent(ev);
    await refreshEvents();
    toast('Event created!', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function showEditEventModal(id) {
  const ev = await API.getEvent(id);
  modal(`<div class="modal">
    <div class="modal-hd">Edit Event</div>
    <div class="fg"><label>Event Name</label><input id="m-en" type="text" value="${ev.name}" style="width:100%"></div>
    <div class="fg-row">
      <div class="fg"><label>Date</label><input id="m-ed" type="text" value="${ev.date||''}" style="width:100%"></div>
      <div class="fg"><label>Currency</label><input id="m-ec" type="text" value="${ev.currency||'₹'}" style="width:100%"></div>
    </div>
    <div class="fg"><label>Logo URL</label><input id="m-el" type="text" value="${ev.logo_url||''}" style="width:100%"></div>
    <div class="fg"><label>Brand Color</label><input id="m-ebr" type="color" value="${ev.brand_color||'#2563eb'}" style="width:100%;height:36px"></div>
    <div class="fg"><label>Status</label><select id="m-est" style="width:100%">
      ${['draft','live','paused','ended'].map(s=>`<option${ev.status===s?' selected':''}>${s}</option>`).join('')}
    </select></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateEvent(${id})">Save Changes</button>
    </div>
  </div>`);
}

async function updateEvent(id) {
  try {
    await API.updateEvent(id, { name: el('m-en').value, date: el('m-ed').value, currency: el('m-ec').value, logo_url: el('m-el').value, brand_color: el('m-ebr').value, status: el('m-est').value });
    closeModal();
    if (App.currentEvent?.id === id) { const ev = await API.getEvent(id); App.setEvent(ev); }
    await refreshEvents();
    toast('Event updated', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event and all its data? This cannot be undone.')) return;
  try {
    await API.deleteEvent(id);
    if (App.currentEvent?.id === id) App.setEvent(null);
    await refreshEvents();
    toast('Event deleted', 'info');
  } catch (e) { toast(e.message, 'error'); }
}

async function showEventAccessModal(eventId) {
  let users = [], access = [];
  try { [users, access] = await Promise.all([API.getUsers(), API.getEventAccess(eventId)]); } catch (e) { toast(e.message, 'error'); return; }
  const accessMap = {};
  access.forEach(a => { accessMap[a.user_id] = a.permission; });
  const nonAdmins = users.filter(u => u.role !== 'superadmin');
  modal(`<div class="modal">
    <div class="modal-hd">Event Access Control</div>
    <div class="card-hd" style="margin-bottom:.5rem">Assign user access to this event</div>
    ${nonAdmins.map(u => `<div style="display:flex;align-items:center;gap:.6rem;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><div style="font-size:.82rem;font-weight:600">${u.full_name}</div><div style="font-size:.7rem;color:var(--text3)">@${u.username}</div></div>
      <select id="acc-${u.id}" style="font-size:.78rem;padding:4px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--white);width:100px">
        <option value="">No Access</option>
        <option value="viewer"${accessMap[u.id]==='viewer'?' selected':''}>Viewer</option>
        <option value="operator"${accessMap[u.id]==='operator'?' selected':''}>Operator</option>
        <option value="admin"${accessMap[u.id]==='admin'?' selected':''}>Admin</option>
      </select>
    </div>`).join('')}
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="saveEventAccess(${eventId}, [${nonAdmins.map(u=>u.id).join(',')}])">Save Access</button>
    </div>
  </div>`);
}

async function saveEventAccess(eventId, userIds) {
  try {
    await Promise.all(userIds.map(async uid => {
      const perm = el(`acc-${uid}`)?.value;
      if (perm) { await API.grantAccess(eventId, uid, perm); }
      else { try { await API.revokeAccess(eventId, uid); } catch {} }
    }));
    closeModal();
    toast('Access saved', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
