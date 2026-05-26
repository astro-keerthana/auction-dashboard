const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '../data/auctionpro.db');
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── SCHEMA ──
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator', -- 'superadmin' | 'operator'
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  date TEXT,
  currency TEXT DEFAULT '₹',
  logo_url TEXT DEFAULT '',
  brand_color TEXT DEFAULT '#2563eb',
  status TEXT DEFAULT 'draft', -- 'draft' | 'live' | 'paused' | 'ended'
  created_by INTEGER REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS event_access (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'operator', -- 'admin' | 'operator' | 'viewer'
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  color TEXT DEFAULT '#2563eb',
  logo_url TEXT DEFAULT '',
  purse_start INTEGER NOT NULL DEFAULT 800,
  purse_left INTEGER NOT NULL DEFAULT 800,
  max_players INTEGER DEFAULT 15,
  display_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Batsman',
  base_price INTEGER NOT NULL DEFAULT 50,
  auction_order INTEGER DEFAULT 0,
  photo_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', -- 'pending' | 'sold' | 'unsold'
  sold_to INTEGER REFERENCES teams(id),
  sold_amount INTEGER,
  sold_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS auction_state (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  current_player_id INTEGER REFERENCES players(id),
  current_bid INTEGER DEFAULT 0,
  current_team_id INTEGER REFERENCES teams(id),
  current_stage TEXT DEFAULT 'LIVE',
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sale_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  player_id INTEGER REFERENCES players(id),
  player_name TEXT NOT NULL,
  team_id INTEGER REFERENCES teams(id),
  team_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  action TEXT DEFAULT 'sold', -- 'sold' | 'unsold' | 'undo'
  created_at INTEGER DEFAULT (unixepoch())
);
`);

// ── SEED SUPERADMIN ──
const existing = db.prepare('SELECT id FROM users WHERE role = ?').get('superadmin');
if (!existing) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)`)
    .run('admin', hash, 'Super Admin', 'superadmin');
  console.log('✓ Default superadmin created: admin / admin123');
}

module.exports = db;
