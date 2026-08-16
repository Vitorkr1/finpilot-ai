const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

function monthRange(refDate = new Date()) {
  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

// GET /budgets
exports.showBudgets = asyncHandler(async (req, res) => {
  const categories = await Category.find({ user: req.user._id, type: 'despesa' }).sort({ name: 1 });
  res.render('budgets/index', { title: 'Orçamentos', categories });
});

// GET /api/budgets  (com o gasto já calculado no mês atual)
exports.listBudgets = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({ user: req.user._id }).populate('category', 'name icon color type');
  const { start, end } = monthRange();

  const spentByCategory = await Transaction.aggregate([
    {
      $match: {
        user: req.user._id,
        type: 'despesa',
        date: { $gte: start, $lt: end },
        category: { $ne: null }
      }
    },
    { $group: { _id: '$category', total: { $sum: '$amount' } } }
  ]);

  const spentMap = {};
  spentByCategory.forEach((s) => { spentMap[s._id.toString()] = s.total; });

  const result = budgets.map((b) => {
    const spent = spentMap[b.category._id.toString()] || 0;
    const percent = Math.round((spent / b.monthlyLimit) * 100);
    return {
      ...b.toObject(),
      spent,
      percent,
      status: percent >= 100 ? 'estourado' : percent >= 80 ? 'atencao' : 'ok'
    };
  });

  res.json({ success: true, budgets: result });
});

// POST /api/budgets
exports.createBudget = asyncHandler(async (req, res) => {
  const { category, monthlyLimit } = req.body;
  if (!category || !monthlyLimit) {
    return res.status(400).json({ success: false, message: 'Selecione a categoria e informe o limite mensal.' });
  }

  const ownerCategory = await Category.findOne({ _id: category, user: req.user._id });
  if (!ownerCategory) return res.status(404).json({ success: false, message: 'Categoria inválida.' });

  const existing = await Budget.findOne({ user: req.user._id, category });
  if (existing) {
    existing.monthlyLimit = Number(monthlyLimit);
    await existing.save();
    return res.json({ success: true, budget: existing });
  }

  const budget = await Budget.create({ user: req.user._id, category, monthlyLimit: Number(monthlyLimit) });
  res.status(201).json({ success: true, budget });
});

// PUT /api/budgets/:id
exports.updateBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
  if (!budget) return res.status(404).json({ success: false, message: 'Orçamento não encontrado.' });

  if (req.body.monthlyLimit !== undefined) budget.monthlyLimit = Number(req.body.monthlyLimit);
  await budget.save();
  res.json({ success: true, budget });
});

// DELETE /api/budgets/:id
exports.deleteBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
  if (!budget) return res.status(404).json({ success: false, message: 'Orçamento não encontrado.' });
  await budget.deleteOne();
  res.json({ success: true, message: 'Orçamento removido.' });
});

module.exports.monthRange = monthRange;
