const { z } = require('zod');
const Client = require('../models/Client');
const Budget = require('../models/Budget');
const ServiceOrder = require('../models/ServiceOrder');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

const clientSchema = z.object({
  name: v.name,
  phone: v.text(40).optional(),
  document: v.text(40).optional(),
  address: v.text(500).optional(),
  notes: v.text().optional(),
});

const list = asyncHandler(async (req, res) => {
  const clients = await Client.find({ companyId: req.user.companyId }).sort({ name: 1 });
  res.json(clients);
});

const getOne = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  res.json(client);
});

const create = asyncHandler(async (req, res) => {
  const data = clientSchema.parse(req.body);
  const client = await Client.create({ ...data, companyId: req.user.companyId });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'Client', entityId: client._id });
  res.status(201).json(client);
});

const update = asyncHandler(async (req, res) => {
  const data = clientSchema.partial().parse(req.body);
  const client = await Client.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    data,
    { new: true }
  );
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'Client', entityId: client._id });
  res.json(client);
});

const remove = asyncHandler(async (req, res) => {
  const client = await transaction(async (session) => {
    const client = await Client.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId }).session(session);
    if (!client) throw v.httpError(404, 'Cliente não encontrado.');
    const budget = await Budget.exists({ clientId: client._id, companyId: req.user.companyId }).session(session);
    const order = await ServiceOrder.exists({ clientId: client._id, companyId: req.user.companyId }).session(session);
    if (budget || order) throw v.httpError(409, 'Este cliente tem orçamentos ou ordens de serviço. Preserve o histórico antes de excluir.');
    return client;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'Client', entityId: client._id });
  res.status(204).end();
});

const history = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, companyId: req.user.companyId });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const [budgets, serviceOrders] = await Promise.all([
    Budget.find({ clientId: client._id, companyId: req.user.companyId }).sort({ createdAt: -1 }),
    ServiceOrder.find({ clientId: client._id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) }).sort({ createdAt: -1 }),
  ]);

  res.json({ client, budgets, serviceOrders });
});

module.exports = { list, getOne, create, update, remove, history };
