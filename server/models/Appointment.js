const mongoose = require('mongoose');

const STATUSES = ['agendado', 'confirmado', 'concluido', 'cancelado'];

const appointmentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    status: { type: String, enum: STATUSES, default: 'agendado' },
  },
  { timestamps: true }
);

appointmentSchema.index({ companyId: 1, technicianId: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.STATUSES = STATUSES;
