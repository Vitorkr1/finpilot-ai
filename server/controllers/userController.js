const { z } = require('zod');
const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

// Seção 5 do spec: Basic até 3 usuários por empresa, Pro até 30.
const USER_LIMIT_BY_PLAN = { basic: 3, pro: 30 };

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'financeiro', 'tecnico']),
});

const list = asyncHandler(async (req, res) => {
  const users = await User.find({ companyId: req.user.companyId }).sort({ name: 1 });
  res.json(users);
});

const create = asyncHandler(async (req, res) => {
  const data = createUserSchema.parse(req.body);

  const currentCount = await User.countDocuments({ companyId: req.user.companyId, active: true });
  const limit = USER_LIMIT_BY_PLAN[req.company.plan];
  if (currentCount >= limit) {
    return res.status(403).json({
      error: `Limite de usuários do plano ${req.company.plan} atingido (${limit}). Faça upgrade para adicionar mais.`,
    });
  }

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await User.hashPassword(tempPassword);
  const user = await User.create({ ...data, passwordHash, companyId: req.user.companyId });

  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'User', entityId: user._id });
  res.status(201).json({ user: user.toJSON(), tempPassword });
});

const setActive = asyncHandler(async (req, res) => {
  const { active } = z.object({ active: z.boolean() }).parse(req.body);
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    { active },
    { new: true }
  );
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: active ? 'activate' : 'deactivate', entity: 'User', entityId: user._id });
  res.json(user);
});

module.exports = { list, create, setActive, USER_LIMIT_BY_PLAN };
