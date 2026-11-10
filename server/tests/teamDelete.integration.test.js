const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'delete-team-access-secret-long-enough';
process.env.JWT_REFRESH_SECRET = 'delete-team-refresh-secret-long-enough';
const Company = require('../models/Company'), User = require('../models/User'), AuthSession = require('../models/AuthSession'), RouteSession = require('../models/RouteSession');
const ServiceOrder = require('../models/ServiceOrder'), Appointment = require('../models/Appointment'), Client = require('../models/Client'), AuditLog = require('../models/AuditLog');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');
const password = 'Delete-team-test-42!';
let mongo, server, base, passwordHash, index = 0;
async function person(company, role = 'tecnico', active = true) {
  const user = await User.create({ companyId: company?._id || null, name: 'Membro de teste ' + (++index), email: 'delete-team-' + index + '@example.com', passwordHash, role, active });
  const session = new AuthSession({ userId: user._id, scope: role === 'super_admin' ? 'admin' : 'tenant', expiresAt: new Date(Date.now() + 86400000) });
  const refresh = signRefreshToken(user, session._id); session.refreshHash = hashToken(refresh); await session.save();
  return { user, token: signAccessToken(user, session._id), refresh, sessionId: session._id };
}
async function fixture() {
  const company = await Company.create({ name: 'Equipe de teste ' + (++index), plan: 'pro' });
  return { company, owner: await person(company, 'admin'), target: await person(company), client: await Client.create({ companyId: company._id, name: 'Cliente de teste' }) };
}
async function call(method, path, actor, body, extra = {}) {
  const response = await fetch(base + '/api' + path, { method, headers: { ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : null };
}
const pathFor = target => '/company-users/' + target.user._id;
const bodyFor = target => ({ confirm: true, expectedEmail: target.user.email, currentPassword: password });
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri());
  const app = require('../app')(); await Promise.all(Object.values(mongoose.models).map(model => model.init())); passwordHash = await User.hashPassword(password);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test('excluir membro apaga a conta de verdade, revoga acessos/rota e preserva OS, agenda e financeiro', async () => {
  const { company, owner, target, client } = await fixture();
  const order = await ServiceOrder.create({ companyId: company._id, clientId: client._id, technicianId: target.user._id, serviceDescription: 'Registro anterior', materialsUsed: [{ stockItemId: new mongoose.Types.ObjectId(), qty: 2 }] });
  const appointment = await Appointment.create({ companyId: company._id, technicianId: target.user._id, serviceOrderId: order._id, date: '2026-11-10', startTime: '08:00', endTime: '09:00' });
  const entry = await mongoose.model('FinancialEntry').create({ companyId: company._id, type: 'receita', description: 'Preservar', amount: 100, dueDate: '2026-11-10', relatedServiceOrderId: order._id });
  await AuditLog.create({ companyId: company._id, userId: target.user._id, action: 'update', entity: 'ServiceOrder', entityId: order._id });
  const device = 'd'.repeat(64); assert.equal((await call('POST', '/route-tracking/mine', target, { consent: true, deviceToken: device })).status, 201);
  assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 204);
  assert.equal(await User.findById(target.user._id), null); assert.equal(await AuthSession.countDocuments({ userId: target.user._id }), 0); assert.equal(await RouteSession.countDocuments({ technicianId: target.user._id }), 0);
  assert.equal((await call('GET', '/clients', target)).status, 401); assert.equal((await call('POST', '/auth/refresh', null, undefined, { Cookie: 'refreshToken=' + target.refresh })).status, 401);
  assert.equal((await call('POST', '/auth/login', null, { email: target.user.email, password })).status, 401);
  assert.equal((await call('GET', '/route-tracking/device', null, undefined, { Authorization: 'Route ' + device })).status, 410);
  const savedOrder = await ServiceOrder.findById(order._id); assert.equal(savedOrder.deletedTechnicianName, target.user.name); assert.equal(savedOrder.serviceDescription, 'Registro anterior'); assert.equal(savedOrder.materialsUsed.length, 1); assert.equal(String(savedOrder.technicianId), String(target.user._id));
  assert.equal((await Appointment.findById(appointment._id)).deletedTechnicianName, target.user.name); assert.ok(await mongoose.model('FinancialEntry').findById(entry._id)); assert.ok(await Client.findById(client._id));
  assert.equal((await AuditLog.findOne({ userId: target.user._id })).userName, target.user.name);
  const audit = await AuditLog.findOne({ action: 'delete-member', entityId: target.user._id }); assert.ok(audit); assert.equal(audit.details.preservedOrders, 1); assert.equal(audit.details.preservedAppointments, 1); assert.ok(!JSON.stringify(audit).includes(password));
  assert.ok(!(await call('GET', '/company-users', owner)).data.some(u => u._id === String(target.user._id)));
  assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 404);
  const recreated = await call('POST', '/company-users', owner, { name: 'Nova conta', email: target.user.email, role: 'tecnico' }); assert.equal(recreated.status, 201); assert.notEqual(recreated.data.user._id, String(target.user._id));
  const login = await call('POST', '/auth/login', null, { email: target.user.email, password: recreated.data.tempPassword }); assert.equal(login.status, 200);
  const newActor = { token: login.data.accessToken }; assert.deepEqual((await call('GET', '/service-orders', newActor)).data, []); assert.equal((await call('GET', '/service-orders/' + order._id, newActor)).status, 404); assert.deepEqual((await call('GET', '/appointments', newActor)).data, []);
});
test('admin pode apagar financeiro, outro admin e membro inativo', async () => {
  const { company, owner } = await fixture();
  for (const [role, active] of [['financeiro', true], ['admin', true], ['tecnico', false]]) {
    const target = await person(company, role, active); assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 204); assert.equal(await User.findById(target.user._id), null);
  }
  assert.ok(await User.findById(owner.user._id)); assert.equal((await call('GET', '/company-users', owner)).status, 200);
});
test('exclusão exige admin da empresa, confirmação e senha e bloqueia a própria conta inclusive ID em maiúsculas', async () => {
  const { company, owner, target } = await fixture(), finance = await person(company, 'financeiro'), foreign = await fixture(), superAdmin = await person(null, 'super_admin');
  for (const actor of [null, target, finance, superAdmin]) assert.equal((await call('DELETE', pathFor(target), actor, bodyFor(target))).status, actor ? 403 : 401);
  assert.equal((await call('DELETE', pathFor(target), foreign.owner, bodyFor(target))).status, 404);
  assert.equal((await call('DELETE', '/company-users/invalid', owner, bodyFor(target))).status, 400);
  const valid = bodyFor(target);
  for (const body of [{ ...valid, confirm: false }, { ...valid, currentPassword: { $ne: null } }, { confirm: true, currentPassword: password }, { ...valid, role: 'admin' }]) assert.equal((await call('DELETE', pathFor(target), owner, body)).status, 400);
  assert.equal((await call('DELETE', pathFor(target), owner, { ...valid, currentPassword: 'errada' })).status, 403);
  for (const id of [String(owner.user._id), String(owner.user._id).toUpperCase()]) assert.equal((await call('DELETE', '/company-users/' + id, owner, bodyFor(owner))).status, 409);
  assert.equal((await call('DELETE', pathFor(target), owner, { ...valid, expectedEmail: 'antigo@example.com' })).status, 409);
  assert.ok(await User.findById(target.user._id)); assert.equal((await call('GET', '/clients', target)).status, 200);
});
test('falha de auditoria reverte exclusão, sessões e nomes preservados em uma transação', async () => {
  const { company, owner, target, client } = await fixture();
  const order = await ServiceOrder.create({ companyId: company._id, clientId: client._id, technicianId: target.user._id }), original = AuditLog.create;
  AuditLog.create = function (...args) { if (Array.isArray(args[0]) && args[0][0]?.action === 'delete-member') throw new Error('injected-member-delete-failure'); return original.apply(this, args); };
  try { const result = await call('DELETE', pathFor(target), owner, bodyFor(target)); assert.equal(result.status, 500); assert.ok(!result.data.error.includes('injected')); }
  finally { AuditLog.create = original; }
  assert.ok(await User.findById(target.user._id)); assert.equal((await ServiceOrder.findById(order._id)).deletedTechnicianName, ''); assert.equal((await call('GET', '/clients', target)).status, 200);
});
test('administradores não conseguem excluir um ao outro e deixar a empresa sem administrador', async () => {
  const { company, owner } = await fixture(), second = await person(company, 'admin');
  const results = await Promise.all([call('DELETE', pathFor(second), owner, bodyFor(second)), call('DELETE', pathFor(owner), second, bodyFor(owner))]);
  assert.equal(results.filter(r => r.status === 204).length, 1); assert.ok(results.every(r => [204, 401, 403, 404, 409].includes(r.status)));
  assert.equal(await User.countDocuments({ companyId: company._id, role: 'admin', active: true }), 1);
});
test('criação e reatribuição concorrentes de OS/agenda não perdem o nome do técnico excluído', async () => {
  for (const flow of ['create-order', 'create-appointment', 'assign-order', 'assign-appointment']) {
    const { company, owner, target, client } = await fixture(); let method = 'POST', path, data;
    if (flow === 'create-order') { path = '/service-orders'; data = { clientId: String(client._id), technicianId: String(target.user._id) }; }
    else if (flow === 'create-appointment') { path = '/appointments'; data = { technicianId: String(target.user._id), date: '2026-11-10', startTime: '08:00', endTime: '09:00' }; }
    else if (flow === 'assign-order') { const order = await ServiceOrder.create({ companyId: company._id, clientId: client._id }); method = 'PATCH'; path = '/service-orders/' + order._id; data = { technicianId: String(target.user._id) }; }
    else { const other = await person(company); const appointment = await Appointment.create({ companyId: company._id, technicianId: other.user._id, date: '2026-11-10', startTime: '08:00', endTime: '09:00' }); method = 'PATCH'; path = '/appointments/' + appointment._id; data = { technicianId: String(target.user._id) }; }
    const [deleted, assigned] = await Promise.all([call('DELETE', pathFor(target), owner, bodyFor(target)), call(method, path, owner, data)]);
    assert.equal(deleted.status, 204); assert.ok([200, 201, 400, 409].includes(assigned.status), flow + ': ' + assigned.status);
    for (const model of [ServiceOrder, Appointment]) for (const record of await model.find({ companyId: company._id, technicianId: target.user._id })) assert.equal(record.deletedTechnicianName, target.user.name, flow);
    assert.equal(await User.findById(target.user._id), null);
  }
});
test('histórico de agenda pode ser cancelado e vínculos podem ser reatribuídos após excluir o técnico', async () => {
  const { company, owner, target, client } = await fixture(), replacement = await person(company);
  const order = await ServiceOrder.create({ companyId: company._id, clientId: client._id, technicianId: target.user._id });
  const appointment = await Appointment.create({ companyId: company._id, technicianId: target.user._id, serviceOrderId: order._id, date: '2026-11-10', startTime: '08:00', endTime: '09:00' });
  assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 204);
  assert.equal((await call('PATCH', '/appointments/' + appointment._id, owner, { date: '2026-11-11' })).status, 400);
  const cancelled = await call('PATCH', '/appointments/' + appointment._id, owner, { status: 'cancelado' }); assert.equal(cancelled.status, 200); assert.equal(cancelled.data.deletedTechnicianName, target.user.name);
  const reassigned = await call('PATCH', '/appointments/' + appointment._id, owner, { technicianId: String(replacement.user._id) }); assert.equal(reassigned.status, 200); assert.equal(reassigned.data.deletedTechnicianName, '');
  const updated = await call('PATCH', '/service-orders/' + order._id, owner, { technicianId: String(replacement.user._id) }); assert.equal(updated.status, 200); assert.equal(updated.data.deletedTechnicianName, '');
});
test('login iniciado antes da exclusão não recria sessão do membro apagado', { timeout: 30000 }, async () => {
  const { owner, target } = await fixture(), original = User.prototype.comparePassword; let signal, release;
  const verified = new Promise(resolve => { signal = resolve; }), resume = new Promise(resolve => { release = resolve; });
  User.prototype.comparePassword = async function (value) { const valid = await original.call(this, value); if (this.email === target.user.email) { signal(); await resume; } return valid; };
  const login = call('POST', '/auth/login', null, { email: target.user.email, password });
  try { await verified; assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 204); release(); assert.equal((await login).status, 401); assert.equal(await AuthSession.countDocuments({ userId: target.user._id }), 0); }
  finally { release(); User.prototype.comparePassword = original; await login; }
});
test('rota iniciada antes da exclusão não recria compartilhamento do membro apagado', async () => {
  const { company, owner, target } = await fixture(), original = Company.findOneAndUpdate; let intercepted = false;
  Company.findOneAndUpdate = async function (...args) {
    if (!intercepted && String(args[0]._id) === String(company._id)) { intercepted = true; assert.equal((await call('DELETE', pathFor(target), owner, bodyFor(target))).status, 204); }
    return original.apply(this, args);
  };
  try { assert.equal((await call('POST', '/route-tracking/mine', target, { consent: true, deviceToken: 'f'.repeat(64) })).status, 401); assert.equal(await RouteSession.countDocuments({ technicianId: target.user._id }), 0); }
  finally { Company.findOneAndUpdate = original; }
});
test('tentativas de exclusão têm limite por administrador', async () => {
  const { owner, target } = await fixture();
  for (let i = 0; i < 10; i++) assert.equal((await call('DELETE', pathFor(target), owner, { ...bodyFor(target), confirm: false })).status, 400);
  const result = await call('DELETE', pathFor(target), owner, bodyFor(target)); assert.equal(result.status, 429); assert.ok(result.data.error.includes('15 minutos')); assert.ok(await User.findById(target.user._id));
});
