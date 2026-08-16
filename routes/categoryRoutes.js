const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { protect } = require('../middlewares/auth');

router.get('/categories', protect, categoryController.showCategories);

router.get('/api/categories', protect, categoryController.listCategories);
router.post('/api/categories', protect, categoryController.createCategory);
router.put('/api/categories/:id', protect, categoryController.updateCategory);
router.delete('/api/categories/:id', protect, categoryController.deleteCategory);

module.exports = router;
