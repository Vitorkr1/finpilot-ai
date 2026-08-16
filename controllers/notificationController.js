const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const asyncHandler = require('../utils/asyncHandler');
const { monthRange } = require('./budgetController');

// GET /api/notifications
// Agrega tudo que merece um alerta no sininho: boletos vencendo/vencidos e
// orçamentos estourados ou perto do limite. Reaproveita os mesmos cálculos
// já usados no dashboard e na tela de orçamentos, sem duplicar regra de negócio.
exports.listNotifications = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const notifications = [];

  // ---- Boletos vencendo/vencidos ----
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const bills = await Transaction.find({
    user: userId,
    status: 'pendente',
    dueDate: { $ne: null, $lte: in7Days }
  }).sort({ dueDate: 1 }).limit(10);

  bills.forEach((b) => {
    const overdue = new Date(b.dueDate) < new Date();
    notifications.push({
      type: 'boleto',
      severity: overdue ? 'danger' : 'warning',
      title: overdue ? 'Boleto vencido' : 'Boleto vencendo',
      message: `${b.description} — ${b.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      date: b.dueDate,
      link: '/transactions'
    });
  });

  // ---- Orçamentos perto do limite ou estourados ----
  const budgets = await Budget.find({ user: userId }).populate('category', 'name');
  const { start, end } = monthRange();
  const spentByCategory = await Transaction.aggregate([
    { $match: { user: userId, type: 'despesa', date: { $gte: start, $lt: end }, category: { $ne: null } } },
    { $group: { _id: '$category', total: { $sum: '$amount' } } }
  ]);
  const spentMap = {};
  spentByCategory.forEach((s) => { spentMap[s._id.toString()] = s.total; });

  budgets.forEach((b) => {
    const spent = spentMap[b.category._id.toString()] || 0;
    const percent = Math.round((spent / b.monthlyLimit) * 100);
    if (percent >= 100) {
      notifications.push({
        type: 'orcamento',
        severity: 'danger',
        title: 'Orçamento estourado',
        message: `${b.category.name}: ${percent}% do limite mensal`,
        date: new Date(),
        link: '/budgets'
      });
    } else if (percent >= 80) {
      notifications.push({
        type: 'orcamento',
        severity: 'warning',
        title: 'Orçamento quase no limite',
        message: `${b.category.name}: ${percent}% do limite mensal`,
        date: new Date(),
        link: '/budgets'
      });
    }
  });

  notifications.sort((a, b) => new Date(a.date) - new Date(b.date));

  res.json({ success: true, notifications, count: notifications.length });
});
