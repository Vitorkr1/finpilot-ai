const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { protect } = require('../middlewares/auth');

router.get('/calendar', protect, calendarController.showCalendar);
router.get('/api/calendar', protect, calendarController.getCalendarData);

module.exports = router;
