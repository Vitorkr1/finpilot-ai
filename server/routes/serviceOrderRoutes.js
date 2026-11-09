const express = require('express');
const { requireAuth, requireTenant, requirePlan, requireRole } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const upload = require('../middleware/upload');
const {
  list,
  getOne,
  create,
  update,
  remove,
  checkDeletion,
  checklistTemplate,
  addMaterial,
  addPhoto,
  setSignature,
} = require('../controllers/serviceOrderController');

const router = express.Router();
router.param('id', require('../utils/validation').validateId);
router.param('clientId', require('../utils/validation').validateId);

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.get('/checklist-template/:segment', requirePlan('pro'), checklistTemplate);
router.get('/:id', getOne);
router.get('/:id/deletion-check', requireRole('admin', 'financeiro'), checkDeletion);
router.post('/', requireRole('admin', 'financeiro'), create);
router.patch('/:id', update);
router.delete('/:id', requireRole('admin', 'financeiro'), remove);
router.post('/:id/materials', requirePlan('pro'), addMaterial);
router.post('/:id/photos', upload.single('photo'), addPhoto);
router.post('/:id/signature', upload.single('signature'), setSignature);

module.exports = router;
