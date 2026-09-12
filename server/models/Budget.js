const mongoose = require('mongoose');

const STATUSES = ['rascunho', 'enviado', 'aprovado', 'recusado'];

const budgetItemSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const budgetSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    items: { type: [budgetItemSchema], default: [] },
    total: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'rascunho' },
    convertedToServiceOrder: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetSchema.index({ companyId: 1, clientId: 1 });

budgetSchema.pre('validate', function computeTotal(next) {
  this.total = this.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  next();
});

module.exports = mongoose.model('Budget', budgetSchema);
module.exports.STATUSES = STATUSES;
