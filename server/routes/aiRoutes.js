const express = require('express');
const { requireAuth, requireTenant, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { draftBudget, clientSummary, ask } = require('../controllers/aiController');

const router = express.Router();

// Assistente de IA é recurso Pro (Seção 5) — bloqueado na API.
router.use(requireAuth, requireTenant, loadCompany, requirePlan('pro'));
router.post('/budget-draft', draftBudget);
router.post('/client-summary/:clientId', clientSummary);
router.post('/ask', ask);

module.exports = router;
