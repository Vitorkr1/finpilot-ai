const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { list, getOne } = require('../controllers/companyController');

const router = express.Router();

router.use(requireAuth, requireRole('super_admin'));
router.get('/', list);
router.get('/:id', getOne);

module.exports = router;
