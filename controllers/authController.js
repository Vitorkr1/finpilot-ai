const User = require('../models/User');
const Category = require('../models/Category');
const LoginHistory = require('../models/LoginHistory');
const asyncHandler = require('../utils/asyncHandler');
const {
  signAccessToken, signRefreshToken, verifyRefreshToken, setAuthCookies, clearAuthCookies,
  signTwoFactorPendingToken, verifyTwoFactorPendingToken
} = require('../utils/tokens');
const { defaultCategories } = require('../utils/defaultCategories');
const { describeUserAgent } = require('../utils/userAgent');
const twoFactorService = require('../services/twoFactorService');

// GET /register
exports.showRegister = (req, res) => res.render('auth/register', { title: 'Criar conta' });

// GET /login
exports.showLogin = (req, res) => res.render('auth/login', { title: 'Entrar' });

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;

  if (!name || !email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Preencha todos os campos.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'As senhas não coincidem.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'A senha deve ter pelo menos 8 caracteres.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Já existe uma conta com este e-mail.' });
  }

  // Sem verificação por e-mail: a conta já nasce ativa e verificada
  const user = new User({ name, email, password, isVerified: true });
  await user.save();

  // Cria categorias padrão para o novo usuário
  await Category.insertMany(defaultCategories.map((c) => ({ ...c, user: user._id })));

  return res.status(201).json({
    success: true,
    message: 'Conta criada com sucesso! Faça login para continuar.'
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Informe e-mail e senha.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: 'E-mail ou senha incorretos.' });
  }

  if (!user.active) {
    return res.status(403).json({ success: false, message: 'Conta desativada. Entre em contato com o suporte.' });
  }

  // Se o 2FA está ativado, não loga direto — devolve um token temporário
  // (só serve pra completar o segundo fator, expira em 5 min) e pede o
  // código do app autenticador antes de emitir os tokens de sessão de verdade.
  if (user.twoFactorEnabled) {
    const pendingToken = signTwoFactorPendingToken(user._id);
    return res.json({ success: true, requiresTwoFactor: true, pendingToken });
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);

  LoginHistory.recordAndTrim({
    user: user._id,
    method: 'senha',
    ip: req.ip,
    device: describeUserAgent(req.get('user-agent'))
  }).catch((err) => console.error('[authController] Falha ao registrar histórico de login:', err.message));

  return res.json({ success: true, message: 'Login realizado com sucesso!', redirect: '/dashboard' });
});

// POST /api/auth/2fa/verify
// Segunda etapa do login quando o usuário tem 2FA ativado. Recebe o token
// temporário (emitido no /login) + o código do app autenticador (ou um
// código de backup) e, se bater, aí sim emite os tokens de sessão de verdade.
exports.verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  const { pendingToken, code } = req.body;
  if (!pendingToken || !code) {
    return res.status(400).json({ success: false, message: 'Informe o código do aplicativo autenticador.' });
  }

  let decoded;
  try {
    decoded = verifyTwoFactorPendingToken(pendingToken);
  } catch {
    return res.status(401).json({ success: false, message: 'Sessão de login expirada. Faça login novamente.' });
  }

  const user = await User.findById(decoded.id).select('+twoFactorSecret +twoFactorBackupCodes');
  if (!user || !user.twoFactorEnabled) {
    return res.status(401).json({ success: false, message: 'Sessão inválida. Faça login novamente.' });
  }

  let valid = twoFactorService.verifyToken(code, user.twoFactorSecret);
  let usedBackupCode = false;

  if (!valid) {
    const backupIndex = await twoFactorService.verifyBackupCode(code, user.twoFactorBackupCodes || []);
    if (backupIndex !== -1) {
      valid = true;
      usedBackupCode = true;
      user.twoFactorBackupCodes.splice(backupIndex, 1); // código de backup é de uso único
    }
  }

  if (!valid) {
    return res.status(401).json({ success: false, message: 'Código incorreto. Confira o app autenticador e tente de novo.' });
  }

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);

  LoginHistory.recordAndTrim({
    user: user._id,
    method: 'senha',
    ip: req.ip,
    device: describeUserAgent(req.get('user-agent')) + (usedBackupCode ? ' (código de backup)' : ' + 2FA')
  }).catch((err) => console.error('[authController] Falha ao registrar histórico de login:', err.message));

  res.json({
    success: true,
    message: usedBackupCode ? 'Login feito com código de backup. Considere gerar novos códigos no perfil.' : 'Login realizado com sucesso!',
    redirect: '/dashboard'
  });
});

// POST /api/auth/refresh
exports.refresh = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ success: false, message: 'Refresh token ausente.' });

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return res.status(401).json({ success: false, message: 'Refresh token inválido.' });
  }

  const user = await User.findById(decoded.id).select('+refreshTokens');
  if (!user || !user.refreshTokens.includes(token)) {
    return res.status(401).json({ success: false, message: 'Refresh token não reconhecido.' });
  }

  const newAccessToken = signAccessToken(user._id);
  const newRefreshToken = signRefreshToken(user._id);

  user.refreshTokens = user.refreshTokens.filter((t) => t !== token).concat(newRefreshToken).slice(-5);
  await user.save();

  setAuthCookies(res, newAccessToken, newRefreshToken);
  return res.json({ success: true });
});

// POST /api/auth/logout
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken;
  if (token && req.user) {
    req.user.refreshTokens = (req.user.refreshTokens || []).filter((t) => t !== token);
    await req.user.save();
  }
  clearAuthCookies(res);
  return res.json({ success: true, redirect: '/login' });
});
