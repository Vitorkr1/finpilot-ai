const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const faceController = require('../controllers/faceController');
const { protect, redirectIfAuth } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

// Páginas
router.get('/login', redirectIfAuth, authController.showLogin);

// Autorregistro DESATIVADO — apenas o administrador cria contas
// (via `npm run create-user`, script em scripts/createUser.js).
// As rotas de registro foram removidas de propósito: mesmo que alguém
// digite /register ou chame /api/auth/register diretamente pela URL,
// agora cai em 404 — não basta esconder o link na tela de login.
// router.get('/register', redirectIfAuth, authController.showRegister);

// API
// router.post('/api/auth/register', authLimiter, authController.register);
router.post('/api/auth/login', authLimiter, authController.login);
router.post('/api/auth/2fa/verify', authLimiter, authController.verifyTwoFactorLogin);
router.post('/api/auth/face-login', authLimiter, faceController.faceLogin);
router.post('/api/auth/refresh', authController.refresh);
router.post('/api/auth/logout', protect, authController.logout);

module.exports = router;
