const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    from: { type: String, required: true },
    text: { type: String, default: '' },
    direction: { type: String, enum: ['in', 'out'], required: true },
    classification: {
      type: { type: String, default: null },
      urgency: { type: String, default: null },
    },
  },
  { timestamps: true }
);

whatsAppMessageSchema.index({ companyId: 1, createdAt: -1 });

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
