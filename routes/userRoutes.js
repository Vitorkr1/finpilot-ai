const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const { emailTestLimiter } = require('../middlewares/rateLimiter');

router.get('/profile', protect, userController.showProfile);

router.put('/api/users/me', protect, userController.updateProfile);
router.post('/api/users/me/avatar', protect, upload.single('avatar'), userController.updateAvatar);
router.put('/api/users/me/password', protect, userController.changePassword);
router.delete('/api/users/me', protect, userController.deleteAccount);

router.post('/api/users/me/notifications/test-bills', protect, emailTestLimiter, userController.testBillsEmail);
router.get('/api/users/me/login-history', protect, userController.getLoginHistory);
router.post('/api/users/me/2fa/setup', protect, userController.setupTwoFactor);
router.post('/api/users/me/2fa/enable', protect, userController.enableTwoFactor);
router.post('/api/users/me/2fa/disable', protect, userController.disableTwoFactor);

router.get('/api/users/me/export/csv', protect, userController.exportCSV);
router.get('/api/users/me/export/pdf', protect, userController.exportPDF);
router.get('/api/users/me/backup', protect, userController.backupData);

module.exports = router;
