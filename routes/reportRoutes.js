const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middlewares/auth');

router.get('/reports', protect, reportController.showReports);

router.get('/api/reports/monthly', protect, reportController.getMonthlyComparison);
router.get('/api/reports/yearly', protect, reportController.getYearlyComparison);
router.get('/api/reports/category-comparison', protect, reportController.getCategoryComparison);

module.exports = router;
