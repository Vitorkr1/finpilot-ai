const { z } = require('zod');
const ServiceOrder = require('../models/ServiceOrder');
const Client = require('../models/Client');
const User = require('../models/User');
const StockItem = require('../models/StockItem');
const { getTemplate, getDefaultChecklist } = require('../services/checklistTemplates');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const addMaterialSchema = z.object({
  stockItemId: z.string().min(1),
  qty: z.number().positive(),
});

const createSchema = z.object({
  clientId: z.string().min(1),
  technicianId: z.string().optional(),
  segment: z.enum(['eletrica', 'solar', 'ar_condicionado', 'seguranca', 'manutencao', 'outro']).optional(),
  laborHours: z.number().nonnegative().optional(),
});

const updateSchema = z.object({
  technicianId: z.string().nullable().optional(),
  status: z.enum(['aberta', 'em_andamento', 'concluida', 'cancelada']).optional(),
  laborHours: z.number().nonnegative().optional(),
  checklist: z.array(z.object({ item: z.string(), done: z.boolean() })).optional(),
  photos: z.array(z.string()).optional(),
  signatureUrl: z.string().nullable().optional(),
});

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.technicianId) filter.technicianId = req.query.technicianId;
  const orders = await ServiceOrder.find(filter).sort({ createdAt: -1 });
  res.json(orders);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
  res.json(order);
});

const create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);

  const client = await Client.findOne({ _id: data.clientId, companyId: req.user.companyId });
  if (!client) return res.status(400).json({ error: 'Cliente não encontrado nesta empresa' });

  if (data.technicianId) {
    const tech = await User.findOne({ _id: data.technicianId, companyId: req.user.companyId });
    if (!tech) return res.status(400).json({ error: 'Técnico não encontrado nesta empresa' });
  }

  // Pro: checklist dinâmico por segmento. Basic: checklist fixo simples (Seção 5).
  const checklist = req.company.plan === 'pro' && data.segment ? getTemplate(data.segment) : getDefaultChecklist();

  const order = await ServiceOrder.create({ ...data, companyId: req.user.companyId, checklist });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'ServiceOrder', entityId: order._id });
  res.status(201).json(order);
});

const update = asyncHandler(async (req, res) => {
  const data = updateSchema.parse(req.body);

  if (data.technicianId) {
    const tech = await User.findOne({ _id: data.technicianId, companyId: req.user.companyId });
    if (!tech) return res.status(400).json({ error: 'Técnico não encontrado nesta empresa' });
  }

  const order = await ServiceOrder.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    data,
    { new: true }
  );
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'ServiceOrder', entityId: order._id });
  res.json(order);
});

const remove = asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'ServiceOrder', entityId: order._id });
  res.status(204).end();
});

const checklistTemplate = asyncHandler(async (req, res) => {
  res.json({ checklist: getTemplate(req.params.segment) });
});

// Estoque é recurso Pro (Seção 5): baixa automática no estoque ao registrar
// material usado na OS. Decrementa de forma atômica (só se houver saldo).
const addMaterial = asyncHandler(async (req, res) => {
  const { stockItemId, qty } = addMaterialSchema.parse(req.body);

  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

  const stockItem = await StockItem.findOneAndUpdate(
    { _id: stockItemId, companyId: req.user.companyId, quantity: { $gte: qty } },
    { $inc: { quantity: -qty } },
    { new: true }
  );
  if (!stockItem) {
    return res.status(409).json({ error: 'Estoque insuficiente ou item não encontrado' });
  }

  order.materialsUsed.push({ stockItemId, qty });
  await order.save();

  await logAction({
    companyId: req.user.companyId,
    userId: req.user._id,
    action: 'add-material',
    entity: 'ServiceOrder',
    entityId: order._id,
    details: { stockItemId, qty },
  });

  res.status(201).json(order);
});

module.exports = { list, getOne, create, update, remove, checklistTemplate, addMaterial };
