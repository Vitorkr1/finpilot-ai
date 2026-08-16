const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

router.get('/api/notifications', protect, notificationController.listNotifications);

module.exports = router;
