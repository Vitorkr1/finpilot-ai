const { z } = require('zod');
const Client = require('../models/Client');
const Budget = require('../models/Budget');
const ServiceOrder = require('../models/ServiceOrder');
const ai = require('../services/ai');
const asyncHandler = require('../utils/asyncHandler');

const draftBudget = asyncHandler(async (req, res) => {
  const { description } = z.object({ description: z.string().trim().min(1).max(8000) }).parse(req.body);
  const items = await ai.draftBudgetItems(description);
  res.json({ items });
});

const clientSummary = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.clientId, companyId: req.user.companyId });
  if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

  const [budgets, serviceOrders] = await Promise.all([
    Budget.find({ clientId: client._id, companyId: req.user.companyId }).sort({ createdAt: -1 }).limit(20),
    ServiceOrder.find({ clientId: client._id, companyId: req.user.companyId, ...(req.user.role === 'tecnico' ? { technicianId: req.user._id } : {}) }).sort({ createdAt: -1 }).limit(20),
  ]);

  const summary = await ai.summarizeClientHistory({ client, budgets, serviceOrders });
  res.json({ summary });
});

const ask = asyncHandler(async (req, res) => {
  const { question } = z.object({ question: z.string().trim().min(1).max(8000) }).parse(req.body);
  const answer = await ai.answerQuestion(question);
  res.json({ answer });
});

module.exports = { draftBudget, clientSummary, ask };
