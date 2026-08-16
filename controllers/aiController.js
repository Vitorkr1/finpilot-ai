const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const { calculateFinancialScore } = require('../services/scoreService');
const aiService = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');

async function getUserFinancialData(userId) {
  const [banks, transactions, goals, { score }] = await Promise.all([
    Bank.find({ user: userId, archived: false }),
    Transaction.find({ user: userId }).sort({ date: -1 }).limit(80).populate('category', 'name'),
    Goal.find({ user: userId, status: { $ne: 'concluida' } }),
    calculateFinancialScore(userId)
  ]);
  return { banks, transactions, goals, score };
}

// GET /ai
exports.showAIPage = asyncHandler(async (req, res) => {
  res.render('ai/index', { title: 'Consultor Financeiro IA' });
});

// POST /api/ai/ask
exports.ask = asyncHandler(async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ success: false, message: 'Digite uma pergunta.' });
  }

  const data = await getUserFinancialData(req.user._id);
  const result = await aiService.askFinancialAdvisor({ question, ...data });

  res.json({ success: true, ...result });
});

// GET /api/ai/insights
exports.getInsights = asyncHandler(async (req, res) => {
  const data = await getUserFinancialData(req.user._id);
  const result = await aiService.generateInsights(data);
  res.json({ success: true, ...result });
});
