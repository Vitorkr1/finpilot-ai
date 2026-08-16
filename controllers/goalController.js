const Goal = require('../models/Goal');
const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const asyncHandler = require('../utils/asyncHandler');

function projectCompletion(goal) {
  if (!goal.monthlyContribution || goal.monthlyContribution <= 0) return null;
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return new Date();
  const monthsNeeded = Math.ceil(remaining / goal.monthlyContribution);
  const projected = new Date();
  projected.setMonth(projected.getMonth() + monthsNeeded);
  return projected;
}

// GET /goals
exports.showGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
  const banks = await Bank.find({ user: req.user._id, archived: false }).sort({ createdAt: 1 });
  res.render('goals/index', { title: 'Minhas Metas', goals, banks });
});

// GET /api/goals
exports.listGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
  const withProjection = goals.map((g) => ({
    ...g.toObject(),
    estimatedCompletion: projectCompletion(g)
  }));
  res.json({ success: true, goals: withProjection });
});

// POST /api/goals
exports.createGoal = asyncHandler(async (req, res) => {
  const { title, icon, targetAmount, currentAmount, deadline, monthlyContribution } = req.body;
  if (!title || !targetAmount) {
    return res.status(400).json({ success: false, message: 'Informe título e valor alvo da meta.' });
  }

  const goal = await Goal.create({
    user: req.user._id,
    title,
    icon: icon || 'fa-solid fa-bullseye',
    targetAmount: Number(targetAmount),
    currentAmount: Number(currentAmount) || 0,
    deadline: deadline || null,
    monthlyContribution: Number(monthlyContribution) || 0
  });

  res.status(201).json({ success: true, goal });
});

// PUT /api/goals/:id
exports.updateGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ success: false, message: 'Meta não encontrada.' });

  ['title', 'icon', 'targetAmount', 'currentAmount', 'deadline', 'monthlyContribution', 'status'].forEach((f) => {
    if (req.body[f] !== undefined) goal[f] = req.body[f];
  });

  if (goal.currentAmount >= goal.targetAmount) goal.status = 'concluida';

  await goal.save();
  res.json({ success: true, goal });
});

// POST /api/goals/:id/contribute
// Se "bank" for informado, o valor sai de verdade daquela conta (cria uma
// transação de despesa "Aporte para meta"), mantendo o saldo consistente.
// Se não, apenas soma no valor já guardado da meta (contribuição manual/fora do app).
exports.contributeToGoal = asyncHandler(async (req, res) => {
  const { amount, bank } = req.body;
  const value = Number(amount) || 0;
  if (value <= 0) return res.status(400).json({ success: false, message: 'Informe um valor válido.' });

  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ success: false, message: 'Meta não encontrada.' });

  let transaction = null;
  if (bank) {
    const ownerBank = await Bank.findOne({ _id: bank, user: req.user._id });
    if (!ownerBank) return res.status(404).json({ success: false, message: 'Banco inválido.' });

    ownerBank.currentBalance -= value;
    ownerBank.availableBalance -= value;
    await ownerBank.save();

    transaction = await Transaction.create({
      user: req.user._id,
      bank: ownerBank._id,
      type: 'despesa',
      description: `Aporte para meta: ${goal.title}`,
      amount: value,
      method: 'Transferência',
      date: new Date(),
      status: 'pago',
      notes: `Aporte automático vinculado à meta "${goal.title}".`
    });
  }

  goal.currentAmount += value;
  if (goal.currentAmount >= goal.targetAmount) {
    goal.currentAmount = goal.targetAmount;
    goal.status = 'concluida';
  }

  await goal.save();
  res.json({ success: true, goal, transaction });
});

// DELETE /api/goals/:id
exports.deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) return res.status(404).json({ success: false, message: 'Meta não encontrada.' });
  await goal.deleteOne();
  res.json({ success: true, message: 'Meta excluída com sucesso.' });
});
