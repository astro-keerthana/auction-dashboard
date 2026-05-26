async function loadUsersPage() {
  const page = el('page-users');
  if (App.user?.role !== 'superadmin') { page.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text3)">Access denied</div>`; return; }
  page.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Users</div><div class="page-subtitle">Manage operator accounts and access</div></div>
      <button class="btn btn-primary" onclick="showCreateUserModal()">+ New User</button>
    </div>
    <div class="card" style="padding:1rem;margin-bottom:1rem">
      <div style="font-size:.8rem;color:var(--text2);line-height:1.7">
        <strong>Super Admin</strong> — Full system access, can manage all events and users.<br>
        <strong>Operator</strong> — Must be granted access per event via Events → Access button.
      </div>
    </div>
    <div class="card"><div class="tbl-wrap"><table>
      <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead>
      <tbody id="users-tbody"></tbody>
    </table></div></div>`;
  await refreshUsers();
}

async function refreshUsers() {
  const tbody = el('users-tbody'); if (!tbody) return;
  try {
    const users = await API.getUsers();
    tbody.innerHTML = users.map(u=>`<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div style="width:28px;height:28px;border-radius:50%;background:${u.role==='superadmin'?'var(--blue)':'var(--bg2)'};color:${u.role==='superadmin'?'#fff':'var(--text3)'};display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;border:1px solid var(--border)">${u.full_name.charAt(0).toUpperCase()}</div>
        <strong>${u.full_name}</strong>
      </div></td>
      <td style="color:var(--text2)">@${u.username}</td>
      <td>${u.role==='superadmin'?`<span class="badge b-blue">Super Admin</span>`:`<span class="badge b-gray">Operator</span>`}</td>
      <td style="color:var(--text3);font-size:.78rem">${new Date(u.created_at*1000).toLocaleDateString()}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn btn-secondary btn-sm" onclick="showEditUserModal(${u.id},'${u.username}','${u.full_name.replace(/'/g,"\\'")}','${u.role}')">Edit</button>
        ${u.id!==App.user.id?`<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${u.full_name.replace(/'/g,"\\'")}')">Delete</button>`:`<span class="badge b-gray">You</span>`}
      </div></td>
    </tr>`).join('');
  } catch(e) { toast(e.message,'error'); }
}

function showCreateUserModal() {
  modal(`<div class="modal">
    <div class="modal-hd">Create User Account</div>
    <div class="fg"><label>Full Name</label><input id="m-ufn" type="text" placeholder="e.g. Kamal Perera" style="width:100%"></div>
    <div class="fg"><label>Username (lowercase)</label><input id="m-uun" type="text" placeholder="e.g. kamal" style="width:100%"></div>
    <div class="fg"><label>Password (min 6 characters)</label><input id="m-upw" type="password" style="width:100%"></div>
    <div class="fg"><label>Role</label><select id="m-urol" style="width:100%"><option value="operator" selected>Operator</option><option value="superadmin">Super Admin</option></select></div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:.7rem;font-size:.75rem;color:var(--text2);margin-bottom:.25rem">After creating, go to <strong>Events → Access</strong> to assign this user to events.</div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createUser()">Create User</button>
    </div>
  </div>`);
  setTimeout(()=>el('m-ufn')?.focus(),50);
}

async function createUser() {
  const full_name=el('m-ufn').value.trim(), username=el('m-uun').value.trim().toLowerCase(), password=el('m-upw').value, role=el('m-urol').value;
  if (!full_name||!username||!password) { toast('All fields required','error'); return; }
  if (password.length<6) { toast('Password min 6 characters','error'); return; }
  try { await API.createUser({full_name,username,password,role}); closeModal(); await refreshUsers(); toast(`User ${full_name} created`,'success'); }
  catch(e) { toast(e.message,'error'); }
}

function showEditUserModal(id,username,full_name,role) {
  modal(`<div class="modal">
    <div class="modal-hd">Edit User</div>
    <div class="fg"><label>Full Name</label><input id="m-ufn" type="text" value="${full_name}" style="width:100%"></div>
    <div class="fg"><label>Username</label><input type="text" value="${username}" disabled style="width:100%;opacity:.5"></div>
    <div class="fg"><label>New Password (leave blank to keep)</label><input id="m-upw" type="password" placeholder="Leave blank to keep current" style="width:100%"></div>
    <div class="fg"><label>Role</label><select id="m-urol" style="width:100%"><option value="operator"${role==='operator'?' selected':''}>Operator</option><option value="superadmin"${role==='superadmin'?' selected':''}>Super Admin</option></select></div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="updateUser(${id})">Save Changes</button>
    </div>
  </div>`);
}

async function updateUser(id) {
  const full_name=el('m-ufn').value.trim(), role=el('m-urol').value, password=el('m-upw').value;
  if (!full_name) { toast('Full name required','error'); return; }
  const data={full_name,role}; if (password) { if(password.length<6){toast('Password min 6 characters','error');return;} data.password=password; }
  try { await API.updateUser(id,data); closeModal(); await refreshUsers(); toast('User updated','success'); }
  catch(e) { toast(e.message,'error'); }
}

async function deleteUser(id,name) {
  if (!confirm(`Delete user "${name}"?`)) return;
  try { await API.deleteUser(id); await refreshUsers(); toast('User deleted','info'); }
  catch(e) { toast(e.message,'error'); }
}
