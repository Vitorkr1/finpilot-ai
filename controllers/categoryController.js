const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');

// GET /categories
exports.showCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ user: req.user._id }).sort({ type: 1, name: 1 });
  res.render('categories/index', { title: 'Categorias', categories });
});

// GET /api/categories
exports.listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ user: req.user._id }).sort({ type: 1, name: 1 });
  res.json({ success: true, categories });
});

// POST /api/categories
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, type, icon, color, parent } = req.body;
  if (!name || !type) return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });

  const category = await Category.create({
    user: req.user._id,
    name,
    type,
    icon: icon || 'fa-solid fa-tag',
    color: color || '#64748B',
    parent: parent || null
  });

  res.status(201).json({ success: true, category });
});

// PUT /api/categories/:id
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });

  ['name', 'icon', 'color', 'parent'].forEach((f) => {
    if (req.body[f] !== undefined) category[f] = req.body[f];
  });

  await category.save();
  res.json({ success: true, category });
});

// DELETE /api/categories/:id
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ _id: req.params.id, user: req.user._id });
  if (!category) return res.status(404).json({ success: false, message: 'Categoria não encontrada.' });
  if (category.isDefault) {
    return res.status(400).json({ success: false, message: 'Categorias padrão não podem ser excluídas.' });
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Categoria excluída com sucesso.' });
});
