const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, listTechnicians, create, setActive, resetPassword, changeEmail, remove } = require('../controllers/userController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', requireRole('admin'), list);
router.get('/technicians', requireRole('admin', 'financeiro'), listTechnicians);
router.post('/', requireRole('admin'), create);
router.patch('/:id/active', requireRole('admin'), setActive);
const passwordResetLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitas tentativas de redefinição. Aguarde 15 minutos e tente novamente.' },
});
router.post('/:id/reset-password', requireRole('admin'), passwordResetLimit, resetPassword);
const emailChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitas tentativas de alterar e-mail. Aguarde 15 minutos e tente novamente.' },
});
router.patch('/:id/email', requireRole('admin'), emailChangeLimit, changeEmail);
const memberDeleteLimit = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10,
  keyGenerator: (req) => String(req.user._id),
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: 'Muitas tentativas de excluir membros. Aguarde 15 minutos e tente novamente.' },
});
router.delete('/:id', requireRole('admin'), memberDeleteLimit, remove);

module.exports = router;
