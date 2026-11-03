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

module.exports = { list, listTechnicians, create, setActive, USER_LIMIT_BY_PLAN };
