const { z } = require('zod');
const User = require('../models/User');
const Company = require('../models/Company');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

async function issueSession(user, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  let company = null;
  if (user.companyId) {
    company = await Company.findById(user.companyId);
    if (!company || company.subscriptionStatus === 'suspended') {
      return res.status(403).json({ error: 'Assinatura suspensa. Contate o suporte da CriaTech.' });
    }
  }

  const accessToken = await issueSession(user, res);
  await logAction({ companyId: user.companyId, userId: user._id, action: 'login', entity: 'User', entityId: user._id });

  res.json({ accessToken, user: user.toJSON(), company: company ? company.toJSON() : null });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies ? req.cookies[REFRESH_COOKIE] : null;
  if (!token) {
    return res.status(401).json({ error: 'Sem sessão ativa' });
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Sessão expirada' });
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Usuário inválido' });
  }

  const accessToken = await issueSession(user, res);
  res.json({ accessToken });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});

const me = asyncHandler(async (req, res) => {
  let company = null;
  if (req.user.companyId) {
    company = await Company.findById(req.user.companyId);
  }
  res.json({ user: req.user.toJSON(), company: company ? company.toJSON() : null });
});

module.exports = { login, refresh, logout, me };
