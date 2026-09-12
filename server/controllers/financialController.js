const { z } = require('zod');
const FinancialEntry = require('../models/FinancialEntry');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const entrySchema = z.object({
  type: z.enum(['receita', 'despesa']),
  description: z.string().min(1),
  amount: z.number().nonnegative(),
  dueDate: z.string().min(1),
  relatedServiceOrderId: z.string().nullable().optional(),
});

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  if (req.query.type) filter.type = req.query.type;
  const entries = await FinancialEntry.find(filter).sort({ dueDate: 1 });
  res.json(entries);
});

const create = asyncHandler(async (req, res) => {
  const data = entrySchema.parse(req.body);
  const entry = await FinancialEntry.create({ ...data, dueDate: new Date(data.dueDate), companyId: req.user.companyId });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'FinancialEntry', entityId: entry._id });
  res.status(201).json(entry);
});

const markPaid = asyncHandler(async (req, res) => {
  const entry = await FinancialEntry.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    { paidDate: new Date() },
    { new: true }
  );
  if (!entry) return res.status(404).json({ error: 'Lançamento não encontrado' });
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
