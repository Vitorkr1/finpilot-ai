const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');

router.get('/dashboard', protect, dashboardController.showDashboard);

module.exports = router;
