const express = require('express');
const { requireAuth, requireTenant, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const upload = require('../middleware/upload');
const {
  list,
  getOne,
  create,
  update,
  remove,
  checklistTemplate,
  addMaterial,
  addPhoto,
  setSignature,
} = require('../controllers/serviceOrderController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.get('/checklist-template/:segment', requirePlan('pro'), checklistTemplate);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/materials', requirePlan('pro'), addMaterial);
router.post('/:id/photos', upload.single('photo'), addPhoto);
router.post('/:id/signature', upload.single('signature'), setSignature);

module.exports = router;
