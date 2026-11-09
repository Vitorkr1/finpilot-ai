const { z } = require('zod');
const ServiceOrder = require('../models/ServiceOrder');
const Client = require('../models/Client');
const User = require('../models/User');
const StockItem = require('../models/StockItem');
const { getTemplate, getDefaultChecklist } = require('../services/checklistTemplates');
const cloudinary = require('../services/cloudinary');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');
const { dateTime, openingFields, executionFields, validateAttendance, attendanceUpdate } = require('../services/serviceOrderData');

const addMaterialSchema = z.object({
  stockItemId: v.objectId,
  qty: v.quantity.refine((value) => value > 0),
});

const createSchema = z.object({
  clientId: v.objectId,
  technicianId: v.objectId.optional(),
  segment: z.enum(['eletrica', 'solar', 'ar_condicionado', 'seguranca', 'manutencao', 'outro']).optional(),
  laborHours: v.quantity.optional(),
  ...openingFields,
}).strict();

const updateSchema = z.object({
  technicianId: v.objectId.nullable().optional(),
  status: z.enum(['aberta', 'em_andamento', 'concluida', 'cancelada']).optional(),
  laborHours: v.quantity.optional(),
  checklist: z.array(z.object({ item: v.name, done: z.boolean() })).max(200).optional(),
  ...openingFields,
  ...executionFields,
  expectedUpdatedAt: dateTime.optional(),
}).strict().refine((data) => Object.keys(data).some((key) => key !== 'expectedUpdatedAt'));

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  const query = z.object({ status: z.enum(['aberta', 'em_andamento', 'concluida', 'cancelada']).optional(), technicianId: v.objectId.optional() }).parse(req.query);
  if (query.status) filter.status = query.status;
  if (query.technicianId) filter.technicianId = query.technicianId;
  if (req.user.role === 'tecnico') filter.technicianId = req.user._id;
  const orders = await ServiceOrder.find(filter).sort({ createdAt: -1 });
  res.json(orders);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
  res.json(order);
});

const create = asyncHandler(async (req, res) => {
  const data = createSchema.parse(req.body);
  if (!data.calledAt) data.calledAt = new Date().toISOString();
  validateAttendance(data);

  const client = await Client.findOne({ _id: data.clientId, companyId: req.user.companyId });
  if (!client) return res.status(400).json({ error: 'Cliente não encontrado nesta empresa' });

  if (data.technicianId) {
    const tech = await User.findOne({ _id: data.technicianId, companyId: req.user.companyId, active: true, role: 'tecnico' });
    if (!tech) return res.status(400).json({ error: 'Técnico não encontrado nesta empresa' });
  }

  // Pro: checklist dinâmico por segmento. Basic: checklist fixo simples (Seção 5).
  const checklist = req.company.plan === 'pro' && data.segment ? getTemplate(data.segment) : getDefaultChecklist();

  const order = await transaction(async (session) => {
    const reference = await Client.findOneAndUpdate({ _id: data.clientId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session });
    if (!reference) throw v.httpError(400, 'Cliente não encontrado nesta empresa.');
    const [created] = await ServiceOrder.create([{ ...data, companyId: req.user.companyId, checklist }], { session });
    return created;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'ServiceOrder', entityId: order._id });
  res.status(201).json(order);
});

const update = asyncHandler(async (req, res) => {
  const { expectedUpdatedAt, ...data } = updateSchema.parse(req.body);
  if (req.user.role === 'tecnico' && ['technicianId', 'laborHours', 'calledAt', 'requestDescription'].some((key) => key in data)) throw v.httpError(403, 'Técnicos podem registrar a execução, o checklist e as pendências das próprias ordens. Os dados do chamado e a atribuição são alterados pela administração.');

  const scope = { _id: req.params.id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) };
  const current = await ServiceOrder.findOne(scope).lean();
  if (!current) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
  if (expectedUpdatedAt && new Date(expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) throw v.httpError(409, 'Esta OS foi alterada por outra pessoa. Feche o atendimento, atualize a lista e abra novamente para conferir os dados antes de salvar.');
  const patch = attendanceUpdate(current, data);

  if (data.technicianId) {
    const tech = await User.findOne({ _id: data.technicianId, companyId: req.user.companyId, active: true, role: 'tecnico' });
    if (!tech) return res.status(400).json({ error: 'Técnico não encontrado nesta empresa' });
  }

  const order = await ServiceOrder.findOneAndUpdate(
    { ...scope, updatedAt: current.updatedAt, __v: current.__v },
    { $set: patch, $inc: { __v: 1 } },
    { new: true, runValidators: true }
  );
  if (!order) throw v.httpError(409, 'Esta OS foi alterada durante o salvamento. Atualize a lista e confira os dados antes de tentar novamente.');
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'ServiceOrder', entityId: order._id });
  res.json(order);
});

