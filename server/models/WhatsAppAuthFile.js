const mongoose = require('mongoose');

// Seção 8/11 do spec: credenciais do Baileys NUNCA em disco (Render free apaga
// tudo a cada reinício) — persistidas aqui, uma "pasta" virtual por empresa.
const whatsAppAuthFileSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    file: { type: String, required: true },
    data: { type: String, required: true },
  },
  { timestamps: true }
);

whatsAppAuthFileSchema.index({ companyId: 1, file: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppAuthFile', whatsAppAuthFileSchema);
