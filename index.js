const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const db = require('./server/db');
const routes = require('./server/routes');
const setupSockets = require('./server/sockets');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: '*' } });

// ── Middleware ──
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Share db with routes ──
app.set('db', db);
app.set('io', io);

// ── API Routes ──
app.use('/api', routes);

// ── Socket.IO ──
setupSockets(io, db);

// ── SPA fallback - serve index.html for all non-API routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏏 AuctionPro Live running at http://localhost:${PORT}`);
  console.log(`   Default login: admin / admin123\n`);
});
