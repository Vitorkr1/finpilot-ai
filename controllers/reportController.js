const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

// GET /reports
exports.showReports = asyncHandler(async (req, res) => {
  res.render('reports/index', { title: 'Relatórios' });
});

// GET /api/reports/monthly?months=12
// Receita x despesa mês a mês, pros últimos N meses.
exports.getMonthlyComparison = asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 12, 24);
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const transactions = await Transaction.find({
    user: req.user._id,
    type: { $in: ['receita', 'despesa'] },
    date: { $gte: start }
  }).select('type amount date category').populate('category', 'name');

  const byMonth = {};
  transactions.forEach((t) => {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    if (!byMonth[key]) byMonth[key] = { receita: 0, despesa: 0 };
    byMonth[key][t.type] += t.amount;
  });

  // Garante que todo mês do intervalo apareça, mesmo sem movimentação (0/0)
  const labels = [];
  const cursor = new Date(start);
  for (let i = 0; i < months; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    labels.push(key);
    if (!byMonth[key]) byMonth[key] = { receita: 0, despesa: 0 };
    cursor.setMonth(cursor.getMonth() + 1);
  }

  res.json({
    success: true,
    labels,
    income: labels.map((k) => byMonth[k].receita),
    expense: labels.map((k) => byMonth[k].despesa)
  });
});

// GET /api/reports/yearly
// Compara o ano atual com o anterior, mês a mês (útil pra ver se determinado
// mês do ano está gastando mais ou menos que o mesmo mês do ano passado).
exports.getYearlyComparison = asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();
  const start = new Date(currentYear - 1, 0, 1);

  const transactions = await Transaction.find({
    user: req.user._id,
    type: 'despesa',
    date: { $gte: start }
  }).select('amount date');

  const byYearMonth = {};
  transactions.forEach((t) => {
    const y = t.date.getFullYear();
    const m = t.date.getMonth(); // 0-11
    if (!byYearMonth[y]) byYearMonth[y] = Array(12).fill(0);
    byYearMonth[y][m] += t.amount;
  });

  const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  res.json({
    success: true,
    labels: monthNames,
    currentYear,
    previousYear: currentYear - 1,
    currentYearData: byYearMonth[currentYear] || Array(12).fill(0),
    previousYearData: byYearMonth[currentYear - 1] || Array(12).fill(0)
  });
});

// GET /api/reports/category-comparison?months=6
// Total gasto por categoria, comparando a primeira e a segunda metade do
// período — mostra quais categorias estão crescendo ou encolhendo.
exports.getCategoryComparison = asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 12);
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);
  const mid = new Date();
  mid.setMonth(mid.getMonth() - Math.floor(months / 2));

  const transactions = await Transaction.find({
    user: req.user._id,
    type: 'despesa',
    date: { $gte: start },
    category: { $ne: null }
  }).populate('category', 'name color');

  const byCategory = {};
  transactions.forEach((t) => {
    if (!t.category) return;
    const key = t.category._id.toString();
    if (!byCategory[key]) byCategory[key] = { name: t.category.name, color: t.category.color, firstHalf: 0, secondHalf: 0 };
    if (t.date < mid) byCategory[key].firstHalf += t.amount;
    else byCategory[key].secondHalf += t.amount;
  });

  const result = Object.values(byCategory)
    .map((c) => ({
      ...c,
      change: c.firstHalf > 0 ? Math.round(((c.secondHalf - c.firstHalf) / c.firstHalf) * 100) : (c.secondHalf > 0 ? 100 : 0)
    }))
    .sort((a, b) => b.secondHalf - a.secondHalf);

  res.json({ success: true, categories: result });
});
