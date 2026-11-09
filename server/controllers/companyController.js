const { z } = require('zod');
const crypto = require('crypto');
const Company = require('../models/Company');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

// Rotas restritas ao super_admin: apenas dados administrativos da empresa
// (plano, status de assinatura). Nunca expõe dados operacionais do tenant.
const list = asyncHandler(async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.json(companies);
});

const getOne = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  res.json(company);
});

const createSchema = z.object({
  name: v.name,
  email: v.email,
  cnpj: v.text(40).optional(),
  segment: z.enum(['eletrica', 'solar', 'ar_condicionado', 'seguranca', 'manutencao', 'outro']).optional(),
  plan: z.enum(['basic', 'pro']).optional(),
});

// Espelha `admin.js create-company`: cria a empresa e o primeiro usuário admin,
// com senha temporária gerada e retornada uma única vez.
const create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await User.hashPassword(tempPassword);
  const { company, adminUser } = await transaction(async (session) => {
    const [company] = await Company.create([{
      name: data.name,
      cnpj: data.cnpj,
      segment: data.segment || 'outro',
      plan: data.plan || 'basic',
      subscriptionStatus: 'active',
    }], { session });
    const [adminUser] = await User.create([{
      companyId: company._id,
      name: `Admin ${data.name}`,
      email: data.email,
      passwordHash,
      role: 'admin',
    }], { session });
    return { company, adminUser };
  });

  await logAction({ userId: req.user._id, action: 'create', entity: 'Company', entityId: company._id });
  res.status(201).json({ company, adminUser: adminUser.toJSON(), tempPassword });
});

const editSchema = z.object({
  name: v.name.optional(),
  cnpj: v.text(40).optional(),
  segment: z.enum(['eletrica', 'solar', 'ar_condicionado', 'seguranca', 'manutencao', 'outro']).optional(),
  price: v.money.nullable().optional(),
});

const update = asyncHandler(async (req, res) => {
  const data = editSchema.parse(req.body);
  const company = await Company.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  await logAction({ userId: req.user._id, action: 'update', entity: 'Company', entityId: company._id });
  res.json(company);
});

const setPlan = asyncHandler(async (req, res) => {
  const { plan } = z.object({ plan: z.enum(['basic', 'pro']) }).parse(req.body);
  const company = await transaction(async (session) => {
    const company = await Company.findOneAndUpdate({ _id: req.params.id }, { $inc: { userRevision: 1 } }, { new: true, session });
    if (!company) throw v.httpError(404, 'Empresa não encontrada.');
    if (plan === 'basic' && await User.countDocuments({ companyId: company._id, active: true }).session(session) > 3) throw v.httpError(409, 'Desative os acessos excedentes antes de mudar para Basic: o limite é de 3 usuários ativos.');
    company.plan = plan;
    await company.save({ session });
    return company;
  });
  if (plan === 'basic') await require('../services/whatsapp').disconnect(company._id);
  await logAction({ userId: req.user._id, action: 'set-plan', entity: 'Company', entityId: company._id, details: { plan } });
  res.json(company);
});

const markPaid = asyncHandler(async (req, res) => {
  const { nextDueDate } = z.object({ nextDueDate: v.date.optional() }).parse(req.body);
  const update = { subscriptionStatus: 'active' };
  if (nextDueDate) update.nextDueDate = new Date(nextDueDate);
  const company = await Company.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  await logAction({ userId: req.user._id, action: 'mark-paid', entity: 'Company', entityId: company._id });
  res.json(company);
});

const suspend = asyncHandler(async (req, res) => {
  const company = await transaction(async (session) => {
    const company = await Company.findByIdAndUpdate(req.params.id, { subscriptionStatus: 'suspended' }, { new: true, session });
    if (!company) throw v.httpError(404, 'Empresa não encontrada.');
    const users = await User.find({ companyId: company._id }).select('_id').session(session);
    await require('../models/AuthSession').deleteMany({ userId: { $in: users.map((u) => u._id) } }).session(session);
    await require('../models/RouteSession').deleteMany({ companyId: company._id }).session(session);
    return company;
  });
  await require('../services/whatsapp').disconnect(company._id);
  await logAction({ userId: req.user._id, action: 'suspend', entity: 'Company', entityId: company._id });
  res.json(company);
});

// Exclusão é sempre manual e explícita (Seção 6/14) — exige confirm: true no
// corpo da requisição, o frontend só envia isso após um diálogo de confirmação.
const remove = asyncHandler(async (req, res) => {
  const { confirm } = z.object({ confirm: z.literal(true) }).parse(req.body);
  if (!confirm) return res.status(400).json({ error: 'Confirmação obrigatória' });

  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });

  await transaction(async (session) => {
    const users = await User.find({ companyId: company._id }).select('_id').session(session);
    await require('../models/AuthSession').deleteMany({ userId: { $in: users.map((u) => u._id) } }).session(session);
    for (const model of ['User', 'Client', 'ClientImport', 'Budget', 'ServiceOrder', 'Appointment', 'StockItem', 'FinancialEntry', 'RouteSession', 'WhatsAppMessage', 'WhatsAppAuthFile', 'AuditLog']) {
      await require(`../models/${model}`).deleteMany({ companyId: company._id }).session(session);
    }
    await Company.deleteOne({ _id: company._id }).session(session);
  });
  await require('../services/whatsapp').disconnect(company._id);

  await logAction({ userId: req.user._id, action: 'delete', entity: 'Company', entityId: company._id });
  res.status(204).end();
});

module.exports = { list, getOne, create, update, setPlan, markPaid, suspend, remove };
