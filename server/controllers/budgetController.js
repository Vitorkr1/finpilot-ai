const { z } = require('zod');
const Budget = require('../models/Budget');
const Client = require('../models/Client');
const ServiceOrder = require('../models/ServiceOrder');
const { getDefaultChecklist } = require('../services/checklistTemplates');
const { generateBudgetPdf } = require('../services/pdf');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

const budgetItemSchema = z.object({
  description: v.name,
  qty: v.quantity,
  unitPrice: v.money,
});

const budgetSchema = z.object({
  clientId: v.objectId,
  items: z.array(budgetItemSchema).max(200).default([]),
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

  const budget = await transaction(async (session) => {
    const reference = await Client.findOneAndUpdate({ _id: data.clientId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session });
    if (!reference) throw v.httpError(400, 'Cliente não encontrado nesta empresa.');
    const [created] = await Budget.create([{ ...data, companyId: req.user.companyId }], { session });
    return created;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'Budget', entityId: budget._id });
  res.status(201).json(budget);
});

const update = asyncHandler(async (req, res) => {
  const data = budgetSchema.partial().parse(req.body);
  if (data.clientId) {
    await assertClientBelongsToCompany(data.clientId, req.user.companyId);
  }

  const budget = await transaction(async (session) => {
    const current = await Budget.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
    if (!current) throw v.httpError(404, 'Orçamento não encontrado.');
    if (current.convertedToServiceOrder) throw v.httpError(409, 'Orçamento já convertido em OS não pode ser editado.');
    if (data.clientId && !await Client.findOneAndUpdate({ _id: data.clientId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session })) throw v.httpError(400, 'Cliente não encontrado nesta empresa.');
    Object.assign(current, data);
    await current.save({ session });
    return current;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'Budget', entityId: budget._id });
  res.json(budget);
});

const remove = asyncHandler(async (req, res) => {
  const budget = await transaction(async (session) => {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId }).session(session);
    if (!budget) throw v.httpError(404, 'Orçamento não encontrado.');
    if (budget.convertedToServiceOrder || await ServiceOrder.exists({ budgetId: budget._id, companyId: req.user.companyId }).session(session)) throw v.httpError(409, 'Este orçamento está vinculado a uma ordem de serviço.');
    return budget;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'Budget', entityId: budget._id });
  res.status(204).end();
});

const convertToServiceOrder = asyncHandler(async (req, res) => {
  const serviceOrder = await transaction(async (session) => {
    const budget = await Budget.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId, status: 'aprovado', convertedToServiceOrder: false },
      { $set: { convertedToServiceOrder: true }, $inc: { __v: 1 } }, { new: true, session });
    if (!budget) {
      const exists = await Budget.exists({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      throw v.httpError(exists ? 409 : 404, exists ? 'Apenas orçamentos aprovados e ainda não convertidos podem virar ordem de serviço.' : 'Orçamento não encontrado.');
    }
    const client = await Client.exists({ _id: budget.clientId, companyId: req.user.companyId }).session(session);
    if (!client) throw v.httpError(409, 'O cliente deste orçamento não existe mais.');
    const [order] = await ServiceOrder.create([{
      companyId: req.user.companyId, clientId: budget.clientId, budgetId: budget._id,
      status: 'aberta', checklist: getDefaultChecklist(), calledAt: new Date(),
    }], { session });
    return order;
  });

  await logAction({
    companyId: req.user.companyId,
    userId: req.user._id,
    action: 'convert',
    entity: 'Budget',
    entityId: req.params.id,
    details: { serviceOrderId: serviceOrder._id },
  });

  res.status(201).json(serviceOrder);
});

const downloadPdf = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

  const client = await Client.findOne({ _id: budget.clientId, companyId: req.user.companyId });
  const pdfBuffer = await generateBudgetPdf({ budget, client, company: req.company });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="orcamento-${budget._id}.pdf"`);
  res.send(pdfBuffer);
});

module.exports = { list, getOne, create, update, remove, convertToServiceOrder, downloadPdf };
