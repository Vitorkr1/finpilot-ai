const mongoose = require('mongoose');

const SEGMENTS = ['eletrica', 'solar', 'ar_condicionado', 'seguranca', 'manutencao', 'outro'];
const PLANS = ['basic', 'pro'];
const SUBSCRIPTION_STATUSES = ['active', 'overdue', 'suspended'];

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cnpj: { type: String, trim: true },
    segment: { type: String, enum: SEGMENTS, default: 'outro' },
    plan: { type: String, enum: PLANS, default: 'basic' },
    price: { type: Number, default: null },
    subscriptionStatus: { type: String, enum: SUBSCRIPTION_STATUSES, default: 'active' },
    nextDueDate: { type: Date },
  },
  { timestamps: true }
);

companySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Company', companySchema);
module.exports.SEGMENTS = SEGMENTS;
module.exports.PLANS = PLANS;
module.exports.SUBSCRIPTION_STATUSES = SUBSCRIPTION_STATUSES;