async function deletionInfo(order, session = null) {
  const financial = await require('../models/FinancialEntry').exists({ companyId: order.companyId, relatedServiceOrderId: order._id }).session(session);
  const appointment = await require('../models/Appointment').exists({ companyId: order.companyId, serviceOrderId: order._id }).session(session);
  const reasons = [];
  if (order.materialsUsed?.length) reasons.push('Materiais usados');
  if (appointment) reasons.push('Agendamentos vinculados');
  if (financial) reasons.push('Lançamentos financeiros vinculados');
  return { canDelete: reasons.length === 0, reasons, status: order.status };
}

const checkDeletion = asyncHandler(async (req, res) => {
  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId }).select('companyId status materialsUsed').lean();
  if (!order) throw v.httpError(404, 'Ordem de serviço não encontrada.');
  res.json(await deletionInfo(order));
});

const remove = asyncHandler(async (req, res) => {
  let order;
  try {
    order = await transaction(async (session) => {
      const order = await ServiceOrder.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId }).session(session);
      if (!order) throw v.httpError(404, 'Ordem de serviço não encontrada.');
      const info = await deletionInfo(order, session);
      if (!info.canDelete) throw Object.assign(v.httpError(409, 'Esta OS possui vínculos e não pode ser excluída. Cancele a OS para preservar o histórico.'), { deletionInfo: info });
      return order;
    });
  } catch (error) {
    if (error.deletionInfo) return res.status(409).json({ error: error.message, code: 'OS_HAS_LINKS', ...error.deletionInfo });
    throw error;
  }
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

  const order = await transaction(async (session) => {
    const scope = { _id: req.params.id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) };
    const exists = await ServiceOrder.exists(scope).session(session);
    if (!exists) throw v.httpError(404, 'Ordem de serviço não encontrada.');
    const stockItem = await StockItem.findOneAndUpdate(
      { _id: stockItemId, companyId: req.user.companyId, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } }, { new: true, session });
    if (!stockItem) throw v.httpError(409, 'Estoque insuficiente ou item não encontrado.');
    return ServiceOrder.findOneAndUpdate(scope, { $push: { materialsUsed: { stockItemId, qty } } }, { new: true, runValidators: true, session });
  });

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

// Fotos e assinatura da OS vão para o Cloudinary (Seção 3/11) — nunca para o
// disco local, que some a cada reinício/deploy no Render free.
const addPhoto = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de imagem no campo "photo"' });

  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

  const url = await cloudinary.uploadBuffer(req.file.buffer, `criaos/${req.user.companyId}/service-orders`);
  const updated = await ServiceOrder.findOneAndUpdate({ _id: order._id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) }, { $push: { photos: url } }, { new: true });
  if (!updated) throw v.httpError(409, 'A ordem de serviço foi removida durante o envio.');

  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'add-photo', entity: 'ServiceOrder', entityId: order._id });
  res.status(201).json(updated);
});

const setSignature = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de imagem no campo "signature"' });

  const order = await ServiceOrder.findOne({ _id: req.params.id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) });
  if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

  const url = await cloudinary.uploadBuffer(req.file.buffer, `criaos/${req.user.companyId}/signatures`);
  const updated = await ServiceOrder.findOneAndUpdate({ _id: order._id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) }, { $set: { signatureUrl: url } }, { new: true });
  if (!updated) throw v.httpError(409, 'A ordem foi removida ou atribuída a outro técnico durante o envio.');

  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'set-signature', entity: 'ServiceOrder', entityId: order._id });
  res.status(201).json(order);
});

module.exports = { list, getOne, create, update, remove, checkDeletion, checklistTemplate, addMaterial, addPhoto, setSignature };
