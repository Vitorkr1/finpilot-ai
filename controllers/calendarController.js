const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

// GET /calendar
exports.showCalendar = asyncHandler(async (req, res) => {
  res.render('calendar/index', { title: 'Calendário de Fluxo de Caixa' });
});

// GET /api/calendar?month=2026-08
// Retorna, dia a dia, o que está agendado/pendente pra esse mês (boletos,
// recorrências já lançadas, etc.) — pra a pessoa ver de longe onde o
// dinheiro aperta antes de chegar o dia.
exports.getCalendarData = asyncHandler(async (req, res) => {
  const monthParam = req.query.month; // formato "YYYY-MM"
  const refDate = monthParam ? new Date(`${monthParam}-01T00:00:00`) : new Date();
  if (Number.isNaN(refDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Mês inválido.' });
  }

  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);

  const transactions = await Transaction.find({
    user: req.user._id,
    $or: [
      { dueDate: { $gte: start, $lt: end } },
      { dueDate: null, date: { $gte: start, $lt: end } }
    ]
  })
    .sort({ dueDate: 1, date: 1 })
    .populate('category', 'name icon color')
    .populate('bank', 'name color');

  const days = {};
  transactions.forEach((t) => {
    const refDay = t.dueDate || t.date;
    const key = refDay.toISOString().slice(0, 10);
    if (!days[key]) days[key] = { income: 0, expense: 0, items: [] };

    if (t.type === 'receita') days[key].income += t.amount;
    else if (t.type === 'despesa') days[key].expense += t.amount;

    days[key].items.push({
      id: t._id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      status: t.status,
      method: t.method,
      category: t.category ? { name: t.category.name, color: t.category.color } : null,
      bank: t.bank ? t.bank.name : null
    });
  });

  res.json({
    success: true,
    month: `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}`,
    days
  });
});
