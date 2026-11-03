const express = require('express');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, markPaid, remove } = require('../controllers/financialController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

// Financeiro essencial é recurso Basic (Seção 5) — disponível para todos os planos.
router.use(requireAuth, requireTenant, loadCompany, requireRole('admin', 'financeiro'));
router.get('/', list);
router.post('/', create);
router.patch('/:id/mark-paid', markPaid);
router.delete('/:id', remove);

module.exports = router;
