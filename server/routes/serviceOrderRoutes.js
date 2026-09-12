const express = require('express');
const { requireAuth, requireTenant, requirePlan } = require('../middleware/auth');
const loadCompany = require('../middleware/loadCompany');
const { list, getOne, create, update, remove, checklistTemplate } = require('../controllers/serviceOrderController');

const router = express.Router();

router.use(requireAuth, requireTenant, loadCompany);
router.get('/', list);
router.get('/checklist-template/:segment', requirePlan('pro'), checklistTemplate);
router.get('/:id', getOne);
router.post('/', create);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
