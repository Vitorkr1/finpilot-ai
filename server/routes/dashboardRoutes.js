const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { summary } = require('../controllers/dashboardController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/summary', summary);

module.exports = router;
