const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const { protect } = require('../middlewares/auth');

router.get('/goals', protect, goalController.showGoals);

router.get('/api/goals', protect, goalController.listGoals);
router.post('/api/goals', protect, goalController.createGoal);
router.put('/api/goals/:id', protect, goalController.updateGoal);
router.post('/api/goals/:id/contribute', protect, goalController.contributeToGoal);
router.delete('/api/goals/:id', protect, goalController.deleteGoal);

module.exports = router;
