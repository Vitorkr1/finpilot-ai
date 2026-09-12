const express = require('express');
const rateLimit = require('express-rate-limit');
const { bootstrapSuperAdmin, resetSuperAdminPassword } = require('../controllers/setupController');

const router = express.Router();

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/bootstrap-super-admin', setupLimiter, bootstrapSuperAdmin);
router.post('/reset-super-admin-password', setupLimiter, resetSuperAdminPassword);

module.exports = router;
