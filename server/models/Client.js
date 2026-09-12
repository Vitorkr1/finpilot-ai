const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    document: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

clientSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('Client', clientSchema);
