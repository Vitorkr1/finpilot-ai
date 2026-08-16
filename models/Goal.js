const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    icon: { type: String, default: 'fa-solid fa-bullseye' },
    targetAmount: { type: Number, required: true, min: 1 },
    currentAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date, default: null },
    monthlyContribution: { type: Number, default: 0 },
    status: { type: String, enum: ['ativa', 'concluida', 'pausada'], default: 'ativa' }
  },
  { timestamps: true }
);

goalSchema.virtual('progress').get(function () {
  if (!this.targetAmount) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

goalSchema.set('toJSON', { virtuals: true });
goalSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Goal', goalSchema);
