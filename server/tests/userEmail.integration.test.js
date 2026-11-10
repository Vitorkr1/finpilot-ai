const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'email-test-access-secret-long-enough';
process.env.JWT_REFRESH_SECRET = 'email-test-refresh-secret-long-enough';
process.env.CLIENT_URL = 'http://localhost:5173';
const Company = require('../models/Company');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const RouteSession = require('../models/RouteSession');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');
const password = 'Email-test-password-42!';
let mongo, server, base, passwordHash, index = 0;
async function sessionFor(user) {
  const s = new AuthSession({ userId: user._id, scope: user.role === 'super_admin' ? 'admin' : 'tenant', expiresAt: new Date(Date.now() + 86400000) });
  const refresh = signRefreshToken(user, s._id); s.refreshHash = hashToken(refresh); await s.save();
  return { user, token: signAccessToken(user, s._id), refresh, sessionId: s._id };
}
async function person(company, role) {
  return sessionFor(await User.create({ companyId: company?._id || null, name: 'Teste ' + role, email: 'email-test-' + (++index) + '@example.com', passwordHash, role }));
}
async function fixture() {
  const company = await Company.create({ name: 'Empresa de e-mail ' + (++index), plan: 'pro' });
  return { company, owner: await person(company, 'admin'), target: await person(company, 'tecnico') };
}
async function call(method, path, actor, body, extra = {}) {
  const response = await fetch(base + '/api' + path, { method, headers: { ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
  return { status: response.status, data, headers: response.headers };
}
const payload = (target, email) => ({ email, expectedEmail: target.user.email, confirm: true, currentPassword: password });
const pathFor = target => '/company-users/' + target.user._id + '/email';
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
  const app = require('../app')(); await Promise.all(Object.values(mongoose.models).map(model => model.init()));
  passwordHash = await User.hashPassword(password);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('alterar e-mail mantém senha, revoga sessões/rota e permite login somente pelo endereço novo', async () => {
  const { company, owner, target } = await fixture(), second = await sessionFor(target.user);
  assert.equal((await call('POST', '/route-tracking/mine', target, { consent: true, deviceToken: 'e'.repeat(64) })).status, 201);
  const email = 'novo-acesso@example.com', result = await call('PATCH', pathFor(target), owner, payload(target, '  NOVO-ACESSO@EXAMPLE.COM  '));
  assert.equal(result.status, 200); assert.equal(result.data.user.email, email); assert.equal(result.data.selfChange, false); assert.equal(result.data.user.passwordHash, undefined); assert.equal(result.headers.get('cache-control'), 'no-store');
  const stored = await User.findById(target.user._id).select('+passwordHash'); assert.equal(stored.passwordHash, passwordHash); assert.equal(stored.role, 'tecnico'); assert.equal(String(stored.companyId), String(company._id));
  assert.equal(await AuthSession.countDocuments({ userId: target.user._id }), 0); assert.equal(await RouteSession.countDocuments({ technicianId: target.user._id }), 0);
  for (const actor of [target, second]) assert.equal((await call('GET', '/clients', actor)).status, 401);
  assert.equal((await call('POST', '/auth/refresh', null, undefined, { Cookie: 'refreshToken=' + target.refresh })).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email: target.user.email, password })).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email, password })).status, 200);
  assert.equal((await call('GET', '/company-users', owner)).status, 200);
  const audit = await mongoose.model('AuditLog').findOne({ entityId: target.user._id, action: 'change-email' }).lean(); assert.ok(audit); assert.ok(!JSON.stringify(audit).includes(password));
});
test('admin altera o próprio e-mail e precisa entrar novamente sem alterar a senha', async () => {
  const { owner } = await fixture(), second = await sessionFor(owner.user), email = 'admin-novo@example.com';
  const result = await call('PATCH', pathFor(owner), owner, payload(owner, email)); assert.equal(result.status, 200); assert.equal(result.data.selfChange, true);
  for (const actor of [owner, second]) assert.equal((await call('GET', '/company-users', actor)).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email: owner.user.email, password })).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email, password })).status, 200);
});
test('alteração de e-mail exige admin, senha atual, confirmação e empresa correta', async () => {
  const { company, owner, target } = await fixture(), foreign = await fixture(), finance = await person(company, 'financeiro'), superAdmin = await person(null, 'super_admin');
  const body = payload(target, 'permissoes@example.com'), path = pathFor(target);
  for (const actor of [null, target, finance, superAdmin]) assert.equal((await call('PATCH', path, actor, body)).status, actor ? 403 : 401);
  assert.equal((await call('PATCH', path, foreign.owner, body)).status, 404);
  for (const invalid of [{ ...body, email: 'inválido' }, { ...body, confirm: false }, { ...body, currentPassword: '' }, { ...body, currentPassword: { $ne: null } }, { ...body, role: 'admin' }, { email: body.email, currentPassword: password, confirm: true }]) assert.equal((await call('PATCH', path, owner, invalid)).status, 400);
  assert.equal((await call('PATCH', path, owner, { ...body, currentPassword: 'errada' })).status, 403);
  assert.equal((await User.findById(target.user._id)).email, target.user.email); assert.equal((await call('GET', '/clients', target)).status, 200);
});
test('e-mail duplicado, endereço igual e formulário antigo não revogam o acesso', async () => {
  const { owner, target } = await fixture(), foreign = await fixture(), path = pathFor(target);
  for (const body of [payload(target, foreign.owner.user.email), payload(target, target.user.email), { ...payload(target, 'stale@example.com'), expectedEmail: 'antigo@example.com' }]) assert.equal((await call('PATCH', path, owner, body)).status, 409);
  assert.equal((await User.findById(target.user._id)).email, target.user.email); assert.equal((await call('GET', '/clients', target)).status, 200);
});
test('corrigir e-mail não reativa um usuário inativo', async () => {
  const { owner, target } = await fixture(), email = 'inativo-novo@example.com'; await User.updateOne({ _id: target.user._id }, { $set: { active: false } });
  const result = await call('PATCH', pathFor(target), owner, payload(target, email)); assert.equal(result.status, 200); assert.equal(result.data.user.active, false);
  assert.equal((await call('POST', '/auth/login', null, { email, password })).status, 401);
});
test('falha ao encerrar rota reverte e-mail e revogação das sessões', async () => {
  const { owner, target } = await fixture(), original = RouteSession.deleteMany;
  RouteSession.deleteMany = () => { throw new Error('injected-email-change-failure'); };
  try { const result = await call('PATCH', pathFor(target), owner, payload(target, 'reverter@example.com')); assert.equal(result.status, 500); assert.ok(!result.data.error.includes('injected')); }
  finally { RouteSession.deleteMany = original; }
  assert.equal((await User.findById(target.user._id)).email, target.user.email); assert.equal((await call('GET', '/clients', target)).status, 200);
});
test('login iniciado com e-mail antigo não cria sessão depois da alteração', { timeout: 30000 }, async () => {
  const { owner, target } = await fixture(), email = 'concorrente-novo@example.com', original = User.prototype.comparePassword;
  let signal, release; const verified = new Promise(resolve => { signal = resolve; }), resume = new Promise(resolve => { release = resolve; });
  User.prototype.comparePassword = async function (value) { const valid = await original.call(this, value); if (this.email === target.user.email) { signal(); await resume; } return valid; };
  const login = call('POST', '/auth/login', null, { email: target.user.email, password });
  try {
    await verified; assert.equal((await call('PATCH', pathFor(target), owner, payload(target, email))).status, 200);
    release(); assert.equal((await login).status, 401); assert.equal(await AuthSession.countDocuments({ userId: target.user._id }), 0);
    assert.equal((await call('POST', '/auth/login', null, { email, password })).status, 200);
  } finally { release(); User.prototype.comparePassword = original; await login; }
});
test('usuários novos de todos os perfis entram com a senha gerada usando requisições de navegador e Android', async () => {
  const { owner } = await fixture();
  for (const role of ['tecnico', 'financeiro', 'admin']) {
    const created = await call('POST', '/company-users', owner, { name: 'Novo ' + role, email: ' CADASTRO-' + role.toUpperCase() + '@EXAMPLE.COM ', role });
    assert.equal(created.status, 201); assert.match(created.data.tempPassword, /^[A-Za-z0-9_-]{12}$/);
    for (const headers of [{ Origin: 'http://localhost:5173' }, { 'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14)', Accept: 'application/json' }]) {
      const login = await call('POST', '/auth/login', null, { email: created.data.user.email, password: created.data.tempPassword }, headers); assert.equal(login.status, 200); assert.equal(login.data.user.role, role); assert.ok(login.data.accessToken);
    }
  }
});
test('sessão de admin revogada durante a confirmação impede alterar o e-mail', async () => {
  const { owner, target } = await fixture(), original = User.prototype.comparePassword;
  User.prototype.comparePassword = async function (value) { const valid = await original.call(this, value); if (this.email === owner.user.email) await AuthSession.deleteOne({ _id: owner.sessionId }); return valid; };
  try { assert.equal((await call('PATCH', pathFor(target), owner, payload(target, 'sem-sessao@example.com'))).status, 401); }
  finally { User.prototype.comparePassword = original; }
  assert.equal((await User.findById(target.user._id)).email, target.user.email);
});
test('tentativas de alterar e-mail têm limite por administrador', async () => {
  const { owner, target } = await fixture(), body = { ...payload(target, 'limite@example.com'), confirm: false };
  for (let i = 0; i < 10; i++) assert.equal((await call('PATCH', pathFor(target), owner, body)).status, 400);
  const result = await call('PATCH', pathFor(target), owner, payload(target, 'limite@example.com')); assert.equal(result.status, 429); assert.ok(result.data.error.includes('15 minutos'));
  assert.equal((await User.findById(target.user._id)).email, target.user.email);
});
