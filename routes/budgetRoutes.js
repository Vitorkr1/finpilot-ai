const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');
const { protect } = require('../middlewares/auth');

router.get('/budgets', protect, budgetController.showBudgets);

router.get('/api/budgets', protect, budgetController.listBudgets);
router.post('/api/budgets', protect, budgetController.createBudget);
router.put('/api/budgets/:id', protect, budgetController.updateBudget);
router.delete('/api/budgets/:id', protect, budgetController.deleteBudget);

module.exports = router;
