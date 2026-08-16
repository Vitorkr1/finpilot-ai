const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { protect } = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');

router.get('/ai', protect, aiController.showAIPage);

router.post('/api/ai/ask', protect, aiLimiter, aiController.ask);
router.get('/api/ai/insights', protect, aiLimiter, aiController.getInsights);

module.exports = router;
