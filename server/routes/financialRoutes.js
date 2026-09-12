const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, markPaid, remove } = require('../controllers/financialController');

const router = express.Router();

// Financeiro essencial é recurso Basic (Seção 5) — disponível para todos os planos.
router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.post('/', create);
router.patch('/:id/mark-paid', markPaid);
router.delete('/:id', remove);

module.exports = router;
