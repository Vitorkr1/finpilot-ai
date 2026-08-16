const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    logo: { type: String, default: '' }, // identificador do ícone/logo pré-definido ou url
    color: { type: String, default: '#2563EB' },
    type: {
      type: String,
      enum: ['Conta Corrente', 'Conta Poupança', 'Carteira', 'Conta Digital', 'Cartão', 'Investimento', 'PIX'],
      default: 'Conta Corrente'
    },
    currentBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    // Apenas para type === 'Cartão': dia de fechamento e vencimento da fatura (1-31)
    closingDay: { type: Number, min: 1, max: 31, default: null },
    dueDay: { type: Number, min: 1, max: 31, default: null },
    isCustom: { type: Boolean, default: false },
    archived: { type: Boolean, default: false }
  },
  { timestamps: true }
);

bankSchema.index({ user: 1, archived: 1 });

module.exports = mongoose.model('Bank', bankSchema);
