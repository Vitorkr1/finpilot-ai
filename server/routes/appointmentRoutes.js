const express = require('express');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, update, remove } = require('../controllers/appointmentController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.post('/', requireRole('admin', 'financeiro'), create);
router.patch('/:id', requireRole('admin', 'financeiro'), update);
router.delete('/:id', requireRole('admin', 'financeiro'), remove);

module.exports = router;
