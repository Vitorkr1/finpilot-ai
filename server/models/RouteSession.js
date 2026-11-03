const mongoose = require('mongoose');

const routeSessionSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  technicianId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true, select: false },
  consentAt: { type: Date, required: true },
  startedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  position: {
    type: new mongoose.Schema({
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      accuracy: { type: Number, required: true },
      capturedAt: { type: Date, required: true },
      receivedAt: { type: Date, required: true },
    }, { _id: false }),
    default: null,
  },
}, { versionKey: false });

routeSessionSchema.index({ companyId: 1, technicianId: 1 }, { unique: true });
routeSessionSchema.index({ tokenHash: 1 }, { unique: true });
routeSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RouteSession', routeSessionSchema);
