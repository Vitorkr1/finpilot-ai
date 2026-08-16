const jwt = require('jsonwebtoken');
const config = require('../config/config');

function signAccessToken(userId) {
  return jwt.sign({ id: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

// Token de curtíssima duração usado só entre "senha confirmada" e "código do
// app autenticador confirmado" — nunca dá acesso a nada sozinho, só permite
// completar o segundo fator em até 5 minutos.
function signTwoFactorPendingToken(userId) {
  return jwt.sign({ id: userId, purpose: '2fa_pending' }, config.jwt.secret, { expiresIn: '5m' });
}

function verifyTwoFactorPendingToken(token) {
  const decoded = jwt.verify(token, config.jwt.secret);
  if (decoded.purpose !== '2fa_pending') throw new Error('Token inválido para esta operação.');
  return decoded;
}

function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, config.jwt.refreshSecret);
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = config.env === 'production';

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/api/auth/refresh',
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
}

module.exports = {
  signAccessToken, signRefreshToken, verifyRefreshToken, setAuthCookies, clearAuthCookies,
  signTwoFactorPendingToken, verifyTwoFactorPendingToken
};
