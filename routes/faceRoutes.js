const express = require('express');
const router = express.Router();
const faceController = require('../controllers/faceController');
const { authLimiter } = require('../middlewares/rateLimiter');

// Página de cadastro facial — acesso só com o token do link (uso único).
router.get('/faces/register/:token', faceController.showRegisterPage);
router.post('/api/faces/register', authLimiter, faceController.registerFace);

module.exports = router;
