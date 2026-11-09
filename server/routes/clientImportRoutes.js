const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const ctrl = require('../controllers/clientImportController');
const router = express.Router();
router.use(requireAuth, requireTenant, loadCompany, requireRole('admin', 'financeiro'));
router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, keyGenerator: req => String(req.user._id), standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitas importações. Aguarde alguns minutos e tente novamente.' } }));
router.use(express.json({ limit: '5mb', inflate: false }));
router.post('/preview', ctrl.preview);
router.post('/', ctrl.save);
module.exports = router;
