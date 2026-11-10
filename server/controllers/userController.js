const { z } = require('zod');
const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const Company = require('../models/Company');
const AuthSession = require('../models/AuthSession');
const RouteSession = require('../models/RouteSession');
const transaction = require('../utils/transaction');
const v = require('../utils/validation');

// Seção 5 do spec: Basic até 3 usuários por empresa, Pro até 30.
const USER_LIMIT_BY_PLAN = { basic: 3, pro: 30 };

const createUserSchema = z.object({
  name: v.name,
  email: v.email,
  role: z.enum(['admin', 'financeiro', 'tecnico']),
});

const list = asyncHandler(async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId }).sort({ name: 1 });
  res.json(users);
});
const listTechnicians = asyncHandler(async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId, active: true, role: 'tecnico' }).select('_id name').sort({ name: 1 });
  res.json(users);
});

const create = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await User.hashPassword(tempPassword);
  const user = await transaction(async (session) => {
    const company = await Company.findOneAndUpdate({ _id: req.user.companyId }, { $inc: { userRevision: 1 } }, { new: true, session });
    const count = await User.countDocuments({ companyId: company._id, active: true }).session(session);
    if (count >= USER_LIMIT_BY_PLAN[company.plan]) throw v.httpError(403, `Limite de usuários do plano ${company.plan} atingido.`);
    const [created] = await User.create([{ ...data, passwordHash, companyId: company._id }], { session });
    return created;
  });

  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'User', entityId: user._id });
  res.status(201).json({ user: user.toJSON(), tempPassword });
});

const setActive = asyncHandler(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  if (String(req.user._id) === req.params.id && !active) throw v.httpError(409, 'Você não pode desativar seu próprio acesso.');
  const user = await transaction(async (session) => {
    const company = await Company.findOneAndUpdate({ _id: req.user.companyId }, { $inc: { userRevision: 1 } }, { new: true, session });
    const current = await User.findOne({ _id: req.params.id, companyId: company._id }).session(session);
    if (!current) throw v.httpError(404, 'Usuário não encontrado.');
    const actor = await User.exists({ _id: req.user._id, companyId: company._id, active: true, role: 'admin' }).session(session);
    if (!actor) throw v.httpError(401, 'Seu acesso foi encerrado. Entre novamente.');
    if (!active && current.active && current.role === 'admin') {
      const admins = await User.countDocuments({ companyId: company._id, active: true, role: 'admin' }).session(session);
      if (admins <= 1) throw v.httpError(409, 'Mantenha pelo menos um administrador ativo na empresa.');
    }
    if (active && !current.active) {
      const count = await User.countDocuments({ companyId: company._id, active: true }).session(session);
      if (count >= USER_LIMIT_BY_PLAN[company.plan]) throw v.httpError(403, 'Limite de usuários ativos do plano atingido.');
    }
    current.active = active;
    await current.save({ session });
    if (!active) {
      await AuthSession.deleteMany({ userId: current._id }).session(session);
      await RouteSession.deleteMany({ companyId: company._id, technicianId: current._id }).session(session);
    }
    return current;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: active ? 'activate' : 'deactivate', entity: 'User', entityId: user._id });
  res.json(user);
});

const resetPassword = asyncHandler(async (req, res) => {
  const { currentPassword } = z.object({ confirm: z.literal(true), currentPassword: z.string().min(1).max(256) }).strict().parse(req.body);
  const actor = await User.findOne({ _id: req.user._id, companyId: req.user.companyId, active: true, role: 'admin' }).select('+passwordHash');
  if (!actor || !await actor.comparePassword(currentPassword)) throw v.httpError(403, 'Sua senha atual não confere. A senha do usuário não foi alterada.');
  const tempPassword = crypto.randomBytes(12).toString('base64url');
  const passwordHash = await User.hashPassword(tempPassword);
  const user = await transaction(async (session) => {
    const company = await Company.findOneAndUpdate({ _id: req.user.companyId }, { $inc: { userRevision: 1 } }, { new: true, session });
    if (!company) throw v.httpError(404, 'Empresa não encontrada.');
    // Revalida o ator e sua sessão dentro da mesma transação da troca.
    const authorized = await User.exists({ _id: actor._id, companyId: company._id, active: true, role: 'admin', passwordHash: actor.passwordHash }).session(session);
    const activeSession = await AuthSession.exists({ _id: req.authSession._id, userId: actor._id, expiresAt: { $gt: new Date() } }).session(session);
    if (!authorized || !activeSession) throw v.httpError(401, 'Seu acesso foi encerrado. Entre novamente.');
    const updated = await User.findOneAndUpdate({ _id: req.params.id, companyId: company._id }, { $set: { passwordHash } }, { new: true, runValidators: true, session });
    if (!updated) throw v.httpError(404, 'Usuário não encontrado.');
    await AuthSession.deleteMany({ userId: updated._id }).session(session);
    await RouteSession.deleteMany({ companyId: company._id, technicianId: updated._id }).session(session);
    return updated;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'reset-password', entity: 'User', entityId: user._id });
  res.json({ user: user.toJSON(), tempPassword, selfReset: String(user._id) === String(req.user._id) });
});

const changeEmail = asyncHandler(async (req, res) => {
  const data = z.object({ email: v.email, expectedEmail: v.email, confirm: z.literal(true), currentPassword: z.string().min(1).max(256) }).strict().parse(req.body);
  const actor = await User.findOne({ _id: req.user._id, companyId: req.user.companyId, active: true, role: 'admin' }).select('+passwordHash');
  if (!actor || !await actor.comparePassword(data.currentPassword)) throw v.httpError(403, 'Sua senha atual não confere. O e-mail não foi alterado.');
  const user = await transaction(async (session) => {
    const company = await Company.findOneAndUpdate({ _id: req.user.companyId, subscriptionStatus: { $ne: 'suspended' } }, { $inc: { userRevision: 1 } }, { new: true, session });
    if (!company) throw v.httpError(403, 'Empresa indisponível. Contate o suporte.');
    const authorized = await User.exists({ _id: actor._id, companyId: company._id, active: true, role: 'admin', email: actor.email, passwordHash: actor.passwordHash }).session(session);
    const activeSession = await AuthSession.exists({ _id: req.authSession._id, userId: actor._id, scope: 'tenant', expiresAt: { $gt: new Date() } }).session(session);
    if (!authorized || !activeSession) throw v.httpError(401, 'Seu acesso foi encerrado. Entre novamente.');
    const current = await User.findOne({ _id: req.params.id, companyId: company._id }).session(session);
    if (!current) throw v.httpError(404, 'Usuário não encontrado.');
    if (current.email !== data.expectedEmail) throw v.httpError(409, 'O e-mail deste usuário mudou. Feche esta tela e atualize a equipe antes de tentar novamente.');
    if (current.email === data.email) throw v.httpError(409, 'Este já é o e-mail atual do usuário.');
    const updated = await User.findOneAndUpdate({ _id: current._id, companyId: company._id, email: current.email }, { $set: { email: data.email } }, { new: true, runValidators: true, session });
    if (!updated) throw v.httpError(409, 'O usuário mudou durante a alteração. Atualize a equipe.');
    await AuthSession.deleteMany({ userId: updated._id }).session(session);
    await RouteSession.deleteMany({ companyId: company._id, technicianId: updated._id }).session(session);
    return updated;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'change-email', entity: 'User', entityId: user._id });
  res.json({ user: user.toJSON(), selfChange: String(user._id) === String(req.user._id) });
});

module.exports = { list, listTechnicians, create, setActive, resetPassword, changeEmail, USER_LIMIT_BY_PLAN };
