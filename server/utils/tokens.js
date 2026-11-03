const jwt = require('jsonwebtoken');
const { createHash, randomUUID } = require('node:crypto');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

function signAccessToken(user, sessionId) {
  return jwt.sign(
    { sub: user._id.toString(), sid: String(sessionId), kind: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256', issuer: 'criaos', audience: 'criaos-api' }
  );
}

function signRefreshToken(user, sessionId) {
  return jwt.sign({ sub: user._id.toString(), sid: String(sessionId), kind: 'refresh' }, process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL, jwtid: randomUUID(), algorithm: 'HS256', issuer: 'criaos', audience: 'criaos-refresh' });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'criaos', audience: 'criaos-api' });
  if (payload.kind !== 'access' || !/^[a-f\d]{24}$/i.test(payload.sub) || !/^[a-f\d]{24}$/i.test(payload.sid)) throw new Error('Token inválido');
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ['HS256'], issuer: 'criaos', audience: 'criaos-refresh' });
  if (payload.kind !== 'refresh' || !/^[a-f\d]{24}$/i.test(payload.sub) || !/^[a-f\d]{24}$/i.test(payload.sid)) throw new Error('Sessão inválida');
  return payload;
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, hashToken };
