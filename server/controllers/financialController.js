const { z } = require('zod');
const FinancialEntry = require('../models/FinancialEntry');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const ServiceOrder = require('../models/ServiceOrder');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

const entrySchema = z.object({
  type: z.enum(['receita', 'despesa']),
  description: v.name,
  amount: v.money,
  dueDate: v.date,
  relatedServiceOrderId: v.objectId.nullable().optional(),
});

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  const query = z.object({ type: z.enum(['receita', 'despesa']).optional() }).parse(req.query);
  if (query.type) filter.type = query.type;
  const entries = await FinancialEntry.find(filter).sort({ dueDate: 1 });
  res.json(entries);
});

const create = asyncHandler(async (req, res) => {
  const data = entrySchema.parse(req.body);
  if (data.relatedServiceOrderId && !await ServiceOrder.exists({ _id: data.relatedServiceOrderId, companyId: req.user.companyId })) throw v.httpError(400, 'Ordem de serviço não encontrada nesta empresa.');
  const entry = await transaction(async (session) => {
    if (data.relatedServiceOrderId && !await ServiceOrder.findOneAndUpdate({ _id: data.relatedServiceOrderId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session })) throw v.httpError(400, 'Ordem de serviço não encontrada nesta empresa.');
    const [created] = await FinancialEntry.create([{ ...data, dueDate: new Date(data.dueDate), companyId: req.user.companyId }], { session });
    return created;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'FinancialEntry', entityId: entry._id });
  res.status(201).json(entry);
});

const markPaid = asyncHandler(async (req, res) => {
  const entry = await FinancialEntry.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId, paidDate: null },
    { paidDate: new Date() },
    { new: true }
  );
  if (!entry) {
    const existing = await FinancialEntry.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!existing) return res.status(404).json({ error: 'Lançamento não encontrado' });
    return res.json(existing);
  }
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'mark-paid', entity: 'FinancialEntry', entityId: entry._id });
  res.json(entry);
});

const remove = asyncHandler(async (req, res) => {
  const entry = await FinancialEntry.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!entry) return res.status(404).json({ error: 'Lançamento não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'FinancialEntry', entityId: entry._id });
  res.status(204).end();
});

module.exports = { list, create, markPaid, remove };
