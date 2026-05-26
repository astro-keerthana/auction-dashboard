const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'auctionpro-secret-2026-change-in-prod';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : req.cookies?.token;
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.user = payload;
  next();
}

function requireSuperAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}

function requireEventAccess(minPerm = 'viewer') {
  const order = { viewer: 0, operator: 1, admin: 2, superadmin: 99 };
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (req.user.role === 'superadmin') return next();
      const db = req.app.get('db');
      const eventId = parseInt(req.params.eventId || req.body.eventId);
      if (!eventId) return res.status(400).json({ error: 'Event ID required' });
      const access = db.prepare('SELECT permission FROM event_access WHERE event_id = ? AND user_id = ?')
        .get(eventId, req.user.id);
      if (!access) return res.status(403).json({ error: 'No access to this event' });
      if (order[access.permission] < order[minPerm]) return res.status(403).json({ error: 'Insufficient permission' });
      req.eventPermission = access.permission;
      next();
    });
  };
}

module.exports = { signToken, verifyToken, requireAuth, requireSuperAdmin, requireEventAccess };
