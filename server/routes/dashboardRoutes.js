const express = require('express');
const { requireAuth, requireTenant } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { summary } = require('../controllers/dashboardController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/summary', summary);

module.exports = router;
