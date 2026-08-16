const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    method: { type: String, enum: ['senha', 'facial'], default: 'senha' },
    ip: { type: String },
    device: { type: String }, // ex: "Chrome no Windows", já interpretado do User-Agent
    success: { type: Boolean, default: true }
  },
  { timestamps: true }
);

loginHistorySchema.index({ user: 1, createdAt: -1 });

// Mantém só os últimos 20 registros por usuário, apagando os mais antigos —
// evita a coleção crescer pra sempre sem precisar de um job de limpeza.
loginHistorySchema.statics.recordAndTrim = async function (entry) {
  await this.create(entry);
  const old = await this.find({ user: entry.user }).sort({ createdAt: -1 }).skip(20).select('_id');
  if (old.length > 0) await this.deleteMany({ _id: { $in: old.map((o) => o._id) } });
};

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
