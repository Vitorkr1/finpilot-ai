const { z } = require('zod');
const Budget = require('../models/Budget');
const Client = require('../models/Client');
const ServiceOrder = require('../models/ServiceOrder');
const { getDefaultChecklist } = require('../services/checklistTemplates');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const budgetItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number().nonnegative(),
  unitPrice: z.number().nonnegative(),
});

const budgetSchema = z.object({
  clientId: z.string().min(1),
  items: z.array(budgetItemSchema).default([]),
  status: z.enum(['rascunho', 'enviado', 'aprovado', 'recusado']).optional(),
});

async function assertClientBelongsToCompany(clientId, companyId) {
  const client = await Client.findOne({ _id: clientId, companyId });
  if (!client) {
    const err = new Error('Cliente não encontrado nesta empresa');
    err.status = 400;
    throw err;
  }
}

const list = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({ companyId: req.user.companyId }).sort({ createdAt: -1 });
  res.json(budgets);
});

const getOne = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });
  res.json(budget);
});

const create = asyncHandler(async (req, res) => {
  const data = budgetSchema.parse(req.body);
  await assertClientBelongsToCompany(data.clientId, req.user.companyId);

  const budget = await Budget.create({ ...data, companyId: req.user.companyId });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'Budget', entityId: budget._id });
  res.status(201).json(budget);
});

const update = asyncHandler(async (req, res) => {
  const data = budgetSchema.partial().parse(req.body);
  if (data.clientId) {
    await assertClientBelongsToCompany(data.clientId, req.user.companyId);
  }

  const budget = await Budget.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });
  if (budget.convertedToServiceOrder) {
    return res.status(409).json({ error: 'Orçamento já convertido em OS não pode ser editado' });
  }

  Object.assign(budget, data);
  await budget.save();
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'Budget', entityId: budget._id });
  res.json(budget);
});

const remove = asyncHandler(async (req, res) => {
  const budget = await Budget.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'Budget', entityId: budget._id });
  res.status(204).end();
});

const convertToServiceOrder = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });
  if (budget.status !== 'aprovado') {
    return res.status(409).json({ error: 'Apenas orçamentos aprovados podem virar ordem de serviço' });
  }
  if (budget.convertedToServiceOrder) {
    return res.status(409).json({ error: 'Este orçamento já foi convertido' });
  }

  const serviceOrder = await ServiceOrder.create({
    companyId: req.user.companyId,
    clientId: budget.clientId,
    budgetId: budget._id,
    status: 'aberta',
    checklist: getDefaultChecklist(),
  });

  budget.convertedToServiceOrder = true;
  await budget.save();

  await logAction({
    companyId: req.user.companyId,
    userId: req.user._id,
    action: 'convert',
    entity: 'Budget',
    entityId: budget._id,
    details: { serviceOrderId: serviceOrder._id },
  });

  res.status(201).json(serviceOrder);
});

module.exports = { list, getOne, create, update, remove, convertToServiceOrder };
