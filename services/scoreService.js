const Transaction = require('../models/Transaction');
const Bank = require('../models/Bank');
const Goal = require('../models/Goal');

/**
 * Calcula o Score Financeiro (0 a 1000) com base em:
 * - Saldo total positivo/negativo
 * - Relação receitas x despesas dos últimos 3 meses
 * - Consistência de poupança
 * - Diversificação de contas
 * - Progresso em metas
 * - Presença de reserva de emergência
 */
async function calculateFinancialScore(userId) {
  const banks = await Bank.find({ user: userId, archived: false });
  const totalBalance = banks.reduce((sum, b) => sum + b.currentBalance, 0);

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: threeMonthsAgo },
    type: { $in: ['receita', 'despesa'] }
  });

  const income = transactions.filter((t) => t.type === 'receita').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter((t) => t.type === 'despesa').reduce((s, t) => s + t.amount, 0);

  let score = 500;
  const factors = [];

  // 1. Saldo total (peso alto)
  if (totalBalance > 0) {
    score += Math.min(150, Math.floor(totalBalance / 1000) * 10);
    factors.push({ label: 'Saldo positivo', impact: 'positivo' });
  } else if (totalBalance < 0) {
    score -= 150;
    factors.push({ label: 'Saldo negativo', impact: 'negativo' });
  }

  // 2. Relação receita x despesa
  if (income > 0) {
    const savingsRate = (income - expense) / income;
    if (savingsRate >= 0.3) {
      score += 150;
      factors.push({ label: 'Excelente taxa de poupança (30%+)', impact: 'positivo' });
    } else if (savingsRate >= 0.15) {
      score += 90;
      factors.push({ label: 'Boa taxa de poupança', impact: 'positivo' });
    } else if (savingsRate >= 0) {
      score += 30;
      factors.push({ label: 'Taxa de poupança baixa', impact: 'neutro' });
    } else {
      score -= 120;
      factors.push({ label: 'Gastando mais do que ganha', impact: 'negativo' });
    }
  }

  // 3. Diversificação de contas
  if (banks.length >= 2) {
    score += 40;
    factors.push({ label: 'Contas diversificadas', impact: 'positivo' });
  }

  // 4. Metas ativas com progresso
  const goals = await Goal.find({ user: userId, status: { $ne: 'concluida' } });
  const goalsWithProgress = goals.filter((g) => g.currentAmount > 0);
  if (goalsWithProgress.length > 0) {
    score += Math.min(60, goalsWithProgress.length * 20);
    factors.push({ label: 'Metas com progresso ativo', impact: 'positivo' });
  }

  // 5. Reserva de emergência (heurística: alguma conta do tipo Investimento/Poupança com saldo >= 3x despesa mensal)
  const avgMonthlyExpense = expense / 3 || 0;
  const reserveBanks = banks.filter((b) => ['Investimento', 'Conta Poupança'].includes(b.type));
  const reserveTotal = reserveBanks.reduce((s, b) => s + b.currentBalance, 0);
  if (avgMonthlyExpense > 0 && reserveTotal >= avgMonthlyExpense * 3) {
    score += 100;
    factors.push({ label: 'Reserva de emergência adequada', impact: 'positivo' });
  } else if (reserveTotal > 0) {
    score += 30;
    factors.push({ label: 'Reserva de emergência parcial', impact: 'neutro' });
  } else {
    factors.push({ label: 'Sem reserva de emergência identificada', impact: 'negativo' });
  }

  score = Math.max(0, Math.min(1000, Math.round(score)));

  return { score, factors, totalBalance, income, expense };
}

function classifyScore(score) {
  if (score >= 850) return { label: 'Excelente', color: '#22C55E' };
  if (score >= 700) return { label: 'Muito Bom', color: '#65A30D' };
  if (score >= 550) return { label: 'Bom', color: '#EAB308' };
  if (score >= 350) return { label: 'Regular', color: '#F97316' };
  return { label: 'Precisa de Atenção', color: '#EF4444' };
}

module.exports = { calculateFinancialScore, classifyScore };
