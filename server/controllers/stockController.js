const { z } = require('zod');
const StockItem = require('../models/StockItem');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const stockItemSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().nonnegative().optional(),
  minQuantity: z.number().nonnegative().optional(),
  unit: z.string().optional(),
});

const list = asyncHandler(async (req, res) => {
  const items = await StockItem.find({ companyId: req.user.companyId }).sort({ name: 1 });
  res.json(items);
});

const create = asyncHandler(async (req, res) => {
  const data = stockItemSchema.parse(req.body);
  const item = await StockItem.create({ ...data, companyId: req.user.companyId });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'StockItem', entityId: item._id });
  res.status(201).json(item);
});

const update = asyncHandler(async (req, res) => {
  const data = stockItemSchema.partial().parse(req.body);
  const item = await StockItem.findOneAndUpdate({ _id: req.params.id, companyId: req.user.companyId }, data, { new: true });
  if (!item) return res.status(404).json({ error: 'Item de estoque não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'StockItem', entityId: item._id });
  res.json(item);
});

const remove = asyncHandler(async (req, res) => {
  const item = await StockItem.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!item) return res.status(404).json({ error: 'Item de estoque não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'StockItem', entityId: item._id });
  res.status(204).end();
});

module.exports = { list, create, update, remove };
