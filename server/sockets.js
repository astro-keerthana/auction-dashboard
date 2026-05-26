const { verifyToken } = require('./auth');

module.exports = function setupSockets(io, db) {

  // Auth middleware for sockets
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      const payload = verifyToken(token);
      if (payload) { socket.user = payload; return next(); }
    }
    // Allow public connections (live display) with no token
    socket.user = null;
    next();
  });

  io.on('connection', (socket) => {
    const uid = socket.user?.id || 'public';
    console.log(`Socket connected: ${uid}`);

    // Join event room
    socket.on('join_event', ({ eventId, isAdmin }) => {
      socket.join(`event_${eventId}`);
      if (isAdmin) socket.join(`admin_${eventId}`);
      socket.eventId = eventId;
    });

    // ── AUCTION ACTIONS (admin/operator only) ──

    socket.on('auction:start', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return socket.emit('error', 'Not authorized');
      const firstPlayer = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' ORDER BY auction_order LIMIT 1").get(eventId);
      if (!firstPlayer) return socket.emit('error', 'No pending players');
      db.prepare("UPDATE events SET status='live', updated_at=unixepoch() WHERE id=?").run(eventId);
      db.prepare("INSERT OR IGNORE INTO auction_state (event_id) VALUES (?)").run(eventId);
      db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
        .run(firstPlayer.id, firstPlayer.base_price, eventId);
      broadcastState(io, db, eventId, 'auction:started');
    });

    socket.on('auction:pause', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE events SET status='paused' WHERE id=?").run(eventId);
      io.to(`event_${eventId}`).emit('auction:paused');
    });

    socket.on('auction:resume', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE events SET status='live' WHERE id=?").run(eventId);
      io.to(`event_${eventId}`).emit('auction:resumed');
    });

    socket.on('auction:end', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE events SET status='ended' WHERE id=?").run(eventId);
      io.to(`event_${eventId}`).emit('auction:ended');
    });

    socket.on('auction:set_bid', ({ eventId, amount }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE auction_state SET current_bid=?,updated_at=unixepoch() WHERE event_id=?").run(amount, eventId);
      broadcastState(io, db, eventId, 'auction:bid_updated');
    });

    socket.on('auction:set_team', ({ eventId, teamId }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE auction_state SET current_team_id=?,updated_at=unixepoch() WHERE event_id=?").run(teamId, eventId);
      broadcastState(io, db, eventId, 'auction:team_updated');
    });

    socket.on('auction:set_stage', ({ eventId, stage }) => {
      if (!canOperate(socket, db, eventId)) return;
      db.prepare("UPDATE auction_state SET current_stage=?,updated_at=unixepoch() WHERE event_id=?").run(stage, eventId);
      broadcastState(io, db, eventId, 'auction:stage_updated');
    });

    socket.on('auction:select_player', ({ eventId, playerId }) => {
      if (!canOperate(socket, db, eventId)) return;
      const player = db.prepare('SELECT * FROM players WHERE id=? AND event_id=?').get(playerId, eventId);
      if (!player) return;
      db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
        .run(player.id, player.base_price, eventId);
      broadcastState(io, db, eventId, 'auction:player_changed');
    });

    socket.on('auction:mark_sold', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(eventId);
      if (!state?.current_player_id || !state?.current_team_id) return socket.emit('error', 'Select player and team first');
      const player = db.prepare('SELECT * FROM players WHERE id=?').get(state.current_player_id);
      const team = db.prepare('SELECT * FROM teams WHERE id=?').get(state.current_team_id);
      if (!player || !team) return;
      if (team.purse_left < state.current_bid) return socket.emit('error', `${team.name} doesn't have enough purse`);
      if (team.players_count >= team.max_players) return socket.emit('error', `${team.name} reached max squad size`);

      const soldPlayers = db.prepare("SELECT COUNT(*) as cnt FROM players WHERE sold_to=? AND status='sold'").get(team.id)?.cnt || 0;
      if (soldPlayers >= team.max_players) return socket.emit('error', `${team.name} reached max squad size`);

      const txn = db.transaction(() => {
        db.prepare("UPDATE players SET status='sold',sold_to=?,sold_amount=?,sold_at=unixepoch() WHERE id=?")
          .run(team.id, state.current_bid, player.id);
        db.prepare("UPDATE teams SET purse_left=purse_left-? WHERE id=?").run(state.current_bid, team.id);
        db.prepare("INSERT INTO sale_history (event_id,player_id,player_name,team_id,team_name,amount,action) VALUES (?,?,?,?,?,?,'sold')")
          .run(eventId, player.id, player.name, team.id, team.name, state.current_bid);
        db.prepare("UPDATE auction_state SET current_stage='SOLD',updated_at=unixepoch() WHERE event_id=?").run(eventId);
      });
      txn();

      broadcastState(io, db, eventId, 'auction:sold', {
        playerName: player.name, teamName: team.name, amount: state.current_bid
      });

      // Auto advance after delay
      setTimeout(() => {
        const next = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' ORDER BY auction_order LIMIT 1").get(eventId);
        if (next) {
          db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
            .run(next.id, next.base_price, eventId);
          broadcastState(io, db, eventId, 'auction:player_changed');
        } else {
          broadcastState(io, db, eventId, 'auction:all_done');
        }
      }, 1800);
    });

    socket.on('auction:mark_unsold', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(eventId);
      if (!state?.current_player_id) return;
      const player = db.prepare('SELECT * FROM players WHERE id=?').get(state.current_player_id);
      if (!player) return;
      db.prepare("UPDATE players SET status='unsold' WHERE id=?").run(player.id);
      db.prepare("INSERT INTO sale_history (event_id,player_id,player_name,team_id,team_name,amount,action) VALUES (?,?,?,0,'',0,'unsold')").run(eventId, player.id, player.name);
      db.prepare("UPDATE auction_state SET current_stage='UNSOLD',updated_at=unixepoch() WHERE event_id=?").run(eventId);
      broadcastState(io, db, eventId, 'auction:unsold', { playerName: player.name });
      setTimeout(() => {
        const next = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' ORDER BY auction_order LIMIT 1").get(eventId);
        if (next) {
          db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
            .run(next.id, next.base_price, eventId);
          broadcastState(io, db, eventId, 'auction:player_changed');
        }
      }, 1200);
    });

    socket.on('auction:undo', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      const lastSale = db.prepare("SELECT * FROM sale_history WHERE event_id=? AND action='sold' ORDER BY created_at DESC LIMIT 1").get(eventId);
      if (!lastSale) return socket.emit('error', 'Nothing to undo');
      const txn = db.transaction(() => {
        db.prepare("UPDATE players SET status='pending',sold_to=NULL,sold_amount=NULL,sold_at=NULL WHERE id=?").run(lastSale.player_id);
        db.prepare("UPDATE teams SET purse_left=purse_left+? WHERE id=?").run(lastSale.amount, lastSale.team_id);
        db.prepare("DELETE FROM sale_history WHERE id=?").run(lastSale.id);
        db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
          .run(lastSale.player_id, lastSale.amount, eventId);
      });
      txn();
      broadcastState(io, db, eventId, 'auction:undo_done', { playerName: lastSale.player_name });
    });

    socket.on('auction:next_player', ({ eventId }) => {
      if (!canOperate(socket, db, eventId)) return;
      const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(eventId);
      const next = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' AND id!=? ORDER BY auction_order LIMIT 1")
        .get(eventId, state?.current_player_id || 0);
      if (!next) return socket.emit('info', 'No more pending players');
      db.prepare("UPDATE auction_state SET current_player_id=?,current_bid=?,current_team_id=NULL,current_stage='LIVE',updated_at=unixepoch() WHERE event_id=?")
        .run(next.id, next.base_price, eventId);
      broadcastState(io, db, eventId, 'auction:player_changed');
    });

    socket.on('disconnect', () => console.log(`Socket disconnected: ${uid}`));
  });
};

