const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    bank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', required: true },
    destinationBank: { type: mongoose.Schema.Types.ObjectId, ref: 'Bank', default: null }, // para transferências
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },

    type: { type: String, enum: ['receita', 'despesa', 'transferencia'], required: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },

    method: {
      type: String,
      enum: ['PIX', 'Cartão', 'Boleto', 'TED', 'DOC', 'Dinheiro', 'Transferência', 'Outro'],
      default: 'PIX'
    },

    date: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, default: null }, // vencimento (principalmente para boletos)

    isRecurring: { type: Boolean, default: false },
    recurrenceFrequency: { type: String, enum: ['diaria', 'semanal', 'mensal', 'anual', null], default: null },

    isInstallment: { type: Boolean, default: false },
    installmentNumber: { type: Number, default: null },
    installmentTotal: { type: Number, default: null },
    installmentGroupId: { type: String, default: null },

    tags: [{ type: String, trim: true }],
    notes: { type: String, maxlength: 1000 },
    attachment: { type: String, default: null },

    status: { type: String, enum: ['pago', 'pendente', 'agendado'], default: 'pago' },

    // Dados do cliente para quem esse boleto foi emitido (opcional — só faz
    // sentido pra quem usa o FinPilot para cobrar os próprios clientes).
    // Permite que o cliente consulte a situação do boleto dele no portal
    // público, sem precisar de login. clientCpf guarda só dígitos (sem
    // pontuação) pra facilitar a busca exata.
    clientName: { type: String, trim: true, maxlength: 150, default: null },
    clientCpf: { type: String, trim: true, maxlength: 11, default: null },
    clientPhone: { type: String, trim: true, maxlength: 20, default: null },
    clientEmail: { type: String, trim: true, lowercase: true, maxlength: 150, default: null },

    // Preenchido só quando a transação veio de um extrato OFX importado —
    // é o ID único que o próprio banco dá pra cada lançamento (FITID),
    // usado pra nunca duplicar o mesmo lançamento se o usuário importar o
    // mesmo extrato (ou um extrato com período sobreposto) de novo.
    ofxFitId: { type: String, default: null },
    // Hash da linha original (mesma ideia do ofxFitId, mas pra importações
    // de CSV, que não têm um ID único do banco — usamos hash do conteúdo
    // da própria linha pra não duplicar se o usuário importar de novo).
    csvRowHash: { type: String, default: null }
  },
  { timestamps: true }
);

transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ clientCpf: 1, method: 1 });
transactionSchema.index({ user: 1, bank: 1, ofxFitId: 1 }, { unique: true, sparse: true });
transactionSchema.index({ user: 1, bank: 1, csvRowHash: 1 }, { unique: true, sparse: true });
transactionSchema.index({ user: 1, type: 1 });
transactionSchema.index({ description: 'text', notes: 'text', tags: 'text' });

module.exports = mongoose.model('Transaction', transactionSchema);
