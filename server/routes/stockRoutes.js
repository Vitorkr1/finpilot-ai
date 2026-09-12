const express = require('express');
const { requireAuth, requireTenant, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, update, remove } = require('../controllers/stockController');

const router = express.Router();

// Estoque e produtos são recurso Pro (Seção 5) — bloqueado na API, não só na UI.
router.use(requireAuth, requireTenant, loadCompany, requirePlan('pro'));
router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
