const mongoose = require('mongoose');

const TYPES = ['receita', 'despesa'];

const financialEntrySchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    type: { type: String, enum: TYPES, required: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date, default: null },
    relatedServiceOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
  },
  { timestamps: true }
);

financialEntrySchema.index({ companyId: 1, dueDate: 1 });
financialEntrySchema.index({ companyId: 1, type: 1, paidDate: 1 });

module.exports = mongoose.model('FinancialEntry', financialEntrySchema);
module.exports.TYPES = TYPES;
