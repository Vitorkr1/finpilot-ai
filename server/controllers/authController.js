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

// Cookies separados para o login do tenant e o login do super admin (Seção 6:
// "completamente separado do login dos tenants") — evita que logar num painel
// derrube ou vaze a sessão do outro no mesmo navegador.
const TENANT_REFRESH_COOKIE = 'refreshToken';
const ADMIN_REFRESH_COOKIE = 'adminRefreshToken';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

function issueSession(user, res, cookieName) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  res.cookie(cookieName, refreshToken, COOKIE_OPTIONS);
  return accessToken;
}

async function authenticate(email, password) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.active) return null;
  const valid = await user.comparePassword(password);
  return valid ? user : null;
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await authenticate(email, password);
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }
  if (user.role === 'super_admin') {
    return res.status(403).json({ error: 'Super admins usam o painel administrativo, não este login.' });
  }

  const company = await Company.findById(user.companyId);
  if (!company || company.subscriptionStatus === 'suspended') {
    return res.status(403).json({ error: 'Assinatura suspensa. Contate o suporte da CriaTech.' });
  }

  const accessToken = issueSession(user, res, TENANT_REFRESH_COOKIE);
  await logAction({ companyId: user.companyId, userId: user._id, action: 'login', entity: 'User', entityId: user._id });

  res.json({ accessToken, user: user.toJSON(), company: company.toJSON() });
});

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await authenticate(email, password);
  if (!user || user.role !== 'super_admin') {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const accessToken = issueSession(user, res, ADMIN_REFRESH_COOKIE);
  await logAction({ userId: user._id, action: 'login', entity: 'User', entityId: user._id });

  res.json({ accessToken, user: user.toJSON() });
});

async function doRefresh(req, res, cookieName) {
  const token = req.cookies ? req.cookies[cookieName] : null;
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

  const accessToken = issueSession(user, res, cookieName);
  res.json({ accessToken });
}

const refresh = asyncHandler((req, res) => doRefresh(req, res, TENANT_REFRESH_COOKIE));
const adminRefresh = asyncHandler((req, res) => doRefresh(req, res, ADMIN_REFRESH_COOKIE));

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(TENANT_REFRESH_COOKIE, { path: '/api/auth' });
  res.clearCookie(ADMIN_REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});

const me = asyncHandler(async (req, res) => {
  let company = null;
  if (req.user.companyId) {
    company = await Company.findById(req.user.companyId);
  }
  res.json({ user: req.user.toJSON(), company: company ? company.toJSON() : null });
});

module.exports = { login, adminLogin, refresh, adminRefresh, logout, me };
