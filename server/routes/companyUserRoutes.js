const express = require('express');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, listTechnicians, create, setActive } = require('../controllers/userController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', requireRole('admin'), list);
router.get('/technicians', requireRole('admin', 'financeiro'), listTechnicians);
router.post('/', requireRole('admin'), create);
router.patch('/:id/active', requireRole('admin'), setActive);

module.exports = router;
