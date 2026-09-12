const mongoose = require('mongoose');

const stockItemSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    minQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, default: 'un', trim: true },
  },
  { timestamps: true }
);

stockItemSchema.index({ companyId: 1, name: 1 });

module.exports = mongoose.model('StockItem', stockItemSchema);
