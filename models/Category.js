const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['receita', 'despesa'], required: true },
    icon: { type: String, default: 'fa-solid fa-tag' },
    color: { type: String, default: '#64748B' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
