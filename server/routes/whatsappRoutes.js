const express = require('express');
const { requireAuth, requireTenant, requireRole, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { connect, status, disconnect } = require('../controllers/whatsappController');

const router = express.Router();

// Atendimento via WhatsApp é recurso Pro (Seção 5/8), restrito a admin.
router.use(requireAuth, requireTenant, loadCompany, requirePlan('pro'), requireRole('admin'));
router.post('/connect', connect);
router.get('/status', status);
router.post('/disconnect', disconnect);

module.exports = router;
