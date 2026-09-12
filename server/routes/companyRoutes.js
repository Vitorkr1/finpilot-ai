const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { list, getOne, create, update, setPlan, markPaid, suspend, remove } = require('../controllers/companyController');

const router = express.Router();

router.use(requireAuth, requireRole('super_admin'));
router.get('/', list);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);
router.patch('/:id/plan', setPlan);
router.patch('/:id/mark-paid', markPaid);
router.patch('/:id/suspend', suspend);
router.delete('/:id', remove);

module.exports = router;
