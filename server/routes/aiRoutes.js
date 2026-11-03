const express = require('express');
const { requireAuth, requireTenant, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { draftBudget, clientSummary, ask } = require('../controllers/aiController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

// Assistente de IA é recurso Pro (Seção 5) — bloqueado na API.
router.use(requireAuth, requireTenant, loadCompany, requirePlan('pro'));
router.use(require('express-rate-limit')({ windowMs: 60000, limit: 20, keyGenerator: (req) => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Limite de consultas atingido. Aguarde um minuto.' } }));
router.post('/budget-draft', draftBudget);
router.post('/client-summary/:clientId', clientSummary);
router.post('/ask', ask);

module.exports = router;
