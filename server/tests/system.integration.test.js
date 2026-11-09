const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-access-secret-long-enough';
process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret-long-enough';
process.env.CLIENT_URL = 'http://localhost:5173';
const User = require('../models/User');
const Company = require('../models/Company');
const AuthSession = require('../models/AuthSession');
const Client = require('../models/Client');
const Budget = require('../models/Budget');
const ServiceOrder = require('../models/ServiceOrder');
const StockItem = require('../models/StockItem');
const RouteSession = require('../models/RouteSession');
const ClientImport = require('../models/ClientImport');
const { randomUUID } = require('node:crypto');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/tokens');
let mongo, server, base, a, b, admin, finance, tech, other, superAdmin, client, foreignClient, order;
const password = 'Test-password-42!';
async function sessionFor(user) {
  const s = new AuthSession({ userId:user._id, scope:user.role==='super_admin'?'admin':'tenant', expiresAt:new Date(Date.now()+86400000) });
  const refresh=signRefreshToken(user,s._id);s.refreshHash=hashToken(refresh);await s.save();
  return { token:signAccessToken(user,s._id), refresh, id:s._id };
}
async function call(method, path, actor, body, extra={}) {
  const headers={ ...(actor ? { Authorization:'Bearer '+actor.token }: {}), ...extra };
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type']='application/json';
  const response=await fetch(base+'/api'+path,{method,headers,body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
  let data=null;const type=response.headers.get('content-type')||'';
  if (type.includes('application/json')) data=await response.json(); else if(type.includes('application/pdf')) data=Buffer.from(await response.arrayBuffer());
  return {status:response.status,data,headers:response.headers};
}
async function createUser(company,role,email) {
  const user=await User.create({companyId:company?company._id:null,name:role,email,passwordHash:await User.hashPassword(password),role});
  return {...await sessionFor(user),user};
}
before(async()=>{
  mongo=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});
  await mongoose.connect(mongo.getUri());
  const app=require('../app')();
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  a=await Company.create({name:'Empresa A',plan:'pro'});b=await Company.create({name:'Empresa B',plan:'pro'});
  admin=await createUser(a,'admin','admin-a@example.com');finance=await createUser(a,'financeiro','finance-a@example.com');tech=await createUser(a,'tecnico','tech-a@example.com');other=await createUser(b,'admin','admin-b@example.com');superAdmin=await createUser(null,'super_admin','super@example.com');
  client=await Client.create({companyId:a._id,name:'Cliente A'});foreignClient=await Client.create({companyId:b._id,name:'Cliente B'});
  order=await ServiceOrder.create({companyId:a._id,clientId:client._id,technicianId:tech.user._id});
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await mongoose.disconnect();if(mongo)await mongo.stop();});

test('chamado e execução da OS persistem e aparecem para financeiro, técnico e histórico',async()=>{
  const r=await call('POST','/service-orders',finance,{clientId:String(client._id),technicianId:String(tech.user._id),calledAt:'2026-11-01T08:30:00-03:00',requestDescription:'  Verificar ar-condicionado  '});
  assert.equal(r.status,201);assert.equal(r.data.calledAt,'2026-11-01T11:30:00.000Z');assert.equal(r.data.requestDescription,'Verificar ar-condicionado');
  const url='/service-orders/'+r.data._id;
  const updated=await call('PATCH',url,tech,{status:'em_andamento',startedAt:'2026-11-01T09:00:00-03:00',finishedAt:'2026-11-01T10:00:00-03:00',serviceDescription:'  Inspeção e limpeza realizadas.  ',hasPending:true,pendingReason:'material',pendingNotes:'  Falta sensor para concluir.  ',expectedUpdatedAt:r.data.updatedAt});
  assert.equal(updated.status,200);assert.equal(updated.data.serviceDescription,'Inspeção e limpeza realizadas.');assert.equal(updated.data.pendingNotes,'Falta sensor para concluir.');
  for(const actor of [admin,finance,tech]){const read=await call('GET',url,actor);assert.equal(read.status,200);assert.equal(read.data.hasPending,true);assert.equal(read.data.finishedAt,'2026-11-01T13:00:00.000Z');}
  const history=await call('GET','/clients/'+client._id+'/history',tech);assert.equal(history.status,200);assert.equal(history.data.serviceOrders.find(o=>o._id===r.data._id).pendingReason,'material');
  assert.equal((await call('PATCH',url,finance,{status:'concluida'})).status,400);
  const resolved=await call('PATCH',url,tech,{hasPending:false,status:'concluida',serviceDescription:'Inspeção, limpeza e troca do sensor realizadas.'});assert.equal(resolved.status,200);assert.equal(resolved.data.pendingNotes,'Falta sensor para concluir.');assert.equal(resolved.data.hasPending,false);
});
test('novos registros da OS mantêm isolamento por empresa e atribuição ao técnico',async()=>{
  const r=await call('POST','/service-orders',admin,{clientId:String(client._id),calledAt:'2026-11-01T08:00:00Z'});assert.equal(r.status,201);
  const url='/service-orders/'+r.data._id;
  assert.equal((await call('PATCH',url,tech,{serviceDescription:'Indevido'})).status,404);
  assert.equal((await call('GET',url,other)).status,404);assert.equal((await call('PATCH',url,other,{hasPending:true,pendingReason:'material',pendingNotes:'Indevido'})).status,404);
  assert.equal((await call('PATCH',url,null,{serviceDescription:'Indevido'})).status,401);assert.equal((await call('PATCH',url,superAdmin,{serviceDescription:'Indevido'})).status,403);
  assert.equal((await call('PATCH',url,admin,{technicianId:String(tech.user._id)})).status,200);
  for(const body of [{calledAt:'2026-11-01T07:00:00Z'},{requestDescription:'Alteração indevida'}]) assert.equal((await call('PATCH',url,tech,body)).status,403);
  for(const body of [{companyId:String(b._id)},{serviceDescription:{$ne:null}},{hasPending:'true'},{pendingReason:'arbitrario'},{serviceDescription:'x'.repeat(8001)}]) assert.equal((await call('PATCH',url,admin,body)).status,400);
});
test('validação recusa datas inválidas, futuras e fora de sequência sem alterar a OS',async()=>{
  const calledAt='2026-11-01T11:00:00Z',r=await call('POST','/service-orders',admin,{clientId:String(client._id),calledAt});assert.equal(r.status,201);
  const url='/service-orders/'+r.data._id;
  const invalid=[{startedAt:'2026-11-01T10:59:00Z'},{finishedAt:'2026-11-01T10:59:00Z'},{startedAt:'2026-11-01T12:00:00Z',finishedAt:'2026-11-01T11:59:00Z'},{calledAt:'2026-02-30T10:00:00Z'},{startedAt:'2026-11-01T12:00:00'},{finishedAt:'invalid'},{startedAt:new Date(Date.now()+3600000).toISOString()}];
  for(const body of invalid) assert.equal((await call('PATCH',url,admin,body)).status,400,JSON.stringify(body));
  assert.equal((await call('POST','/service-orders',admin,{clientId:String(client._id),calledAt:new Date(Date.now()+3600000).toISOString()})).status,400);
  const unchanged=await call('GET',url,admin);assert.equal(unchanged.data.startedAt,null);assert.equal(unchanged.data.finishedAt,null);assert.equal(unchanged.data.calledAt,new Date(calledAt).toISOString());
});
test('OS exige descrição para concluir e motivo/detalhes para registrar pendência',async()=>{
  const r=await call('POST','/service-orders',admin,{clientId:String(client._id)});assert.equal(r.status,201);assert.ok(r.data.calledAt);
  const url='/service-orders/'+r.data._id;
  for(const body of [{status:'concluida'},{hasPending:true},{hasPending:true,pendingReason:'imprevisto'},{hasPending:true,pendingNotes:'Sem acesso'},{status:'concluida',serviceDescription:'Feito',finishedAt:null},{status:'concluida',serviceDescription:'Feito',hasPending:true,pendingReason:'retorno',pendingNotes:'Retornar'}]) assert.equal((await call('PATCH',url,admin,body)).status,400);
  const started=await call('PATCH',url,admin,{status:'em_andamento'});assert.equal(started.status,200);assert.ok(started.data.startedAt);
  const done=await call('PATCH',url,admin,{status:'concluida',serviceDescription:'Teste realizado com sucesso'});assert.equal(done.status,200);assert.ok(done.data.finishedAt);
});
test('edição desatualizada não sobrescreve informações salvas por outra pessoa',async()=>{
  const r=await call('POST','/service-orders',admin,{clientId:String(client._id),technicianId:String(tech.user._id)});assert.equal(r.status,201);
  const url='/service-orders/'+r.data._id,stamp=r.data.updatedAt;
  const first=await call('PATCH',url,tech,{serviceDescription:'Registrado pelo técnico',expectedUpdatedAt:stamp});assert.equal(first.status,200);
  const conflict=await call('PATCH',url,finance,{serviceDescription:'Versão antiga',expectedUpdatedAt:stamp});assert.equal(conflict.status,409);
  assert.equal((await call('GET',url,admin)).data.serviceDescription,'Registrado pelo técnico');
  const original=ServiceOrder.findOneAndUpdate;let intercepted=false;
  ServiceOrder.findOneAndUpdate=async function(...args){
    if(!intercepted && String(args[0]._id)===r.data._id){intercepted=true;await ServiceOrder.updateOne({_id:r.data._id},{$set:{serviceDescription:'Alteração concorrente'},$inc:{__v:1}});}
    return original.apply(this,args);
  };
  try{assert.equal((await call('PATCH',url,admin,{hasPending:true,pendingReason:'outro',pendingNotes:'Concorrência'})).status,409);}
  finally{ServiceOrder.findOneAndUpdate=original;}
  assert.equal((await call('GET',url,admin)).data.serviceDescription,'Alteração concorrente');
});
test('OS antiga preserva a data original e continua aceitando checklist sem exigir migração',async()=>{
  const id=new mongoose.Types.ObjectId(),createdAt=new Date('2026-10-01T12:00:00Z');
  await ServiceOrder.collection.insertOne({_id:id,companyId:a._id,clientId:client._id,status:'concluida',createdAt,updatedAt:createdAt,__v:0,checklist:[],photos:[],materialsUsed:[],laborHours:0});
  const url='/service-orders/'+id,read=await call('GET',url,admin);assert.equal(read.status,200);assert.equal(read.data.calledAt,null);assert.equal(read.data.createdAt,createdAt.toISOString());
  assert.equal((await call('PATCH',url,admin,{checklist:[{item:'Verificado',done:true}]})).status,200);
  const updated=await call('PATCH',url,finance,{calledAt:'2026-10-01T09:00:00Z',serviceDescription:'Atendimento registrado depois',finishedAt:'2026-10-01T14:00:00Z'});assert.equal(updated.status,200);
});

