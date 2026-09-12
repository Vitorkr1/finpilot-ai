const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, getOne, create, update, remove, convertToServiceOrder } = require('../controllers/budgetController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/convert', convertToServiceOrder);

module.exports = router;
