const { z } = require('zod');
const User = require('../models/User');
const Company = require('../models/Company');
const { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken } = require('../utils/tokens');
const AuthSession = require('../models/AuthSession');
const validation = require('../utils/validation');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');
const transaction = require('../utils/transaction');

const loginSchema = z.object({
  email: validation.email,
  password: z.string().min(1).max(256),
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

async function issueSession(user, res, cookieName) {
  const issued = await transaction(async (tx) => {
    // A mesma trava de empresa da redefinição impede um login já em andamento
    // de criar uma sessão com a senha antiga depois da troca.
    if (user.companyId) {
      const company = await Company.findOneAndUpdate({ _id: user.companyId, subscriptionStatus: { $ne: 'suspended' } }, { $inc: { userRevision: 1 } }, { session: tx });
      if (!company) throw validation.httpError(403, 'Assinatura suspensa. Contate o suporte.');
    }
    const current = await User.findOne({ _id: user._id, active: true, passwordHash: user.passwordHash }).session(tx);
    if (!current) throw validation.httpError(401, 'Seu acesso mudou. Entre novamente com a senha atual.');
    const session = new AuthSession({ userId: user._id, scope: cookieName === ADMIN_REFRESH_COOKIE ? 'admin' : 'tenant', expiresAt: new Date(Date.now() + COOKIE_OPTIONS.maxAge) });
    const accessToken = signAccessToken(current, session._id);
    const refreshToken = signRefreshToken(current, session._id);
    session.refreshHash = hashToken(refreshToken);
    await session.save({ session: tx });
    return { accessToken, refreshToken };
  });
  res.cookie(cookieName, issued.refreshToken, COOKIE_OPTIONS);
  return issued.accessToken;
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

  const accessToken = await issueSession(user, res, TENANT_REFRESH_COOKIE);
  await logAction({ companyId: user.companyId, userId: user._id, action: 'login', entity: 'User', entityId: user._id });

  res.json({ accessToken, user: user.toJSON(), company: company.toJSON() });
});

const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await authenticate(email, password);
  if (!user || user.role !== 'super_admin') {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const accessToken = await issueSession(user, res, ADMIN_REFRESH_COOKIE);
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
  const scope = cookieName === ADMIN_REFRESH_COOKIE ? 'admin' : 'tenant';
  const session = await AuthSession.findOne({ _id: payload.sid, userId: user._id, scope, refreshHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session || (scope === 'admin') !== (user.role === 'super_admin')) return res.status(401).json({ error: 'Sessão encerrada.' });
  const company = scope === 'tenant' ? await Company.findById(user.companyId) : null;
  if (scope === 'tenant' && (!company || company.subscriptionStatus === 'suspended')) return res.status(403).json({ error: 'Assinatura suspensa. Contate o suporte.' });
  const accessToken = signAccessToken(user, session._id);
  res.json({ accessToken, user: user.toJSON(), company: company ? company.toJSON() : null });
}

const refresh = asyncHandler((req, res) => doRefresh(req, res, TENANT_REFRESH_COOKIE));
const adminRefresh = asyncHandler((req, res) => doRefresh(req, res, ADMIN_REFRESH_COOKIE));

const logout = asyncHandler(async (req, res) => {
  const cookieName = req.path === '/admin-logout' ? ADMIN_REFRESH_COOKIE : TENANT_REFRESH_COOKIE;
  const scope = cookieName === ADMIN_REFRESH_COOKIE ? 'admin' : 'tenant';
  const authorization = req.headers.authorization || '';
  if (authorization.startsWith('Bearer ')) {
    let payload;
    try { payload = verifyAccessToken(authorization.slice(7)); } catch { }
    if (payload) await AuthSession.deleteOne({ _id: payload.sid, userId: payload.sub, scope });
  }
  const token = req.cookies?.[cookieName];
  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await AuthSession.deleteOne({ _id: payload.sid, userId: payload.sub, scope: cookieName === ADMIN_REFRESH_COOKIE ? 'admin' : 'tenant', refreshHash: hashToken(token) });
    } catch (error) { if (error.name !== 'TokenExpiredError' && error.name !== 'JsonWebTokenError' && error.message !== 'Sessão inválida') throw error; }
  }
  res.clearCookie(cookieName, { ...COOKIE_OPTIONS, maxAge: undefined });
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
