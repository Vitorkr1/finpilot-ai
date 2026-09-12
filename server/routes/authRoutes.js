const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, adminLogin, refresh, adminRefresh, logout, me } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

router.post('/login', loginLimiter, login);
router.post('/admin-login', loginLimiter, adminLogin);
router.post('/refresh', refresh);
router.post('/admin-refresh', adminRefresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
