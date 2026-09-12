const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, create, update, remove } = require('../controllers/appointmentController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
