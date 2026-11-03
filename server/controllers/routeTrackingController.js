const RouteSession = require('../models/RouteSession');
const asyncHandler = require('../utils/asyncHandler');
const { ROUTE_DURATION_MS, startSchema, hashToken, parsePosition, publicSession } = require('../services/routeTracking');

const list = asyncHandler(async (req, res) => {
  const sessions = await RouteSession.find({ companyId: req.user.companyId, expiresAt: { $gt: new Date() } })
    .populate({ path: 'technicianId', select: 'name', match: { companyId: req.user.companyId, active: true, role: 'tecnico' } })
    .sort({ startedAt: -1 });
  res.json(sessions.filter((s) => s.technicianId).map(publicSession));
});

const mine = asyncHandler(async (req, res) => {
  const session = await RouteSession.findOne({ companyId: req.user.companyId, technicianId: req.user._id, expiresAt: { $gt: new Date() } });
  res.json(session ? publicSession(session) : null);
});

const start = asyncHandler(async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Confirme o compartilhamento no aplicativo Android.' });
  const now = new Date();
  const owner = { companyId: req.user.companyId, technicianId: req.user._id };
  const tokenHash = hashToken(parsed.data.deviceToken);
  await RouteSession.deleteMany({ ...owner, expiresAt: { $lte: now } });
  let session = await RouteSession.findOne(owner).select('+tokenHash');
  if (session) {
    if (session.tokenHash === tokenHash) return res.json(publicSession(session));
    return res.status(409).json({ error: 'Você já tem uma rota ativa. Encerre a anterior antes de iniciar outra.' });
  }
  try {
    session = await RouteSession.create({ ...owner, tokenHash, consentAt: now, startedAt: now, expiresAt: new Date(now.getTime() + ROUTE_DURATION_MS) });
  } catch (error) {
    if (error.code !== 11000) throw error;
    session = await RouteSession.findOne({ ...owner, tokenHash, expiresAt: { $gt: now } });
    if (!session) return res.status(409).json({ error: 'Você já tem uma rota ativa.' });
  }
  res.status(201).json(publicSession(session));
});

const updatePosition = asyncHandler(async (req, res) => {
  const position = parsePosition(req.body);
  if (!position) return res.status(400).json({ error: 'GPS sem precisão suficiente ou posição antiga. Use localização precisa e data e hora automáticas.' });
  // Atualização condicional impede uma amostra atrasada de substituir outra mais recente.
  const filter = {
    _id: req.routeSession._id,
    expiresAt: { $gt: new Date() },
    $or: [{ position: null }, { 'position.capturedAt': { $lt: position.capturedAt } },
      { 'position.capturedAt': position.capturedAt, 'position.accuracy': { $gt: position.accuracy } }],
  };
  if (position.provider === 'network') {
    filter.$and = [{ $or: [
      { 'position.provider': { $ne: 'gps' } },
      { 'position.capturedAt': { $lte: new Date(position.capturedAt.getTime() - 10000) } },
    ] }];
  }
  const result = await RouteSession.updateOne(filter, { $set: { position } });
  if (!result.matchedCount) {
    const active = await RouteSession.exists({ _id: req.routeSession._id, expiresAt: { $gt: new Date() } });
    if (!active) return res.status(410).json({ error: 'Rota encerrada ou expirada.' });
  }
  res.status(204).end();
});

const stopDevice = asyncHandler(async (req, res) => {
  await RouteSession.deleteOne({ _id: req.routeSession._id });
  res.status(204).end();
});

const deviceStatus = asyncHandler(async (req, res) => {
  res.json({ expiresAt: req.routeSession.expiresAt, protocolVersion: 2 });
});

const stopMine = asyncHandler(async (req, res) => {
  await RouteSession.deleteOne({ companyId: req.user.companyId, technicianId: req.user._id });
  res.status(204).end();
});

module.exports = { list, mine, start, updatePosition, stopDevice, stopMine, deviceStatus };
