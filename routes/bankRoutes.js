const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { protect } = require('../middlewares/auth');
const { ofxUpload, csvUpload } = require('../middlewares/upload');
const { fileImportLimiter } = require('../middlewares/rateLimiter');

router.get('/banks', protect, bankController.showBanks);

router.get('/api/banks', protect, bankController.listBanks);
router.post('/api/banks', protect, bankController.createBank);
router.put('/api/banks/:id', protect, bankController.updateBank);
router.get('/api/banks/:id/invoice', protect, bankController.getInvoice);
router.post('/api/banks/:id/import-ofx', protect, fileImportLimiter, ofxUpload.single('ofxFile'), bankController.importOfx);
router.post('/api/banks/:id/import-csv/preview', protect, fileImportLimiter, csvUpload.single('csvFile'), bankController.previewCsv);
router.post('/api/banks/:id/import-csv/commit', protect, fileImportLimiter, csvUpload.single('csvFile'), bankController.commitCsv);
router.delete('/api/banks/:id', protect, bankController.deleteBank);

module.exports = router;