test('exclusão de OS sem vínculos exige admin/financeiro e não cruza empresas',async()=>{
  const own=await ServiceOrder.create({companyId:a._id,clientId:client._id,technicianId:tech.user._id});
  const url='/service-orders/'+own._id;
  for(const actor of [null,tech,superAdmin]){
    assert.equal((await call('GET',url+'/deletion-check',actor)).status,actor?403:401);
    assert.equal((await call('DELETE',url,actor)).status,actor?403:401);
  }
  assert.equal((await call('GET',url+'/deletion-check',other)).status,404);
  assert.equal((await call('DELETE',url,other)).status,404);assert.ok(await ServiceOrder.exists({_id:own._id}));
  assert.equal((await call('GET','/service-orders/invalid/deletion-check',admin)).status,400);
  for(const actor of [admin,finance]){
    const record=actor===admin?own:await ServiceOrder.create({companyId:a._id,clientId:client._id});
    const path='/service-orders/'+record._id,check=await call('GET',path+'/deletion-check',actor);
    assert.equal(check.status,200);assert.equal(check.headers.get('cache-control'),'no-store');assert.equal(check.data.canDelete,true);assert.deepEqual(check.data.reasons,[]);
    assert.equal((await call('DELETE',path,actor)).status,204);assert.equal(await ServiceOrder.exists({_id:record._id}),null);
    assert.equal((await call('DELETE',path,actor)).status,404);
    assert.ok(await mongoose.model('AuditLog').exists({entityId:record._id,entity:'ServiceOrder',action:'delete'}));
  }
});
test('materiais, agendamento e financeiro bloqueiam exclusão da OS e permitem cancelar sem perder vínculos',async()=>{
  for(const kind of ['materials','appointments','financial']){
    const record=await ServiceOrder.create({companyId:a._id,clientId:client._id,technicianId:tech.user._id});
    const path='/service-orders/'+record._id;let related;
    if(kind==='materials'){
      related=await StockItem.create({companyId:a._id,name:'Material de teste de exclusão',quantity:5});
      assert.equal((await call('POST',path+'/materials',admin,{stockItemId:String(related._id),qty:1})).status,201);
    }else if(kind==='appointments'){
      const r=await call('POST','/appointments',finance,{technicianId:String(tech.user._id),serviceOrderId:String(record._id),date:'2026-11-04',startTime:'09:00',endTime:'10:00'});assert.equal(r.status,201);related=r.data;
    }else{
      const r=await call('POST','/financial-entries',finance,{type:'receita',description:'Serviço vinculado',amount:100,dueDate:'2026-11-03',relatedServiceOrderId:String(record._id)});assert.equal(r.status,201);related=r.data;
    }
    const check=await call('GET',path+'/deletion-check',admin);assert.equal(check.status,200);assert.equal(check.data.canDelete,false);assert.equal(check.data.reasons.length,1);
    const blocked=await call('DELETE',path,finance);assert.equal(blocked.status,409);assert.equal(blocked.data.code,'OS_HAS_LINKS');assert.equal(blocked.data.canDelete,false);assert.deepEqual(blocked.data.reasons,check.data.reasons);
    const cancelled=await call('PATCH',path,finance,{status:'cancelada'});assert.equal(cancelled.status,200);assert.equal(cancelled.data.status,'cancelada');
    assert.equal((await call('GET',path+'/deletion-check',admin)).data.status,'cancelada');assert.equal((await call('DELETE',path,admin)).status,409);
    if(kind==='materials'){assert.equal((await StockItem.findById(related._id)).quantity,4);assert.equal((await ServiceOrder.findById(record._id)).materialsUsed.length,1);}
    else assert.ok(await mongoose.model(kind==='appointments'?'Appointment':'FinancialEntry').exists({_id:related._id}));
    assert.equal(await mongoose.model('AuditLog').countDocuments({entityId:record._id,entity:'ServiceOrder',action:'delete'}),0);
  }
});
test('vínculo criado depois da conferência também impede excluir a OS',async()=>{
  const record=await ServiceOrder.create({companyId:a._id,clientId:client._id}),path='/service-orders/'+record._id;
  assert.equal((await call('GET',path+'/deletion-check',admin)).data.canDelete,true);
  const entry=await call('POST','/financial-entries',finance,{type:'despesa',description:'Criado após a conferência',amount:20,dueDate:'2026-11-03',relatedServiceOrderId:String(record._id)});assert.equal(entry.status,201);
  const blocked=await call('DELETE',path,admin);assert.equal(blocked.status,409);assert.equal(blocked.data.code,'OS_HAS_LINKS');assert.ok(blocked.data.reasons.includes('Lançamentos financeiros vinculados'));
  assert.ok(await ServiceOrder.exists({_id:record._id}));assert.ok(await mongoose.model('FinancialEntry').exists({_id:entry.data._id}));
});
test('exclusão concorrente com agendamento ou financeiro não deixa vínculos órfãos',async()=>{
  for(const type of ['appointments','financial-entries']){
    const record=await ServiceOrder.create({companyId:a._id,clientId:client._id});
    const body=type==='appointments'?{technicianId:String(tech.user._id),serviceOrderId:String(record._id),date:'2026-11-04',startTime:'10:00',endTime:'11:00'}:{type:'receita',description:'Vínculo concorrente',amount:50,dueDate:'2026-11-03',relatedServiceOrderId:String(record._id)};
    const [removed,created]=await Promise.all([call('DELETE','/service-orders/'+record._id,admin),call('POST','/'+type,finance,body)]);
    if(removed.status===204){assert.equal(created.status,400);assert.equal(await ServiceOrder.exists({_id:record._id}),null);}
    else{assert.equal(removed.status,409);assert.equal(removed.data.code,'OS_HAS_LINKS');assert.equal(created.status,201);assert.ok(await ServiceOrder.exists({_id:record._id}));}
  }
});

