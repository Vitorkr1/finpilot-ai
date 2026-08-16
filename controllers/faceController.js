const crypto = require('crypto');
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const asyncHandler = require('../utils/asyncHandler');
const { findBestMatch } = require('../utils/faceMatch');
const { signAccessToken, signRefreshToken, setAuthCookies } = require('../utils/tokens');
const { describeUserAgent } = require('../utils/userAgent');

// GET /faces/register/:token
// Página de cadastro facial. Só é exibida se o token existir, não tiver
// expirado e ainda não tiver sido usado. Não exige estar logado — o token
// já é a prova de que a pessoa tem permissão (foi o admin quem o enviou).
exports.showRegisterPage = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    faceRegistrationToken: token,
    faceRegistrationTokenExpires: { $gt: new Date() }
  }).select('+faceRegistrationToken +faceRegistrationTokenExpires name email faceEnabled');

  if (!user) {
    return res.status(410).render('auth/face-invalid', { title: 'Link inválido' });
  }

  res.render('auth/face-register', { title: 'Cadastrar reconhecimento facial', userName: user.name, token });
});

// POST /api/faces/register
// Body: { token, descriptor: number[128] }
exports.registerFace = asyncHandler(async (req, res) => {
  const { token, descriptor } = req.body;

  if (!token || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ success: false, message: 'Dados de rosto inválidos. Tente novamente.' });
  }

  const user = await User.findOne({
    faceRegistrationToken: token,
    faceRegistrationTokenExpires: { $gt: new Date() }
  }).select('+faceRegistrationToken +faceRegistrationTokenExpires');

  if (!user) {
    return res.status(410).json({ success: false, message: 'Este link expirou ou já foi usado. Peça um novo link.' });
  }

  user.faceDescriptor = descriptor;
  user.faceEnabled = true;
  user.faceRegisteredAt = new Date();
  // Consome o token: link de uso único
  user.faceRegistrationToken = undefined;
  user.faceRegistrationTokenExpires = undefined;
  await user.save();

  return res.json({ success: true, message: 'Rosto cadastrado com sucesso! Agora você já pode entrar pela câmera.' });
});

// POST /api/auth/face-login
// Body: { descriptor: number[128] }
// Compara com todos os usuários ativos que têm faceEnabled=true e loga
// automaticamente quem bater dentro do limite de similaridade.
exports.faceLogin = asyncHandler(async (req, res) => {
  const { descriptor } = req.body;

  if (!Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ success: false, message: 'Não foi possível ler o rosto. Tente novamente com boa iluminação.' });
  }

  const candidates = await User.find({ faceEnabled: true, active: true }).select('+faceDescriptor');

  const match = findBestMatch(descriptor, candidates);

  if (!match) {
    return res.status(401).json({ success: false, message: 'Rosto não reconhecido. Use e-mail e senha, ou cadastre seu rosto.' });
  }

  const user = match.user;

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  user.refreshTokens = [...(user.refreshTokens || []).slice(-4), refreshToken];
  await user.save();

  setAuthCookies(res, accessToken, refreshToken);

  LoginHistory.recordAndTrim({
    user: user._id,
    method: 'facial',
    ip: req.ip,
    device: describeUserAgent(req.get('user-agent'))
  }).catch((err) => console.error('[faceController] Falha ao registrar histórico de login:', err.message));

  return res.json({ success: true, message: `Bem-vindo(a), ${user.name.split(' ')[0]}!`, redirect: '/dashboard' });
});

// Gera um token de convite para um usuário existente cadastrar o rosto.
// Usado pelo script scripts/generateFaceInviteLink.js (apenas admin, via
// terminal — não existe rota HTTP pra isso, de propósito).
async function createInviteToken(userId, expiresInMs = 60 * 60 * 1000) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + expiresInMs);

  await User.findByIdAndUpdate(userId, {
    faceRegistrationToken: token,
    faceRegistrationTokenExpires: expires
  });

  return { token, expires };
}

module.exports.createInviteToken = createInviteToken;
