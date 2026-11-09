const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, required: true },
  requestId: { type: String, required: true },
  fingerprint: { type: String, required: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});
schema.index({ companyId: 1, requestId: 1 }, { unique: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model('ClientImport', schema);
