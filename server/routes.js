const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, requireAuth, requireSuperAdmin, requireEventAccess } = require('./auth');

const router = express.Router();

// ────────────────────────────────────────
//  AUTH
// ────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const db = req.app.get('db');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ id: user.id, username: user.username, role: user.role, full_name: user.full_name });
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
});

router.get('/auth/me', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const user = db.prepare('SELECT id, username, full_name, role, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ────────────────────────────────────────
//  USERS (superadmin only)
// ────────────────────────────────────────
router.get('/users', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  const users = db.prepare('SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at').all();
  res.json(users);
});

router.post('/users', requireSuperAdmin, (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: 'username, password, full_name required' });
  const db = req.app.get('db');
  const hash = bcrypt.hashSync(password, 10);
  try {
    const result = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
      .run(username.trim().toLowerCase(), hash, full_name, role || 'operator');
    res.json({ id: result.lastInsertRowid, username, full_name, role: role || 'operator' });
  } catch (e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

router.put('/users/:id', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  const { full_name, role, password } = req.body;
  if (password) {
    db.prepare('UPDATE users SET full_name=?, role=?, password_hash=? WHERE id=?')
      .run(full_name, role, bcrypt.hashSync(password, 10), req.params.id);
  } else {
    db.prepare('UPDATE users SET full_name=?, role=? WHERE id=?').run(full_name, role, req.params.id);
  }
  res.json({ ok: true });
});

router.delete('/users/:id', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ────────────────────────────────────────
//  EVENTS
// ────────────────────────────────────────
router.get('/events', requireAuth, (req, res) => {
  const db = req.app.get('db');
  let events;
  if (req.user.role === 'superadmin') {
    events = db.prepare(`SELECT e.*, u.full_name as creator_name FROM events e LEFT JOIN users u ON e.created_by=u.id ORDER BY e.created_at DESC`).all();
  } else {
    events = db.prepare(`SELECT e.*, ea.permission, u.full_name as creator_name FROM events e JOIN event_access ea ON e.id=ea.event_id LEFT JOIN users u ON e.created_by=u.id WHERE ea.user_id=? ORDER BY e.created_at DESC`).all(req.user.id);
  }
  res.json(events);
});

router.get('/events/:eventId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const event = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (req.user.role !== 'superadmin') {
    const access = db.prepare('SELECT permission FROM event_access WHERE event_id=? AND user_id=?').get(event.id, req.user.id);
    if (!access) return res.status(403).json({ error: 'No access' });
  }
  res.json(event);
});

router.post('/events', requireAuth, (req, res) => {
  const db = req.app.get('db');
  if (req.user.role !== 'superadmin') {
    const access = db.prepare('SELECT ea.permission FROM event_access ea WHERE ea.user_id=?').get(req.user.id);
    if (!access || access.permission !== 'admin') return res.status(403).json({ error: 'Need admin permission to create events' });
  }
  const { name, date, currency, logo_url, brand_color } = req.body;
  if (!name) return res.status(400).json({ error: 'Event name required' });
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  const result = db.prepare('INSERT INTO events (name, slug, date, currency, logo_url, brand_color, created_by) VALUES (?,?,?,?,?,?,?)')
    .run(name, slug, date || '', currency || '₹', logo_url || '', brand_color || '#2563eb', req.user.id);
  db.prepare('INSERT OR IGNORE INTO auction_state (event_id) VALUES (?)').run(result.lastInsertRowid);
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(result.lastInsertRowid);
  res.json(ev);
});

router.put('/events/:eventId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { name, date, currency, logo_url, brand_color, status } = req.body;
  db.prepare('UPDATE events SET name=?,date=?,currency=?,logo_url=?,brand_color=?,status=?,updated_at=unixepoch() WHERE id=?')
    .run(name, date, currency, logo_url, brand_color, status, req.params.eventId);
  res.json({ ok: true });
});

router.delete('/events/:eventId', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.eventId);
  res.json({ ok: true });
});

// Event access management
router.get('/events/:eventId/access', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const rows = db.prepare(`SELECT ea.*, u.username, u.full_name, u.role as user_role FROM event_access ea JOIN users u ON ea.user_id=u.id WHERE ea.event_id=?`).all(req.params.eventId);
  res.json(rows);
});

router.post('/events/:eventId/access', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  const { user_id, permission } = req.body;
  db.prepare('INSERT OR REPLACE INTO event_access (event_id, user_id, permission) VALUES (?,?,?)').run(req.params.eventId, user_id, permission || 'operator');
  res.json({ ok: true });
});

