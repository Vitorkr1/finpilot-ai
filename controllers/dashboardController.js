const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const { calculateFinancialScore, classifyScore } = require('../services/scoreService');
const { detectSubscriptions } = require('../services/subscriptionService');
const asyncHandler = require('../utils/asyncHandler');

// GET /dashboard
exports.showDashboard = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const banks = await Bank.find({ user: userId, archived: false });
  const totalBalance = banks.reduce((s, b) => s + b.currentBalance, 0);
  const availableBalance = banks.reduce((s, b) => s + b.availableBalance, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);

  const monthTransactions = await Transaction.find({
    user: userId,
    date: { $gte: startOfMonth, $lt: endOfMonth }
  }).populate('category', 'name color icon').populate('bank', 'name color');

  const monthIncome = monthTransactions.filter((t) => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTransactions.filter((t) => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);

  const investmentsTotal = banks.filter((b) => b.type === 'Investimento').reduce((s, b) => s + b.currentBalance, 0);
  const savingsTotal = banks.filter((b) => b.type === 'Conta Poupança').reduce((s, b) => s + b.currentBalance, 0);
  const netWorth = totalBalance; // patrimônio simplificado = soma de todas as contas

  const recentTransactions = await Transaction.find({ user: userId })
    .sort({ date: -1, createdAt: -1 })
    .limit(8)
    .populate('category', 'name color icon')
    .populate('bank', 'name color');

  const upcomingBills = await Transaction.find({
    user: userId,
    status: { $in: ['pendente', 'agendado'] },
    date: { $gte: new Date() }
  })
    .sort({ date: 1 })
    .limit(6)
    .populate('bank', 'name color');

  // Boletos vencendo nos próximos 7 dias (ou já vencidos) — usa dueDate quando existe.
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const dueSoonBills = await Transaction.find({
    user: userId,
    status: 'pendente',
    dueDate: { $ne: null, $lte: in7Days }
  })
    .sort({ dueDate: 1 })
    .limit(8)
    .populate('bank', 'name color');

  // Previsão de saldo para os próximos 30 dias: saldo atual + tudo que está
  // pendente/agendado com vencimento nesse período (despesas entram negativas,
  // receitas positivas).
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const scheduledTx = await Transaction.find({
    user: userId,
    status: { $in: ['pendente', 'agendado'] },
    type: { $in: ['receita', 'despesa'] },
    $or: [{ dueDate: { $lte: in30Days } }, { dueDate: null, date: { $lte: in30Days } }]
  });
  const scheduledImpact = scheduledTx.reduce(
    (sum, t) => sum + (t.type === 'receita' ? t.amount : -t.amount),
    0
  );
  const projectedBalance30d = totalBalance + scheduledImpact;

  const subscriptions = await detectSubscriptions(userId);
  const subscriptionsTotal = subscriptions.reduce((s, sub) => s + sub.averageAmount, 0);

  const goals = await Goal.find({ user: userId, status: 'ativa' }).sort({ createdAt: -1 }).limit(4);

  const { score } = await calculateFinancialScore(userId);
  req.user.financialScore = score;
  await req.user.save();
  const scoreInfo = classifyScore(score);

  // Dados para gráfico de categorias (despesas do mês)
  const categoryMap = {};
  monthTransactions
    .filter((t) => t.type === 'despesa')
    .forEach((t) => {
      const key = t.category?.name || 'Sem categoria';
      categoryMap[key] = (categoryMap[key] || 0) + t.amount;
    });

  // Últimos 6 meses: receitas x despesas
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const historyTx = await Transaction.find({ user: userId, date: { $gte: sixMonthsAgo }, type: { $in: ['receita', 'despesa'] } });

  const monthlyFlow = {};
  historyTx.forEach((t) => {
    const key = `${t.date.getFullYear()}-${String(t.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyFlow[key]) monthlyFlow[key] = { receita: 0, despesa: 0 };
    monthlyFlow[key][t.type] += t.amount;
  });

  res.render('dashboard/index', {
    title: 'Dashboard',
    banks,
    totalBalance,
    availableBalance,
    monthIncome,
    monthExpense,
    investmentsTotal,
    savingsTotal,
    netWorth,
    recentTransactions,
    upcomingBills,
    dueSoonBills,
    projectedBalance30d,
    subscriptions,
    subscriptionsTotal,
    goals,
    score,
    scoreInfo,
    // .replace(/</g, ...) evita que um nome de categoria contendo "</script>"
    // feche a tag <script> prematuramente e injete HTML/JS arbitrário
    // (o valor é gerado a partir de nomes de categoria escolhidos pelo usuário)
    categoryChartData: JSON.stringify(categoryMap).replace(/</g, '\\u003c'),
    monthlyFlowData: JSON.stringify(monthlyFlow).replace(/</g, '\\u003c')
  });
});
