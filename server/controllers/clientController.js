const { z } = require('zod');
const Client = require('../models/Client');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const clientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  document: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
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
  const client = await Client.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'Client', entityId: client._id });
  res.status(204).end();
});

module.exports = { list, getOne, create, update, remove };