function canOperate(socket, db, eventId) {
  if (!socket.user) return false;
  if (socket.user.role === 'superadmin') return true;
  const access = db.prepare('SELECT permission FROM event_access WHERE event_id=? AND user_id=?').get(eventId, socket.user.id);
  return access && (access.permission === 'admin' || access.permission === 'operator');
}

function buildLiveState(db, eventId) {
  const ev = db.prepare('SELECT * FROM events WHERE id=?').get(eventId);
  const state = db.prepare('SELECT * FROM auction_state WHERE event_id=?').get(eventId);
  const teams = db.prepare('SELECT * FROM teams WHERE event_id=? ORDER BY display_order').all(eventId);
  const players = db.prepare("SELECT p.*,t.name as team_name,t.short_name as team_short,t.color as team_color FROM players p LEFT JOIN teams t ON p.sold_to=t.id WHERE p.event_id=? ORDER BY p.auction_order").all(eventId);
  const currentPlayer = state?.current_player_id ? db.prepare('SELECT * FROM players WHERE id=?').get(state.current_player_id) : null;
  const currentTeam = state?.current_team_id ? db.prepare('SELECT * FROM teams WHERE id=?').get(state.current_team_id) : null;
  const nextPlayer = db.prepare("SELECT * FROM players WHERE event_id=? AND status='pending' AND id!=? ORDER BY auction_order LIMIT 1").get(eventId, state?.current_player_id || 0);
  const recentSold = db.prepare("SELECT * FROM sale_history WHERE event_id=? AND action='sold' ORDER BY created_at DESC LIMIT 8").all(eventId);
  return { event: ev, state, teams, players, currentPlayer, currentTeam, nextPlayer, recentSold };
}

function broadcastState(io, db, eventId, event, extra = {}) {
  const liveState = buildLiveState(db, eventId);
  io.to(`event_${eventId}`).emit(event, { ...liveState, ...extra });
}

module.exports.buildLiveState = buildLiveState;
