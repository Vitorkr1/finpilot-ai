const { z } = require('zod');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const ServiceOrder = require('../models/ServiceOrder');
const v = require('../utils/validation');
const transaction = require('../utils/transaction');

const appointmentSchema = z.object({
  technicianId: v.objectId,
  serviceOrderId: v.objectId.nullable().optional(),
  date: v.date,
  startTime: v.time,
  endTime: v.time,
  status: z.enum(['agendado', 'confirmado', 'concluido', 'cancelado']).optional(),
});

async function assertTechnicianBelongsToCompany(technicianId, companyId) {
  const tech = await User.findOne({ _id: technicianId, companyId, role: 'tecnico', active: true });
  if (!tech) {
    const err = new Error('Técnico não encontrado nesta empresa');
    err.status = 400;
    throw err;
  }
}

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  const query = z.object({ technicianId: v.objectId.optional(), date: v.date.optional() }).parse(req.query);
  if (query.technicianId) filter.technicianId = query.technicianId;
  if (req.user.role === 'tecnico') filter.technicianId = req.user._id;
  if (query.date) {
    const day = new Date(query.date);
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    filter.date = { $gte: day, $lt: next };
  }
  const appointments = await Appointment.find(filter).sort({ date: 1, startTime: 1 });
  res.json(appointments);
});

async function validateAppointment(data, companyId) {
  if (data.endTime <= data.startTime) throw v.httpError(400, 'O horário final precisa ser posterior ao inicial.');
  await assertTechnicianBelongsToCompany(data.technicianId, companyId);
  if (data.serviceOrderId && !await ServiceOrder.exists({ _id: data.serviceOrderId, companyId })) throw v.httpError(400, 'Ordem de serviço não encontrada nesta empresa.');
}

const create = asyncHandler(async (req, res) => {
  const data = appointmentSchema.parse(req.body);
  await validateAppointment(data, req.user.companyId);

  const appointment = await transaction(async (session) => {
    if (data.serviceOrderId && !await ServiceOrder.findOneAndUpdate({ _id: data.serviceOrderId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session })) throw v.httpError(400, 'Ordem de serviço não encontrada nesta empresa.');
    const [created] = await Appointment.create([{ ...data, companyId: req.user.companyId, date: new Date(data.date) }], { session });
    return created;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'Appointment', entityId: appointment._id });
  res.status(201).json(appointment);
});

const update = asyncHandler(async (req, res) => {
  const data = appointmentSchema.partial().parse(req.body);
  const appointment = await transaction(async (session) => {
    const current = await Appointment.findOne({ _id: req.params.id, companyId: req.user.companyId }).session(session);
    if (!current) throw v.httpError(404, 'Agendamento não encontrado.');
    const merged = { ...current.toObject(), ...data };
    await validateAppointment(merged, req.user.companyId);
    if (merged.serviceOrderId && !await ServiceOrder.findOneAndUpdate({ _id: merged.serviceOrderId, companyId: req.user.companyId }, { $inc: { __v: 1 } }, { session })) throw v.httpError(400, 'Ordem de serviço não encontrada nesta empresa.');
    Object.assign(current, data, data.date ? { date: new Date(data.date) } : {});
    await current.save({ session });
    return current;
  });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'update', entity: 'Appointment', entityId: appointment._id });
  res.json(appointment);
});

const remove = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
  if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'delete', entity: 'Appointment', entityId: appointment._id });
  res.status(204).end();
});

module.exports = { list, create, update, remove };
