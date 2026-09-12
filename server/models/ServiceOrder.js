const mongoose = require('mongoose');
const { SEGMENTS } = require('./Company');

const STATUSES = ['aberta', 'em_andamento', 'concluida', 'cancelada'];

const checklistItemSchema = new mongoose.Schema(
  { item: { type: String, required: true, trim: true }, done: { type: Boolean, default: false } },
  { _id: false }
);

const materialUsedSchema = new mongoose.Schema(
  {
    stockItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockItem' },
    qty: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const serviceOrderSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    budgetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Budget', default: null },
    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    segment: { type: String, enum: SEGMENTS, default: 'outro' },
    checklist: { type: [checklistItemSchema], default: [] },
    photos: { type: [String], default: [] },
    signatureUrl: { type: String, default: null },
    materialsUsed: { type: [materialUsedSchema], default: [] },
    laborHours: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: STATUSES, default: 'aberta' },
  },
  { timestamps: true }
);

serviceOrderSchema.index({ companyId: 1, status: 1 });
serviceOrderSchema.index({ companyId: 1, technicianId: 1 });

module.exports = mongoose.model('ServiceOrder', serviceOrderSchema);
module.exports.STATUSES = STATUSES;
