const express = require('express');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, setActive } = require('../controllers/userController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', requireRole('admin'), list);
router.post('/', requireRole('admin'), create);
router.patch('/:id/active', requireRole('admin'), setActive);

module.exports = router;