test('prévia de clientes não grava dados e confirmação importa somente linhas válidas',async()=>{
  const c=await Company.create({name:'Importação de clientes',plan:'basic'}),owner=await createUser(c,'admin','import-owner@example.com');
  await Client.create({companyId:c._id,name:'Já cadastrado',document:'012.345.678-90',phone:'999',notes:'Preservar'});
  const rows=[{row:2,data:{name:'Novo cliente',phone:'000123',email:' NOVO@EXAMPLE.COM ',address:'Rua A',notes:'Observação'}},{row:3,data:{name:'Outro nome',document:'01234567890'}},{row:4,data:{name:''}},{row:5,data:{name:'Novo cliente',phone:'000123',email:'novo@example.com'}}];
  const p=await call('POST','/clients/import/preview',owner,{rows});assert.equal(p.status,200);assert.equal(p.data.ready,1);assert.equal(p.data.duplicates,2);assert.equal(p.data.invalid,1);assert.equal(await Client.countDocuments({companyId:c._id}),1);
  assert.equal((await call('POST','/clients/import',owner,{rows,requestId:randomUUID()})).status,400);
  const body={rows,requestId:randomUUID(),confirm:true},r=await call('POST','/clients/import',owner,body);assert.equal(r.status,200);assert.equal(r.data.imported,1);assert.equal(r.headers.get('cache-control'),'no-store');
  const added=await Client.findOne({companyId:c._id,name:'Novo cliente'});assert.equal(added.phone,'000123');assert.equal(added.email,'novo@example.com');assert.equal(added.notes,'Observação');
  assert.equal((await Client.findOne({companyId:c._id,document:'012.345.678-90'})).notes,'Preservar');
  const replay=await call('POST','/clients/import',owner,body);assert.equal(replay.status,200);assert.equal(replay.data.imported,1);assert.equal(replay.data.replayed,true);assert.equal(await Client.countDocuments({companyId:c._id}),2);
  assert.equal((await call('POST','/clients/import',owner,{...body,rows:[{row:2,data:{name:'Mudou'}}]})).status,409);
});
test('importação é restrita a admin/financeiro e isolada por empresa',async()=>{
  const c=await Company.create({name:'Importação isolada',plan:'pro'}),owner=await createUser(c,'admin','import-isolated@example.com'),accountant=await createUser(c,'financeiro','import-finance@example.com');
  const rows=[{row:2,data:{name:'Cliente isolado',document:'98765432100'}}];
  await Client.create({companyId:b._id,name:'Outra empresa',document:'98765432100'});
  for(const actor of [null,tech,superAdmin])assert.equal((await call('POST','/clients/import/preview',actor,{rows})).status,actor?403:401);
  assert.equal((await call('POST','/clients/import/preview',accountant,{rows})).data.ready,1);
  assert.equal((await call('POST','/clients/import',owner,{rows,confirm:true,requestId:randomUUID(),companyId:String(b._id)})).status,400);
  const r=await call('POST','/clients/import',accountant,{rows,confirm:true,requestId:randomUUID()});assert.equal(r.status,200);assert.equal(r.data.imported,1);
  assert.equal(await Client.countDocuments({companyId:c._id}),1);assert.equal(await Client.countDocuments({companyId:b._id,document:'98765432100'}),1);
  const invalid=await call('POST','/clients/import',owner,{rows:[{row:2,data:{name:'Ataque',companyId:String(b._id)}}],confirm:true,requestId:randomUUID()});assert.equal(invalid.status,200);assert.equal(invalid.data.invalid,1);assert.equal(invalid.data.imported,0);
});
test('importações concorrentes não repetem clientes e reavaliam duplicatas após a prévia',async()=>{
  const c=await Company.create({name:'Importação concorrente',plan:'pro'}),owner=await createUser(c,'admin','import-concurrent@example.com');
  const rows=[{row:2,data:{name:'Uma vez',document:'AB123456000100'}}];
  assert.equal((await call('POST','/clients/import/preview',owner,{rows})).data.ready,1);
  const result=await Promise.all([call('POST','/clients/import',owner,{rows,confirm:true,requestId:randomUUID()}),call('POST','/clients/import',owner,{rows,confirm:true,requestId:randomUUID()})]);
  assert.deepEqual(result.map(r=>r.status),[200,200]);assert.deepEqual(result.map(r=>r.data.imported).sort(),[0,1]);assert.equal(await Client.countDocuments({companyId:c._id}),1);
});
test('falha no lote reverte clientes e comprovante para permitir tentar novamente',async()=>{
  const c=await Company.create({name:'Importação com falha',plan:'pro'}),owner=await createUser(c,'admin','import-rollback@example.com');
  const body={rows:[{row:2,data:{name:'Reverter'}}],confirm:true,requestId:randomUUID()};
  const original=ClientImport.create;ClientImport.create=async()=>{throw new Error('injected-import-failure')};
  try{const r=await call('POST','/clients/import',owner,body);assert.equal(r.status,500);assert.ok(!r.data.error.includes('injected'));}finally{ClientImport.create=original;}
  assert.equal(await Client.countDocuments({companyId:c._id}),0);assert.equal(await ClientImport.countDocuments({companyId:c._id}),0);
  assert.equal((await call('POST','/clients/import',owner,body)).data.imported,1);
});
test('importação aceita lote maior que o JSON comum mas mantém limites de tamanho e linhas',async()=>{
  const c=await Company.create({name:'Importação grande',plan:'pro'}),owner=await createUser(c,'admin','import-large@example.com');
  const rows=Array.from({length:1000},(_,i)=>({row:i+2,data:{name:'Cliente '+i,notes:'x'.repeat(180)}}));
  const r=await call('POST','/clients/import',owner,{rows,confirm:true,requestId:randomUUID()});assert.equal(r.status,200);assert.equal(r.data.imported,1000);
  assert.equal((await call('POST','/clients/import/preview',owner,{rows:[...rows,{row:1002,data:{name:'Excesso'}}]})).status,400);
  assert.equal((await call('POST','/clients/import/preview',owner,{rows:[],padding:'x'.repeat(5*1024*1024)})).status,413);
  assert.equal((await call('POST','/clients',owner,{name:'X',notes:'x'.repeat(140000)})).status,413);
});
test('limite de importações é individual e não bloqueia outro administrador no mesmo IP',async()=>{
  const c=await Company.create({name:'Limite de importação',plan:'pro'}),owner=await createUser(c,'admin','import-limit@example.com');
  const rows=[{row:2,data:{name:'Prévia'}}];
  for(let i=0;i<30;i++)assert.equal((await call('POST','/clients/import/preview',owner,{rows})).status,200);
  assert.equal((await call('POST','/clients/import/preview',owner,{rows})).status,429);
  assert.equal((await call('POST','/clients/import/preview',admin,{rows})).status,200);
});

