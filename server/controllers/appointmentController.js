const { z } = require('zod');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const appointmentSchema = z.object({
  technicianId: z.string().min(1),
  serviceOrderId: z.string().nullable().optional(),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.enum(['agendado', 'confirmado', 'concluido', 'cancelado']).optional(),
});

async function assertTechnicianBelongsToCompany(technicianId, companyId) {
  const tech = await User.findOne({ _id: technicianId, companyId, role: 'tecnico' });
  if (!tech) {
    const err = new Error('Técnico não encontrado nesta empresa');
    err.status = 400;
    throw err;
  }
}

const list = asyncHandler(async (req, res) => {
  const filter = { companyId: req.user.companyId };
  if (req.query.technicianId) filter.technicianId = req.query.technicianId;
  if (req.query.date) {
    const day = new Date(req.query.date);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    filter.date = { $gte: day, $lt: next };
  }
  const appointments = await Appointment.find(filter).sort({ date: 1, startTime: 1 });
  res.json(appointments);
});

const create = asyncHandler(async (req, res) => {
  const data = appointmentSchema.parse(req.body);
  await assertTechnicianBelongsToCompany(data.technicianId, req.user.companyId);

  const appointment = await Appointment.create({ ...data, companyId: req.user.companyId, date: new Date(data.date) });
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'create', entity: 'Appointment', entityId: appointment._id });
  res.status(201).json(appointment);
});

const update = asyncHandler(async (req, res) => {
  const data = appointmentSchema.partial().parse(req.body);
  if (data.technicianId) {
    await assertTechnicianBelongsToCompany(data.technicianId, req.user.companyId);
  }
  if (data.date) data.date = new Date(data.date);

  const appointment = await Appointment.findOneAndUpdate(
    { _id: req.params.id, companyId: req.user.companyId },
    data,
    { new: true }
  );
  if (!appointment) return res.status(404).json({ error: 'Agendamento não encontrado' });
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
