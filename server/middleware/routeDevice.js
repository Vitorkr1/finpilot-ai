const RouteSession = require('../models/RouteSession');
const User = require('../models/User');
const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');
const { hashToken, tokenSchema } = require('../services/routeTracking');

const requireRouteDevice = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Route ') ? header.slice(6) : '';
  if (!tokenSchema.safeParse(token).success) {
    return res.status(401).json({ error: 'Credencial de rota inválida.' });
  }
  const session = await RouteSession.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return res.status(410).json({ error: 'Rota encerrada ou expirada.' });
  req.routeSession = session;
  // Revogar o compartilhamento continua permitido mesmo com conta suspensa.
  if (req.method === 'DELETE') return next();
  const user = await User.findOne({ _id: session.technicianId, companyId: session.companyId, active: true, role: 'tecnico' });
  const company = await Company.findById(session.companyId);
  if (!user || !company || company.subscriptionStatus === 'suspended') {
    await RouteSession.deleteOne({ _id: session._id });
    return res.status(403).json({ error: 'Compartilhamento interrompido. Entre novamente.' });
  }
  next();
});

module.exports = requireRouteDevice;