test('admin redefine senha da própria empresa, revoga sessões/rota e não armazena texto aberto',async()=>{
  const c=await Company.create({name:'Redefinição',plan:'pro'});
  const owner=await createUser(c,'admin','reset-owner@example.com');
  const person=await createUser(c,'tecnico','reset-tech@example.com');
  const second=await sessionFor(person.user),device='7'.repeat(64);
  await call('POST','/route-tracking/mine',person,{consent:true,deviceToken:device});
  const r=await call('POST','/company-users/'+person.user._id+'/reset-password',owner,{confirm:true,currentPassword:password});
  assert.equal(r.status,200);assert.equal(r.data.selfReset,false);assert.match(r.data.tempPassword,/^[A-Za-z0-9_-]{16}$/);
  assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.data.user.passwordHash,undefined);
  const stored=await User.findById(person.user._id).select('+passwordHash');
  assert.notEqual(stored.passwordHash,r.data.tempPassword);assert.ok(await stored.comparePassword(r.data.tempPassword));assert.equal(await stored.comparePassword(password),false);
  assert.equal(await AuthSession.countDocuments({userId:person.user._id}),0);
  for(const actor of [person,second]) assert.equal((await call('GET','/clients',actor)).status,401);
  assert.equal((await call('POST','/auth/refresh',null,undefined,{Cookie:'refreshToken='+person.refresh})).status,401);
  assert.equal((await call('GET','/route-tracking/device',null,undefined,{Authorization:'Route '+device})).status,410);
  assert.equal((await call('POST','/auth/login',null,{email:person.user.email,password})).status,401);
  assert.equal((await call('POST','/auth/login',null,{email:person.user.email,password:r.data.tempPassword})).status,200);
  const listed=await call('GET','/company-users',owner);assert.equal(listed.status,200);
  for(const user of listed.data){assert.equal(user.passwordHash,undefined);assert.equal(user.tempPassword,undefined)}
  const audit=await mongoose.model('AuditLog').findOne({entityId:person.user._id,action:'reset-password'}).lean();assert.ok(audit);
  assert.ok(!JSON.stringify(audit).includes(r.data.tempPassword));
});
test('admin pode redefinir a própria senha e todos os acessos antigos deixam de funcionar',async()=>{
  const c=await Company.create({name:'Própria senha',plan:'pro'}),owner=await createUser(c,'admin','reset-self@example.com');
  const second=await sessionFor(owner.user);
  const r=await call('POST','/company-users/'+owner.user._id+'/reset-password',owner,{confirm:true,currentPassword:password});
  assert.equal(r.status,200);assert.equal(r.data.selfReset,true);assert.ok(r.data.tempPassword);
  for(const actor of [owner,second]) assert.equal((await call('GET','/company-users',actor)).status,401);
  assert.equal((await call('POST','/auth/refresh',null,undefined,{Cookie:'refreshToken='+owner.refresh})).status,401);
  assert.equal((await call('POST','/auth/login',null,{email:owner.user.email,password:r.data.tempPassword})).status,200);
  assert.equal((await call('POST','/auth/admin-refresh',null,undefined,{Cookie:'adminRefreshToken='+superAdmin.refresh})).status,200);
});
test('redefinição exige admin, confirmação e senha atual e não cruza empresas',async()=>{
  const c=await Company.create({name:'Permissões de senha',plan:'pro'}),owner=await createUser(c,'admin','reset-permissions@example.com');
  const target=await createUser(c,'tecnico','reset-protected@example.com'),url='/company-users/'+target.user._id+'/reset-password';
  for(const actor of [null,finance,tech,superAdmin]) assert.equal((await call('POST',url,actor,{confirm:true,currentPassword:password})).status,actor?403:401);
  assert.equal((await call('POST',url,other,{confirm:true,currentPassword:password})).status,404);
  assert.equal((await call('POST','/company-users/'+new mongoose.Types.ObjectId()+'/reset-password',owner,{confirm:true,currentPassword:password})).status,404);
  for(const body of [{currentPassword:password},{confirm:false,currentPassword:password},{confirm:true},{confirm:true,currentPassword:{$ne:null}},{confirm:true,currentPassword:password,password:'chosen-by-client'}]) assert.equal((await call('POST',url,owner,body)).status,400);
  assert.equal((await call('POST',url,owner,{confirm:true,currentPassword:'wrong'})).status,403);
  assert.ok(await (await User.findById(target.user._id).select('+passwordHash')).comparePassword(password));
  assert.equal((await call('GET','/clients',target)).status,200);
});
test('redefinir usuário inativo não reativa seu acesso',async()=>{
  const c=await Company.create({name:'Usuário inativo',plan:'pro'}),owner=await createUser(c,'admin','reset-inactive-owner@example.com'),target=await createUser(c,'tecnico','reset-inactive-person@example.com');
  await User.updateOne({_id:target.user._id},{$set:{active:false}});
  const r=await call('POST','/company-users/'+target.user._id+'/reset-password',owner,{confirm:true,currentPassword:password});
  assert.equal(r.status,200);assert.equal(r.data.user.active,false);
  assert.equal((await call('POST','/auth/login',null,{email:target.user.email,password:r.data.tempPassword})).status,401);
});
test('falha ao encerrar rota reverte senha e revogação de sessões juntas',async()=>{
  const c=await Company.create({name:'Falha na troca',plan:'pro'}),owner=await createUser(c,'admin','reset-rollback-owner@example.com'),target=await createUser(c,'tecnico','reset-rollback-person@example.com');
  const original=RouteSession.deleteMany;RouteSession.deleteMany=()=>{throw new Error('injected-password-reset-failure')};
  try {
    const r=await call('POST','/company-users/'+target.user._id+'/reset-password',owner,{confirm:true,currentPassword:password});
    assert.equal(r.status,500);assert.equal(r.data.tempPassword,undefined);assert.ok(!r.data.error.includes('injected'));
  } finally {RouteSession.deleteMany=original;}
  assert.ok(await (await User.findById(target.user._id).select('+passwordHash')).comparePassword(password));
  assert.equal((await call('GET','/clients',target)).status,200);
});
test('sessão do administrador revogada durante a confirmação impede a troca',async()=>{
  const c=await Company.create({name:'Sessão revogada',plan:'pro'}),owner=await createUser(c,'admin','reset-revoked-owner@example.com'),target=await createUser(c,'tecnico','reset-revoked-person@example.com');
  const original=User.hashPassword;
  User.hashPassword=async value=>{const hash=await original(value);await AuthSession.deleteOne({_id:owner.id});return hash;};
  try {assert.equal((await call('POST','/company-users/'+target.user._id+'/reset-password',owner,{confirm:true,currentPassword:password})).status,401);}
  finally {User.hashPassword=original;}
  assert.ok(await (await User.findById(target.user._id).select('+passwordHash')).comparePassword(password));
});
test('tentativas de redefinição têm limite por administrador',async()=>{
  const c=await Company.create({name:'Limite de redefinições',plan:'pro'}),owner=await createUser(c,'admin','reset-limit@example.com');
  const url='/company-users/'+owner.user._id+'/reset-password';
  for(let i=0;i<10;i++) assert.equal((await call('POST',url,owner,{confirm:false,currentPassword:password})).status,400);
  const r=await call('POST',url,owner,{confirm:true,currentPassword:password});assert.equal(r.status,429);assert.ok(r.data.error.includes('15 minutos'));
  assert.ok(await (await User.findById(owner.user._id).select('+passwordHash')).comparePassword(password));
});
test('login iniciado com senha antiga não cria sessão depois da redefinição', {timeout:10000}, async()=>{
  const c=await Company.create({name:'Login concorrente à troca',plan:'pro'}),owner=await createUser(c,'admin','reset-login-owner@example.com'),target=await createUser(c,'tecnico','reset-login-person@example.com');
  const original=User.prototype.comparePassword;
  let signal,release;
  const verified=new Promise(resolve=>{signal=resolve}),resume=new Promise(resolve=>{release=resolve});
  User.prototype.comparePassword=async function(value){const valid=await original.call(this,value);if(this.email===target.user.email){signal();await resume;}return valid;};
  const login=call('POST','/auth/login',null,{email:target.user.email,password});
  try {
    await verified;
    assert.equal((await call('POST','/company-users/'+target.user._id+'/reset-password',owner,{confirm:true,currentPassword:password})).status,200);
    release();assert.equal((await login).status,401);assert.equal(await AuthSession.countDocuments({userId:target.user._id}),0);
  }finally{release();User.prototype.comparePassword=original;await login;}
});
test('rota iniciada durante a troca não sobrevive à revogação da senha',async()=>{
  const c=await Company.create({name:'Rota concorrente à troca',plan:'pro'}),owner=await createUser(c,'admin','reset-route-owner@example.com'),target=await createUser(c,'tecnico','reset-route-person@example.com');
  const original=Company.findOneAndUpdate;let intercepted=false;
  Company.findOneAndUpdate=async function(...args){
    if(!intercepted && String(args[0]._id)===String(c._id)){
      intercepted=true;
      assert.equal((await call('POST','/company-users/'+target.user._id+'/reset-password',owner,{confirm:true,currentPassword:password})).status,200);
    }
    return original.apply(this,args);
  };
  try{assert.equal((await call('POST','/route-tracking/mine',target,{consent:true,deviceToken:'8'.repeat(64)})).status,401);assert.equal(await RouteSession.countDocuments({technicianId:target.user._id}),0);}
  finally{Company.findOneAndUpdate=original;}
});

