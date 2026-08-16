const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middlewares/auth');
const { receiptUpload } = require('../middlewares/upload');
const { aiLimiter } = require('../middlewares/rateLimiter');

router.get('/transactions', protect, transactionController.showTransactions);

router.get('/api/transactions', protect, transactionController.listTransactions);
router.post('/api/transactions', protect, transactionController.createTransaction);
router.post(
  '/api/transactions/scan-receipt',
  protect,
  aiLimiter,
  receiptUpload.single('receipt'),
  transactionController.scanReceipt
);
router.get('/api/transactions/subscriptions', protect, transactionController.listSubscriptions);
router.get('/api/transactions/suggest-category', protect, transactionController.suggestCategory);
router.put('/api/transactions/:id', protect, transactionController.updateTransaction);
router.delete('/api/transactions/:id', protect, transactionController.deleteTransaction);

module.exports = router;
