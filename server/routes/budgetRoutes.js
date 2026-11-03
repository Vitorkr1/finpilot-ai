const express = require('express');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, getOne, create, update, remove, convertToServiceOrder, downloadPdf } = require('../controllers/budgetController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.get('/:id', getOne);
router.get('/:id/pdf', downloadPdf);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/convert', requireRole('admin', 'financeiro'), convertToServiceOrder);

module.exports = router;