test('autenticação restaura super admin, normaliza e-mail e separa cookies',async()=>{
  let r=await call('POST','/auth/login',null,{email:' ADMIN-A@EXAMPLE.COM ',password});assert.equal(r.status,200);assert.equal(r.data.user.role,'admin');assert.equal(r.data.user.passwordHash,undefined);
  r=await call('POST','/auth/admin-refresh',null,undefined,{Cookie:'adminRefreshToken='+superAdmin.refresh});assert.equal(r.status,200);assert.equal(r.data.user.role,'super_admin');
  r=await call('POST','/auth/refresh',null,undefined,{Cookie:'refreshToken='+superAdmin.refresh});assert.equal(r.status,401);
  r=await call('POST','/auth/admin-refresh',null,undefined,{Cookie:'adminRefreshToken='+admin.refresh});assert.equal(r.status,401);
  r=await call('POST','/auth/login',null,{email:{$ne:null},password});assert.equal(r.status,400);
  r=await call('POST','/auth/login',null,{email:admin.user.email,password:'wrong'});assert.equal(r.status,401);
  r=await call('GET','/clients',{token:admin.refresh});assert.equal(r.status,401);
});
test('logout revoga também JWT de acesso e preserva sessão do outro painel',async()=>{
  const own=await sessionFor(admin.user);
  const r=await call('POST','/auth/logout',null,undefined,{Cookie:'refreshToken='+own.refresh+'; adminRefreshToken='+superAdmin.refresh});assert.equal(r.status,204);
  assert.equal((await call('GET','/clients',own)).status,401);
  assert.equal((await call('POST','/auth/refresh',null,undefined,{Cookie:'refreshToken='+own.refresh})).status,401);
  assert.equal((await call('POST','/auth/admin-refresh',null,undefined,{Cookie:'adminRefreshToken='+superAdmin.refresh})).status,200);
  const set=r.headers.get('set-cookie');assert.ok(set.includes('refreshToken='));assert.ok(!set.includes('adminRefreshToken='));
});
test('perfis: financeiro protegido e super admin isolado da operação',async()=>{
  for(const actor of [null,tech,superAdmin]) assert.equal((await call('GET','/financial-entries',actor)).status,actor?403:401);
  const r=await call('POST','/financial-entries',finance,{type:'receita',description:'Serviço',amount:123.45,dueDate:'2026-11-03'});assert.equal(r.status,201);
  assert.equal((await call('DELETE','/financial-entries/'+r.data._id,tech)).status,403);
  assert.equal((await call('PATCH','/financial-entries/'+r.data._id+'/mark-paid',finance)).status,200);
  assert.equal((await call('DELETE','/financial-entries/'+r.data._id,finance)).status,204);
  assert.equal((await call('GET','/dashboard/summary',tech)).data.revenueThisMonth,null);
  assert.equal((await call('GET','/clients',superAdmin)).status,403);
});
test('CRUD de clientes e isolamento entre empresas',async()=>{
  const r=await call('POST','/clients',admin,{name:'  Teste  ',notes:'Observação',companyId:String(b._id)});assert.equal(r.status,201);assert.equal(r.data.companyId,String(a._id));assert.equal(r.data.name,'Teste');
  assert.equal((await call('GET','/clients/'+r.data._id,other)).status,404);
  assert.equal((await call('PATCH','/clients/'+r.data._id,other,{name:'Ataque'})).status,404);
  assert.equal((await call('DELETE','/clients/'+r.data._id,other)).status,404);
  assert.equal((await call('PATCH','/clients/'+r.data._id,admin,{name:'Atualizado'})).data.name,'Atualizado');
  assert.equal((await call('GET','/clients/'+r.data._id+'/history',admin)).status,200);
  assert.equal((await call('DELETE','/clients/'+r.data._id,admin)).status,204);
});
test('entrada inválida não causa 500 e filtros rejeitam operadores',async()=>{
  for(const path of ['/clients','/budgets','/appointments','/stock-items','/financial-entries']) assert.equal((await call('POST',path,admin,{})).status,400,path);
  assert.equal((await call('GET','/clients/invalid-id',admin)).status,400);
  assert.equal((await call('GET','/financial-entries?type[$ne]=despesa',finance)).status,400);
  assert.equal((await call('GET','/service-orders?technicianId[$ne]=x',admin)).status,400);
  assert.equal((await call('POST','/clients',admin,{name:' '.repeat(5)})).status,400);
});
test('agenda valida horário, data e vínculos e limita técnico à própria agenda',async()=>{
  const body={technicianId:String(tech.user._id),date:'2026-11-03',startTime:'09:00',endTime:'10:00',serviceOrderId:String(order._id)};
  assert.equal((await call('POST','/appointments',tech,body)).status,403);
  for(const bad of [{endTime:'08:00'},{date:'2026-02-30'},{startTime:'27:00'},{serviceOrderId:new mongoose.Types.ObjectId().toString()},{technicianId:String(admin.user._id)}]) assert.equal((await call('POST','/appointments',admin,{...body,...bad})).status,400);
  const r=await call('POST','/appointments',admin,body);assert.equal(r.status,201);
  assert.equal((await call('PATCH','/appointments/'+r.data._id,admin,{endTime:'08:00'})).status,400);
  assert.equal((await call('PATCH','/appointments/'+r.data._id,admin,{endTime:'11:00'})).status,200);
  const mine=await call('GET','/appointments?date=2026-11-03&technicianId='+admin.user._id,tech);assert.equal(mine.data.length,1);assert.equal(mine.data[0].technicianId,String(tech.user._id));
  assert.equal((await call('DELETE','/appointments/'+r.data._id,other)).status,404);
  assert.equal((await call('DELETE','/appointments/'+r.data._id,admin)).status,204);
});
test('financeiro rejeita OS de outra empresa, valores e datas inválidas',async()=>{
  const foreign=await ServiceOrder.create({companyId:b._id,clientId:foreignClient._id});
  const body={type:'despesa',description:'Teste',amount:10,dueDate:'2026-11-03'};
  for(const bad of [{amount:-1},{amount:0.001},{dueDate:'2026-13-01'},{relatedServiceOrderId:String(foreign._id)}]) assert.equal((await call('POST','/financial-entries',finance,{...body,...bad})).status,400);
});
test('conversão concorrente cria uma única OS e mantém total monetário',async()=>{
  const budget=await call('POST','/budgets',admin,{clientId:String(client._id),status:'aprovado',items:[{description:'Item',qty:3,unitPrice:0.1}]});assert.equal(budget.status,201);assert.equal(budget.data.total,0.3);
  const r=await Promise.all([call('POST','/budgets/'+budget.data._id+'/convert',admin),call('POST','/budgets/'+budget.data._id+'/convert',admin)]);
  assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);assert.equal(await ServiceOrder.countDocuments({budgetId:budget.data._id}),1);
  assert.equal((await call('GET','/budgets/'+budget.data._id+'/pdf',admin)).data.subarray(0,5).toString(),'%PDF-');
});
test('falha na criação da OS reverte a conversão do orçamento',async()=>{
  const budget=await Budget.create({companyId:a._id,clientId:client._id,status:'aprovado'});
  const original=ServiceOrder.create;ServiceOrder.create=async()=>{throw new Error('injected-order-failure')};
  try {const r=await call('POST','/budgets/'+budget._id+'/convert',admin);assert.equal(r.status,500);assert.ok(!r.data.error.includes('injected'));}
  finally {ServiceOrder.create=original;}
  assert.equal((await Budget.findById(budget._id)).convertedToServiceOrder,false);
});
test('consumo concorrente não deixa estoque negativo nem perde material',async()=>{
  const stock=await StockItem.create({companyId:a._id,name:'Cabo',quantity:3});
  const r=await Promise.all([call('POST','/service-orders/'+order._id+'/materials',tech,{stockItemId:String(stock._id),qty:3}),call('POST','/service-orders/'+order._id+'/materials',tech,{stockItemId:String(stock._id),qty:3})]);
  assert.deepEqual(r.map(x=>x.status).sort(),[201,409]);assert.equal((await StockItem.findById(stock._id)).quantity,0);
  assert.equal((await ServiceOrder.findById(order._id)).materialsUsed.length,1);
});
test('falha ao registrar material reverte baixa no estoque',async()=>{
  const stock=await StockItem.create({companyId:a._id,name:'Tubo',quantity:10});
  const original=ServiceOrder.findOneAndUpdate;ServiceOrder.findOneAndUpdate=()=>{throw new Error('injected-material-failure')};
  try {assert.equal((await call('POST','/service-orders/'+order._id+'/materials',tech,{stockItemId:String(stock._id),qty:2})).status,500);}
  finally {ServiceOrder.findOneAndUpdate=original;}
  assert.equal((await StockItem.findById(stock._id)).quantity,10);
});
test('técnico só atualiza suas ordens e não atribui outro técnico',async()=>{
  const unassigned=await ServiceOrder.create({companyId:a._id,clientId:client._id});
  assert.equal((await call('PATCH','/service-orders/'+unassigned._id,tech,{status:'concluida'})).status,404);
  assert.equal((await call('PATCH','/service-orders/'+order._id,tech,{technicianId:String(admin.user._id)})).status,403);
  assert.equal((await call('PATCH','/service-orders/'+order._id,tech,{status:'em_andamento'})).status,200);
  assert.equal((await call('DELETE','/service-orders/'+order._id,tech)).status,403);
});
test('upload rejeita SVG e arquivo falso antes de chamar provedor',async()=>{
  for(const [type,content] of [['image/svg+xml','<svg/>'],['image/png','not-an-image']]) {
    const form=new FormData();form.append('photo',new Blob([content],{type}),'image');
    assert.equal((await call('POST','/service-orders/'+order._id+'/photos',tech,form)).status,400);
  }
});
test('cabeçalhos impedem cache e origem não autorizada',async()=>{
  const r=await call('GET','/clients',admin);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(r.headers.get('content-security-policy').includes('https://res.cloudinary.com'));
  assert.equal((await call('POST','/auth/logout',null,undefined,{Origin:'https://evil.example'})).status,403);
  assert.equal((await call('GET','/clients',admin,undefined,{Origin:'http://localhost:5173'})).status,200);
});
test('criação de empresa falha sem deixar empresa órfã',async()=>{
  const before=await Company.countDocuments();
  assert.equal((await call('POST','/companies',superAdmin,{name:'Falha',email:admin.user.email})).status,409);
  assert.equal(await Company.countDocuments(),before);
  const r=await call('POST','/companies',superAdmin,{name:'Nova empresa',email:'new-admin@example.com'});assert.equal(r.status,201);assert.ok(r.data.tempPassword);assert.equal(r.data.adminUser.passwordHash,undefined);
});
test('limite de usuários vale também na reativação e impede bloquear o próprio admin',async()=>{
  await Company.updateOne({_id:a._id},{$set:{plan:'basic'}});
  try {
    assert.equal((await call('POST','/company-users',admin,{name:'Extra',email:'extra@example.com',role:'tecnico'})).status,403);
    assert.equal((await call('PATCH','/company-users/'+admin.user._id+'/active',admin,{active:false})).status,409);
    const inactive=await User.create({companyId:a._id,name:'Inativo',email:'inactive@example.com',passwordHash:admin.user.passwordHash||'unused',role:'tecnico',active:false});
    assert.equal((await call('PATCH','/company-users/'+inactive._id+'/active',admin,{active:true})).status,403);
  } finally {await Company.updateOne({_id:a._id},{$set:{plan:'pro'}});}
});
test('rota Android exige consentimento, mantém apenas última posição e isola empresas',async()=>{
  const token='b'.repeat(64),body={consent:true,deviceToken:token};
  assert.equal((await call('POST','/route-tracking/mine',tech,{...body,consent:false})).status,400);
  const started=await call('POST','/route-tracking/mine',tech,body);assert.equal(started.status,201);assert.equal(started.data.tokenHash,undefined);
  assert.equal((await call('POST','/route-tracking/mine',tech,body)).status,200);
  assert.equal((await call('POST','/route-tracking/mine',tech,{...body,deviceToken:'c'.repeat(64)})).status,409);
  assert.equal((await call('GET','/route-tracking',tech)).status,403);
  const pos={latitude:-8.05,longitude:-34.88,accuracy:10,capturedAt:new Date().toISOString()};
  assert.equal((await call('PUT','/route-tracking/device/position',{token:'not-used'},pos,{Authorization:'Route '+token})).status,204);
  const listed=await call('GET','/route-tracking',finance);assert.equal(listed.data.length,1);assert.equal(listed.data[0].position.latitude,pos.latitude);assert.equal(listed.data[0].tokenHash,undefined);
  assert.deepEqual((await call('GET','/route-tracking',other)).data,[]);
  for(const bad of [{latitude:91},{accuracy:-1},{capturedAt:new Date(Date.now()-180000).toISOString()}]) assert.equal((await call('PUT','/route-tracking/device/position',null,{...pos,...bad},{Authorization:'Route '+token})).status,400);
  assert.equal((await call('DELETE','/route-tracking/device',null,undefined,{Authorization:'Route '+token})).status,204);
  assert.equal((await call('PUT','/route-tracking/device/position',null,pos,{Authorization:'Route '+token})).status,410);
  assert.equal(await RouteSession.countDocuments(),0);
});
test('rota expirada não aparece mesmo antes da limpeza TTL',async()=>{
  await RouteSession.create({companyId:a._id,technicianId:tech.user._id,tokenHash:hashToken('d'.repeat(64)),startedAt:new Date(),consentAt:new Date(),expiresAt:new Date(Date.now()-1000)});
  assert.deepEqual((await call('GET','/route-tracking',admin)).data,[]);
  assert.equal((await call('GET','/route-tracking/mine',tech)).data,null);
  await RouteSession.deleteMany({});
});
test('desativar técnico revoga sessões e interrompe a rota imediatamente',async()=>{
  await call('POST','/route-tracking/mine',tech,{consent:true,deviceToken:'e'.repeat(64)});
  assert.equal((await call('PATCH','/company-users/'+tech.user._id+'/active',admin,{active:false})).status,200);
  assert.equal((await call('GET','/clients',tech)).status,401);assert.equal(await RouteSession.countDocuments({technicianId:tech.user._id}),0);
  assert.equal((await call('PATCH','/company-users/'+tech.user._id+'/active',admin,{active:true})).status,200);
  assert.equal((await call('GET','/clients',tech)).status,401);
});
test('estoque: CRUD e bloqueio de exclusão de material já consumido',async()=>{
  const r=await call('POST','/stock-items',admin,{name:'Conector',quantity:8,minQuantity:2,unit:'un'});assert.equal(r.status,201);
  assert.equal((await call('PATCH','/stock-items/'+r.data._id,other,{quantity:999})).status,404);
  assert.equal((await call('PATCH','/stock-items/'+r.data._id,admin,{quantity:-1})).status,400);
  assert.equal((await call('PATCH','/stock-items/'+r.data._id,admin,{quantity:6})).status,200);
  assert.equal((await call('DELETE','/stock-items/'+r.data._id,admin)).status,204);
  const used=await StockItem.findOne({name:'Cabo'});
  assert.equal((await call('DELETE','/stock-items/'+used._id,admin)).status,409);
});
test('exclusões preservam histórico de cliente, orçamento e materiais',async()=>{
  assert.equal((await call('DELETE','/clients/'+client._id,admin)).status,409);
  const converted=await Budget.findOne({convertedToServiceOrder:true});
  assert.equal((await call('DELETE','/budgets/'+converted._id,admin)).status,409);
  assert.equal((await call('DELETE','/service-orders/'+order._id,admin)).status,409);
});
test('plano Basic bloqueia recursos Pro na API',async()=>{
  await Company.updateOne({_id:a._id},{$set:{plan:'basic'}});
  try {
    assert.equal((await call('GET','/stock-items',admin)).status,403);
    assert.equal((await call('POST','/ai/ask',admin,{question:'Teste'})).status,403);
    assert.equal((await call('POST','/whatsapp/connect',admin)).status,403);
    assert.equal((await call('GET','/financial-entries',finance)).status,200);
  }finally{await Company.updateOne({_id:a._id},{$set:{plan:'pro'}});}
});
test('cadastro concorrente respeita último acesso disponível do plano',async()=>{
  const c=await Company.create({name:'Limite concorrente',plan:'basic'});
  const owner=await createUser(c,'admin','limit-admin@example.com');await createUser(c,'tecnico','limit-tech@example.com');
  const r=await Promise.all([call('POST','/company-users',owner,{name:'Pessoa 1',email:'limit-1@example.com',role:'tecnico'}),call('POST','/company-users',owner,{name:'Pessoa 2',email:'limit-2@example.com',role:'tecnico'})]);
  assert.deepEqual(r.map(x=>x.status).sort(),[201,403]);assert.equal(await User.countDocuments({companyId:c._id,active:true}),3);
});
test('lista de técnicos para financeiro não expõe e-mail nem hash de senha',async()=>{
  const r=await call('GET','/company-users/technicians',finance);assert.equal(r.status,200);
  for(const u of r.data){assert.equal(u.email,undefined);assert.equal(u.passwordHash,undefined);assert.ok(u.name);}
  assert.equal((await call('GET','/company-users',finance)).status,403);
});
test('JSON malformado e payload grande são rejeitados com código correto',async()=>{
  let r=await fetch(base+'/api/clients',{method:'POST',headers:{Authorization:'Bearer '+admin.token,'Content-Type':'application/json'},body:'{broken'});assert.equal(r.status,400);
  r=await call('POST','/clients',admin,{name:'x'.repeat(140000)});assert.equal(r.status,413);
});
test('nova posição não pode ser substituída por amostra atrasada',async()=>{
  const renewed=await sessionFor(tech.user),token='1'.repeat(64);
  await call('POST','/route-tracking/mine',renewed,{consent:true,deviceToken:token});
  const current=new Date(),pos={latitude:-8,longitude:-34,accuracy:5,capturedAt:current.toISOString()};
  assert.equal((await call('PUT','/route-tracking/device/position',null,pos,{Authorization:'Route '+token})).status,204);
  assert.equal((await call('PUT','/route-tracking/device/position',null,{...pos,latitude:-9,capturedAt:new Date(+current-1000).toISOString()},{Authorization:'Route '+token})).status,204);
  assert.equal((await call('GET','/route-tracking',admin)).data[0].position.latitude,-8);
  await call('DELETE','/route-tracking/mine',renewed);
});
test('suspensão revoga sessões e remove posições da empresa',async()=>{
  const c=await Company.create({name:'Suspender',plan:'pro'});const owner=await createUser(c,'admin','suspend-admin@example.com');const t=await createUser(c,'tecnico','suspend-tech@example.com');
  await call('POST','/route-tracking/mine',t,{consent:true,deviceToken:'2'.repeat(64)});
  assert.equal((await call('PATCH','/companies/'+c._id+'/suspend',superAdmin)).status,200);
  assert.equal((await call('GET','/clients',owner)).status,401);assert.equal(await RouteSession.countDocuments({companyId:c._id}),0);
  assert.equal((await call('POST','/auth/refresh',null,undefined,{Cookie:'refreshToken='+owner.refresh})).status,401);
});
test('excluir empresa exige confirmação e limpa os dados do tenant',async()=>{
  const c=await Company.create({name:'Excluir',plan:'pro'}),owner=await createUser(c,'admin','remove-admin@example.com');
  await Client.create({companyId:c._id,name:'Removível'});
  assert.equal((await call('DELETE','/companies/'+c._id,superAdmin,{})).status,400);
  assert.equal((await call('DELETE','/companies/'+c._id,superAdmin,{confirm:true})).status,204);
  assert.equal(await Client.countDocuments({companyId:c._id}),0);assert.equal(await User.countDocuments({companyId:c._id}),0);
  assert.equal((await call('GET','/clients',owner)).status,401);
});
test('logout por Bearer revoga sessão mesmo sem cookie no cliente Android',async()=>{
  const own=await sessionFor(admin.user);
  assert.equal((await call('POST','/auth/logout',own)).status,204);
  assert.equal((await call('GET','/clients',own)).status,401);
});
test('histórico e IA não expõem ordens de outro técnico por caminhos alternativos',async()=>{
  const actor=await sessionFor(tech.user);const history=await call('GET','/clients/'+client._id+'/history',actor);assert.equal(history.status,200);
  assert.ok(history.data.serviceOrders.every(s=>s.technicianId===String(tech.user._id)));
  const ai=require('../services/ai'),original=ai.summarizeClientHistory;let inspected;
  ai.summarizeClientHistory=async data=>{inspected=data;return 'Resumo de teste'};
  try{assert.equal((await call('POST','/ai/client-summary/'+client._id,actor)).status,200);assert.ok(inspected.serviceOrders.every(s=>String(s.technicianId)===String(tech.user._id)));}
  finally{ai.summarizeClientHistory=original;}
});
test('técnico consulta estoque, mas não altera saldo ou exclui itens arbitrariamente',async()=>{
  const actor=await sessionFor(tech.user);assert.equal((await call('GET','/stock-items',actor)).status,200);
  assert.equal((await call('POST','/stock-items',actor,{name:'Indevido',quantity:10})).status,403);
  const item=await StockItem.findOne({companyId:a._id});
  assert.equal((await call('PATCH','/stock-items/'+item._id,actor,{quantity:999})).status,403);
  assert.equal((await call('DELETE','/stock-items/'+item._id,actor)).status,403);
});
test('exclusão concorrente com consumo não apaga histórico nem perde saldo',async()=>{
  const o=await ServiceOrder.create({companyId:a._id,clientId:client._id});const stock=await StockItem.create({companyId:a._id,name:'Concorrente',quantity:1});
  const results=await Promise.all([call('DELETE','/service-orders/'+o._id,admin),call('POST','/service-orders/'+o._id+'/materials',admin,{stockItemId:String(stock._id),qty:1})]);
  if(results[0].status===204){assert.equal(results[1].status,404);assert.equal((await StockItem.findById(stock._id)).quantity,1);}
  else{assert.equal(results[0].status,409);assert.equal(results[1].status,201);assert.equal((await ServiceOrder.findById(o._id)).materialsUsed.length,1);}
});
test('cliente não fica órfão quando criação de orçamento disputa com exclusão',async()=>{
  const c=await Client.create({companyId:a._id,name:'Concorrente'});
  const results=await Promise.all([call('DELETE','/clients/'+c._id,admin),call('POST','/budgets',admin,{clientId:String(c._id),items:[]})]);
  if(results[0].status===204){assert.equal(results[1].status,400);assert.equal(await Budget.countDocuments({clientId:c._id}),0);}
  else{assert.equal(results[0].status,409);assert.equal(results[1].status,201);assert.ok(await Client.findById(c._id));}
});
test('conversão de orçamento não permite que técnico contorne permissão de criar OS',async()=>{
  const actor=await sessionFor(tech.user),budget=await Budget.create({companyId:a._id,clientId:client._id,status:'aprovado'});
  assert.equal((await call('POST','/budgets/'+budget._id+'/convert',actor)).status,403);
  assert.equal(await ServiceOrder.countDocuments({budgetId:budget._id}),0);
});
test('desativações concorrentes nunca deixam a empresa sem administrador',async()=>{
  const c=await Company.create({name:'Admin concorrente',plan:'pro'}),one=await createUser(c,'admin','race-admin-1@example.com'),two=await createUser(c,'admin','race-admin-2@example.com');
  const r=await Promise.all([call('PATCH','/company-users/'+two.user._id+'/active',one,{active:false}),call('PATCH','/company-users/'+one.user._id+'/active',two,{active:false})]);
  assert.ok(r.some(x=>x.status===200));assert.ok(r.some(x=>x.status===401||x.status===409));assert.equal(await User.countDocuments({companyId:c._id,active:true,role:'admin'}),1);
});