router.delete('/events/:eventId/access/:userId', requireSuperAdmin, (req, res) => {
  const db = req.app.get('db');
  db.prepare('DELETE FROM event_access WHERE event_id=? AND user_id=?').run(req.params.eventId, req.params.userId);
  res.json({ ok: true });
});

// ────────────────────────────────────────
//  TEAMS
// ────────────────────────────────────────
router.get('/events/:eventId/teams', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const teams = db.prepare('SELECT * FROM teams WHERE event_id=? ORDER BY display_order, id').all(req.params.eventId);
  res.json(teams);
});

router.post('/events/:eventId/teams', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { name, short_name, color, logo_url, purse_start, max_players, display_order } = req.body;
  if (!name || !short_name) return res.status(400).json({ error: 'name and short_name required' });
  const purse = parseInt(purse_start) || 800;
  const result = db.prepare('INSERT INTO teams (event_id,name,short_name,color,logo_url,purse_start,purse_left,max_players,display_order) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(req.params.eventId, name, short_name.toUpperCase().slice(0,3), color||'#2563eb', logo_url||'', purse, purse, parseInt(max_players)||15, parseInt(display_order)||0);
  res.json(db.prepare('SELECT * FROM teams WHERE id=?').get(result.lastInsertRowid));
});

router.put('/events/:eventId/teams/:teamId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { name, short_name, color, logo_url, purse_start, max_players } = req.body;
  const team = db.prepare('SELECT * FROM teams WHERE id=? AND event_id=?').get(req.params.teamId, req.params.eventId);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  const newPurse = parseInt(purse_start) || team.purse_start;
  const diff = newPurse - team.purse_start;
  db.prepare('UPDATE teams SET name=?,short_name=?,color=?,logo_url=?,purse_start=?,purse_left=?,max_players=? WHERE id=?')
    .run(name, short_name?.toUpperCase().slice(0,3)||team.short_name, color||team.color, logo_url!==undefined?logo_url:team.logo_url, newPurse, team.purse_left+diff, parseInt(max_players)||team.max_players, req.params.teamId);
  res.json({ ok: true });
});

router.delete('/events/:eventId/teams/:teamId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  db.prepare('DELETE FROM teams WHERE id=? AND event_id=?').run(req.params.teamId, req.params.eventId);
  res.json({ ok: true });
});

// Bulk import teams
router.post('/events/:eventId/teams/bulk', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { teams } = req.body;
  if (!Array.isArray(teams)) return res.status(400).json({ error: 'teams array required' });
  const insert = db.prepare('INSERT INTO teams (event_id,name,short_name,color,logo_url,purse_start,purse_left,max_players,display_order) VALUES (?,?,?,?,?,?,?,?,?)');
  const txn = db.transaction(() => {
    teams.forEach((t, i) => {
      const purse = parseInt(t.purse_start) || 800;
      insert.run(req.params.eventId, t.name, (t.short_name||t.name.slice(0,2)).toUpperCase().slice(0,3), t.color||'#2563eb', t.logo_url||'', purse, purse, parseInt(t.max_players)||15, i);
    });
  });
  txn();
  res.json({ ok: true, count: teams.length });
});

// ────────────────────────────────────────
//  PLAYERS
// ────────────────────────────────────────
router.get('/events/:eventId/players', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const players = db.prepare(`
    SELECT p.*, t.name as team_name, t.color as team_color, t.short_name as team_short
    FROM players p LEFT JOIN teams t ON p.sold_to=t.id
    WHERE p.event_id=? ORDER BY p.auction_order, p.id`).all(req.params.eventId);
  res.json(players);
});

router.post('/events/:eventId/players', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { name, role, base_price, auction_order, photo_url, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const result = db.prepare('INSERT INTO players (event_id,name,role,base_price,auction_order,photo_url,notes) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.eventId, name, role||'Batsman', parseInt(base_price)||50, parseInt(auction_order)||0, photo_url||'', notes||'');
  res.json(db.prepare('SELECT * FROM players WHERE id=?').get(result.lastInsertRowid));
});

router.put('/events/:eventId/players/:playerId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { name, role, base_price, auction_order, photo_url, notes } = req.body;
  const p = db.prepare('SELECT * FROM players WHERE id=? AND event_id=?').get(req.params.playerId, req.params.eventId);
  if (!p) return res.status(404).json({ error: 'Player not found' });
  db.prepare('UPDATE players SET name=?,role=?,base_price=?,auction_order=?,photo_url=?,notes=? WHERE id=?')
    .run(name||p.name, role||p.role, parseInt(base_price)||p.base_price, parseInt(auction_order)||p.auction_order, photo_url!==undefined?photo_url:p.photo_url, notes!==undefined?notes:p.notes, req.params.playerId);
  res.json({ ok: true });
});

