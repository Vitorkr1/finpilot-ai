const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const sockets=[];let failVersion=false;let plan='pro';let savedError=false;let received=0;
function fakeModule(path,exports){const id=require.resolve(path);require.cache[id]={id,filename:id,loaded:true,exports};}
fakeModule('@whiskeysockets/baileys',{
  DisconnectReason:{loggedOut:401},makeCacheableSignalKeyStore:x=>x,
  fetchLatestBaileysVersion:async()=>{if(failVersion)throw new Error('simulated-upstream');return {version:[1,2,3]}},
  makeWASocket:()=>{const ev=new EventEmitter();const sock={ev,logout:async()=>ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:500}}}})};sockets.push(sock);return sock;},
});
fakeModule('../services/whatsappAuthState',{
  useMongoAuthState:async()=>({state:{creds:{},keys:{}},saveCreds:async()=>{if(savedError)throw new Error('simulated-save')},clearAll:async()=>{}}),clearAuthState:async()=>{},
});
const Company=require('../models/Company');Company.findById=async()=>({plan,subscriptionStatus:'active'});
const Message=require('../models/WhatsAppMessage');Message.create=async()=>{received++;return {save:async()=>{}}};
const service=require('../services/whatsapp');
const flush=async()=>{await new Promise(setImmediate);await new Promise(setImmediate)};
test('WhatsApp reutiliza conexão e QR em vez de abrir sessões duplicadas',async()=>{
  const before=sockets.length;assert.equal((await service.connect('reuse')).status,'connecting');await service.connect('reuse');assert.equal(sockets.length,before+1);
  sockets.at(-1).ev.emit('connection.update',{qr:'test-only-qr'});await flush();
  for(let i=0;i<10&&service.getStatus('reuse').status!=='qr';i++)await flush();
  assert.equal(service.getStatus('reuse').status,'qr');await service.connect('reuse');assert.equal(sockets.length,before+1);await service.disconnect('reuse');
});
test('falha de inicialização não deixa estado preso em conectando',async()=>{
  failVersion=true;await assert.rejects(service.connect('failure'));assert.equal(service.getStatus('failure').status,'disconnected');
  failVersion=false;assert.equal((await service.connect('failure')).status,'connecting');await service.disconnect('failure');
});
test('desconexão cancela reconexão já agendada e não revive a sessão',async()=>{
  await service.connect('stop');const originalSet=global.setTimeout,originalClear=global.clearTimeout;let callback,cleared=false;
  global.setTimeout=fn=>{callback=fn;return {fake:true}};global.clearTimeout=()=>{cleared=true};
  try {
    sockets.at(-1).ev.emit('connection.update',{connection:'close',lastDisconnect:{error:{output:{statusCode:500}}}});await flush();assert.equal(typeof callback,'function');
    await service.disconnect('stop');assert.equal(cleared,true);const count=sockets.length;callback();await flush();assert.equal(sockets.length,count);assert.equal(service.getStatus('stop').status,'disconnected');
  } finally {global.setTimeout=originalSet;global.clearTimeout=originalClear;}
});
test('falha ao salvar credenciais é tratada sem rejeição não capturada',async()=>{
  let unhandled=false;const listener=()=>{unhandled=true};process.on('unhandledRejection',listener);
  try {await service.connect('creds');savedError=true;sockets.at(-1).ev.emit('creds.update',{});await flush();assert.equal(unhandled,false);}
  finally{savedError=false;process.off('unhandledRejection',listener);await service.disconnect('creds');}
});
test('mensagens de empresa sem plano Pro não são processadas',async()=>{
  await service.connect('plan');plan='basic';const before=received;
  sockets.at(-1).ev.emit('messages.upsert',{type:'notify',messages:[{key:{fromMe:false,remoteJid:'test'},message:{conversation:'Teste'}}]});await flush();
  assert.equal(received,before);assert.equal(service.getStatus('plan').status,'disconnected');plan='pro';
});
test('requisições concorrentes de conexão reservam uma única sessão',async()=>{
  const before=sockets.length;await Promise.all([service.connect('parallel'),service.connect('parallel')]);assert.equal(sockets.length,before+1);await service.disconnect('parallel');
});