test('GPS recente não é substituído pela rede e posições incertas nunca sobrescrevem a boa',async()=>{
  const c=await Company.create({name:'Precisão de rota',plan:'pro'});
  const owner=await createUser(c,'admin','gps-admin@example.com');
  const technician=await createUser(c,'tecnico','gps-tech@example.com');
  const token='7'.repeat(64),headers={Authorization:'Route '+token};
  const start=await call('POST','/route-tracking/mine',technician,{consent:true,deviceToken:token});
  assert.equal(start.status,201);assert.equal(start.data.protocolVersion,2);
  const health=await call('GET','/route-tracking/device',null,undefined,headers);
  assert.equal(health.status,200);assert.equal(health.data.protocolVersion,2);assert.equal(health.data.position,undefined);
  const gps={latitude:-8.05,longitude:-34.88,accuracy:15,capturedAt:new Date(Date.now()-2000).toISOString(),provider:'gps'};
  assert.equal((await call('PUT','/route-tracking/device/position',null,gps,headers)).status,204);
  assert.equal((await call('PUT','/route-tracking/device/position',null,{...gps,accuracy:5},headers)).status,204);
  const network={...gps,latitude:-8.0493,accuracy:20,capturedAt:new Date().toISOString(),provider:'network'};
  assert.equal((await call('PUT','/route-tracking/device/position',null,network,headers)).status,204);
  for(const accuracy of [0,51,500]) assert.equal((await call('PUT','/route-tracking/device/position',null,{...network,accuracy},headers)).status,400);
  const listed=await call('GET','/route-tracking',owner);
  assert.equal(listed.data[0].position.latitude,gps.latitude);assert.equal(listed.data[0].position.accuracy,5);assert.equal(listed.data[0].position.provider,'gps');
  await call('DELETE','/route-tracking/mine',technician);
  assert.equal((await call('GET','/route-tracking/device',null,undefined,headers)).status,410);
});
test('rede com boa precisão pode recuperar posição quando o GPS anterior perdeu o sinal',async()=>{
  const c=await Company.create({name:'Recuperação de sinal',plan:'pro'});
  const technician=await createUser(c,'tecnico','gps-recovery@example.com');
  const token='8'.repeat(64),headers={Authorization:'Route '+token};
  await call('POST','/route-tracking/mine',technician,{consent:true,deviceToken:token});
  const gps={latitude:-8.05,longitude:-34.88,accuracy:10,capturedAt:new Date(Date.now()-15000).toISOString(),provider:'gps'};
  await call('PUT','/route-tracking/device/position',null,gps,headers);
  const network={...gps,latitude:-8.0499,accuracy:20,capturedAt:new Date().toISOString(),provider:'network'};
  assert.equal((await call('PUT','/route-tracking/device/position',null,network,headers)).status,204);
  const mine=await call('GET','/route-tracking/mine',technician);assert.equal(mine.data.position.latitude,network.latitude);
  await call('DELETE','/route-tracking/mine',technician);
});
