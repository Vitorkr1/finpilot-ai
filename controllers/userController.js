const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Bank = require('../models/Bank');
const Category = require('../models/Category');
const Goal = require('../models/Goal');
const asyncHandler = require('../utils/asyncHandler');
const { transactionsToCSV, transactionsToPDF } = require('../services/exportService');
const LoginHistory = require('../models/LoginHistory');
const twoFactorService = require('../services/twoFactorService');
const { checkBillsForUser } = require('../services/notificationService');

// GET /profile
exports.showProfile = asyncHandler(async (req, res) => {
  res.render('profile/index', { title: 'Meu Perfil' });
});

// GET /api/users/me/login-history
exports.getLoginHistory = asyncHandler(async (req, res) => {
  const history = await LoginHistory.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(20);
  res.json({ success: true, history });
});

// POST /api/users/me/2fa/setup
// Gera um segredo novo (ainda não ativa o 2FA — só confirma no /enable,
// depois que a pessoa provar que configurou certo no app dela).
exports.setupTwoFactor = asyncHandler(async (req, res) => {
  const secret = twoFactorService.generateSecret();
  req.user.twoFactorSecret = secret;
  await req.user.save();

  const qrCode = await twoFactorService.generateQrCodeDataUrl(req.user.email, secret);
  res.json({ success: true, qrCode, secret });
});

// POST /api/users/me/2fa/enable
// Body: { token } — confirma que a pessoa configurou certo o app
// autenticador antes de ativar de vez o 2FA na conta.
exports.enableTwoFactor = asyncHandler(async (req, res) => {
  const { token } = req.body;
  const user = await User.findById(req.user._id).select('+twoFactorSecret');

  if (!user.twoFactorSecret) {
    return res.status(400).json({ success: false, message: 'Gere o QR Code primeiro.' });
  }
  if (!twoFactorService.verifyToken(token, user.twoFactorSecret)) {
    return res.status(400).json({ success: false, message: 'Código incorreto. Confira o app autenticador.' });
  }

  const { plainCodes, hashedCodes } = await twoFactorService.generateBackupCodes();
  user.twoFactorEnabled = true;
  user.twoFactorBackupCodes = hashedCodes;
  await user.save();

  res.json({
    success: true,
    message: 'Autenticação em dois fatores ativada!',
    backupCodes: plainCodes // mostrado só essa vez — depois não tem como recuperar
  });
});

// POST /api/users/me/2fa/disable
// Body: { password } — exige a senha de novo por segurança (é uma ação
// que reduz a proteção da conta).
exports.disableTwoFactor = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!password || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'Senha incorreta.' });
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = null;
  user.twoFactorBackupCodes = [];
  await user.save();

  res.json({ success: true, message: 'Autenticação em dois fatores desativada.' });
});

// PUT /api/users/me
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, theme, emailAlertsEnabled, emailOnEveryTransaction } = req.body;
  if (name) req.user.name = name;
  if (theme && ['light', 'dark', 'auto'].includes(theme)) req.user.theme = theme;
  if (emailAlertsEnabled !== undefined) req.user.emailAlertsEnabled = !!emailAlertsEnabled;
  if (emailOnEveryTransaction !== undefined) req.user.emailOnEveryTransaction = !!emailOnEveryTransaction;
  await req.user.save();
  res.json({ success: true, message: 'Perfil atualizado com sucesso.', user: req.user });
});

// POST /api/users/me/avatar
exports.updateAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
  req.user.avatar = `/uploads/avatars/${req.file.filename}`;
  await req.user.save();
  res.json({ success: true, avatar: req.user.avatar });
});

// PUT /api/users/me/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(400).json({ success: false, message: 'Senha atual incorreta.' });
  }
  if (!newPassword || newPassword !== confirmNewPassword) {
    return res.status(400).json({ success: false, message: 'As novas senhas não coincidem.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'A nova senha deve ter pelo menos 8 caracteres.' });
  }

  user.password = newPassword;
  user.refreshTokens = [];
  await user.save();

  res.json({ success: true, message: 'Senha alterada com sucesso. Faça login novamente.' });
});

// DELETE /api/users/me
exports.deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  await Promise.all([
    Transaction.deleteMany({ user: userId }),
    Bank.deleteMany({ user: userId }),
    Category.deleteMany({ user: userId }),
    Goal.deleteMany({ user: userId }),
    User.findByIdAndDelete(userId)
  ]);
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ success: true, message: 'Conta excluída permanentemente.', redirect: '/login' });
});

// POST /api/users/me/notifications/test-bills
// Dispara na hora (sem esperar o job diário) o e-mail de boletos vencendo,
// pra a pessoa testar se a configuração de e-mail está funcionando.
exports.testBillsEmail = asyncHandler(async (req, res) => {
  const result = await checkBillsForUser(req.user._id);

  if (result.count === 0) {
    return res.json({ success: true, message: 'Nenhum boleto vencido ou vencendo nos próximos 3 dias — nada para enviar.' });
  }
  if (!result.sent) {
    return res.json({
      success: true,
      message: result.reason === 'not_configured'
        ? 'RESEND_API_KEY não configurada no servidor. Defina no .env para habilitar o envio de e-mails.'
        : 'Não foi possível enviar o e-mail. Verifique os logs do servidor.'
    });
  }

  res.json({ success: true, message: `E-mail enviado com ${result.count} boleto(s)!` });
});

// GET /api/users/me/export/csv
exports.exportCSV = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ user: req.user._id })
    .populate('category', 'name')
    .populate('bank', 'name')
    .sort({ date: -1 });

  const csv = transactionsToCSV(transactions);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="finpilot-transacoes.csv"');
  res.send(csv);
});

// GET /api/users/me/export/pdf
exports.exportPDF = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ user: req.user._id })
    .populate('category', 'name')
    .populate('bank', 'name')
    .sort({ date: -1 });

  transactionsToPDF(transactions, req.user, res);
});

// GET /api/users/me/backup
exports.backupData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [banks, transactions, categories, goals] = await Promise.all([
    Bank.find({ user: userId }),
    Transaction.find({ user: userId }),
    Category.find({ user: userId }),
    Goal.find({ user: userId })
  ]);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="finpilot-backup.json"');
  res.json({ exportedAt: new Date(), banks, transactions, categories, goals });
});
