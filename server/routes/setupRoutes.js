const express = require('express');
const rateLimit = require('express-rate-limit');
const { bootstrapSuperAdmin } = require('../controllers/setupController');

const router = express.Router();

const bootstrapLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/bootstrap-super-admin', bootstrapLimiter, bootstrapSuperAdmin);

module.exports = router;
