const router = require('express').Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);
const rateLimit = require('express-rate-limit');
const { requireAuth, requireTenant, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const requireRouteDevice = require('../middleware/routeDevice');
const ctrl = require('../controllers/routeTrackingController');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const deviceLimit = rateLimit({ windowMs: 60000, limit: 20, keyGenerator: (req) => String(req.routeSession._id), standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Muitas atualizações. Aguarde alguns segundos.' }),
});
router.put('/device/position', requireRouteDevice, deviceLimit, ctrl.updatePosition);
router.get('/device', requireRouteDevice, deviceLimit, ctrl.deviceStatus);
router.delete('/device', requireRouteDevice, ctrl.stopDevice);
router.use(requireAuth, requireTenant, loadCompany);
router.get('/', requireRole('admin', 'financeiro'), ctrl.list);
router.get('/mine', requireRole('tecnico'), ctrl.mine);
router.post('/mine', requireRole('tecnico'), rateLimit({ windowMs: 60000, limit: 6, keyGenerator: (req) => String(req.user._id), legacyHeaders: false }), ctrl.start);
router.delete('/mine', requireRole('tecnico'), ctrl.stopMine);

module.exports = router;