router.delete('/events/:eventId/players/:playerId', requireAuth, (req, res) => {
  const db = req.app.get('db');
  db.prepare('DELETE FROM players WHERE id=? AND event_id=?').run(req.params.playerId, req.params.eventId);
  res.json({ ok: true });
});

// Bulk import players
router.post('/events/:eventId/players/bulk', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const { players } = req.body;
  if (!Array.isArray(players)) return res.status(400).json({ error: 'players array required' });
  const insert = db.prepare('INSERT INTO players (event_id,name,role,base_price,auction_order,photo_url,notes) VALUES (?,?,?,?,?,?,?)');
  const txn = db.transaction(() => {
    players.forEach((p, i) => {
      insert.run(req.params.eventId, p.name, p.role||'Batsman', parseInt(p.base_price)||50, parseInt(p.auction_order)||(i+1), p.photo_url||'', p.notes||'');
    });
  });
  txn();
  res.json({ ok: true, count: players.length });
});

// Reset player statuses
router.post('/events/:eventId/players/reset', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const txn = db.transaction(() => {
    db.prepare("UPDATE players SET status='pending', sold_to=NULL, sold_amount=NULL, sold_at=NULL WHERE event_id=?").run(req.params.eventId);
    db.prepare("UPDATE teams SET purse_left=purse_start, (SELECT 0) WHERE event_id=?");
    // reset purse
    db.prepare("UPDATE teams SET purse_left=purse_start WHERE event_id=?").run(req.params.eventId);
    db.prepare("DELETE FROM sale_history WHERE event_id=?").run(req.params.eventId);
    db.prepare("UPDATE auction_state SET current_player_id=NULL,current_bid=0,current_team_id=NULL,current_stage='LIVE' WHERE event_id=?").run(req.params.eventId);
  });
  txn();
  res.json({ ok: true });
});

// ────────────────────────────────────────
//  AUCTION STATE
// ────────────────────────────────────────
router.get('/events/:eventId/state', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(req.params.eventId);
  res.json(state || { event_id: req.params.eventId, current_player_id: null, current_bid: 0 });
});

// ────────────────────────────────────────
//  HISTORY / UNDO
// ────────────────────────────────────────
router.get('/events/:eventId/history', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const history = db.prepare('SELECT * FROM sale_history WHERE event_id=? ORDER BY created_at DESC LIMIT 50').all(req.params.eventId);
  res.json(history);
});

// ────────────────────────────────────────
//  EXPORT DATA
// ────────────────────────────────────────
router.get('/events/:eventId/export/full', requireAuth, (req, res) => {
  const db = req.app.get('db');
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.eventId);
  const teams = db.prepare('SELECT * FROM teams WHERE event_id=? ORDER BY display_order').all(req.params.eventId);
  const players = db.prepare(`SELECT p.*, t.name as team_name FROM players p LEFT JOIN teams t ON p.sold_to=t.id WHERE p.event_id=? ORDER BY p.auction_order`).all(req.params.eventId);
  const history = db.prepare('SELECT * FROM sale_history WHERE event_id=? ORDER BY created_at').all(req.params.eventId);
  res.json({ event: ev, teams, players, history });
});

// ────────────────────────────────────────
//  PUBLIC LIVE VIEW DATA (no auth)
// ────────────────────────────────────────
router.get('/public/:slug/state', (req, res) => {
  const db = req.app.get('db');
  const ev = db.prepare("SELECT * FROM events WHERE slug=? AND status != 'ended'").get(req.params.slug);
  if (!ev) return res.status(404).json({ error: 'Event not found or ended' });
  const teams = db.prepare('SELECT * FROM teams WHERE event_id=? ORDER BY display_order').all(ev.id);
  const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(ev.id);
  const currentPlayer = state?.current_player_id ? db.prepare('SELECT * FROM players WHERE id=?').get(state.current_player_id) : null;
  const currentTeam = state?.current_team_id ? db.prepare('SELECT * FROM teams WHERE id=?').get(state.current_team_id) : null;
  const nextPlayer = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' AND id!=? ORDER BY auction_order LIMIT 1").get(ev.id, state?.current_player_id || 0);
  const recentSold = db.prepare("SELECT * FROM sale_history WHERE event_id=? AND action='sold' ORDER BY created_at DESC LIMIT 8").all(ev.id);
  res.json({ event: ev, teams, state, currentPlayer, currentTeam, nextPlayer, recentSold });
});

module.exports = router;
