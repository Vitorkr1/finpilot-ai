const Transaction = require('../models/Transaction');

/**
 * Detecta possíveis assinaturas/gastos recorrentes analisando o histórico de
 * despesas do usuário: mesma descrição (normalizada) aparecendo em pelo menos
 * 2 meses diferentes nos últimos 6 meses, com valor parecido (variação < 20%).
 * Não depende do usuário ter marcado "isRecurring" manualmente — é detecção
 * automática por padrão de comportamento.
 */
async function detectSubscriptions(userId) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const transactions = await Transaction.find({
    user: userId,
    type: 'despesa',
    date: { $gte: sixMonthsAgo }
  })
    .sort({ date: -1 })
    .populate('bank', 'name')
    .populate('category', 'name icon color');

  const groups = {};
  transactions.forEach((t) => {
    const key = t.description.trim().toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const subscriptions = [];

  Object.values(groups).forEach((group) => {
    if (group.length < 2) return;

    const distinctMonths = new Set(group.map((t) => `${t.date.getFullYear()}-${t.date.getMonth()}`));
    if (distinctMonths.size < 2) return;

    const amounts = group.map((t) => t.amount);
    const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const maxDeviation = Math.max(...amounts.map((a) => Math.abs(a - avg) / avg));
    if (maxDeviation > 0.2) return; // valores variam demais, provavelmente não é assinatura

    const sorted = [...group].sort((a, b) => b.date - a.date);
    const last = sorted[0];
    const nextExpected = new Date(last.date);
    nextExpected.setMonth(nextExpected.getMonth() + 1);

    subscriptions.push({
      description: last.description,
      bank: last.bank ? last.bank.name : null,
      category: last.category ? last.category.name : null,
      averageAmount: Math.round(avg * 100) / 100,
      lastAmount: last.amount,
      occurrences: group.length,
      monthsDetected: distinctMonths.size,
      lastDate: last.date,
      nextExpected
    });
  });

  return subscriptions.sort((a, b) => b.averageAmount - a.averageAmount);
}

module.exports = { detectSubscriptions };
