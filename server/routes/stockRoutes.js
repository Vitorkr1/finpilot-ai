const express = require('express');
const { requireAuth, requireTenant, requirePlan, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, update, remove } = require('../controllers/stockController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

// Estoque e produtos são recurso Pro (Seção 5) — bloqueado na API, não só na UI.
router.use(requireAuth, requireTenant, loadCompany, requirePlan('pro'));
router.get('/', list);
router.post('/', requireRole('admin', 'financeiro'), create);
router.patch('/:id', requireRole('admin', 'financeiro'), update);
router.delete('/:id', requireRole('admin', 'financeiro'), remove);

module.exports = router;
