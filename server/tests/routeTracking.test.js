const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePosition } = require('../services/routeTracking');
const now=new Date('2026-11-03T19:00:00.000Z');
const position={latitude:-8.05,longitude:-34.88,accuracy:10,capturedAt:now.toISOString(),provider:'gps'};
test('posições imprecisas não entram no banco mesmo com coordenadas válidas',()=>{
  for(const accuracy of [0,-1,50.001,500,NaN,Infinity]) assert.equal(parsePosition({...position,accuracy},now),null);
  assert.ok(parsePosition({...position,accuracy:50},now));
});
test('posição deve ter no máximo 30 segundos e relógio futuro tem tolerância limitada',()=>{
  assert.ok(parsePosition({...position,capturedAt:new Date(+now-30000).toISOString()},now));
  assert.equal(parsePosition({...position,capturedAt:new Date(+now-30001).toISOString()},now),null);
  assert.ok(parsePosition({...position,capturedAt:new Date(+now+5000).toISOString()},now));
  assert.equal(parsePosition({...position,capturedAt:new Date(+now+5001).toISOString()},now),null);
});
test('provedor é validado e aparelhos anteriores continuam compatíveis',()=>{
  assert.equal(parsePosition({...position,provider:'gps'},now).provider,'gps');
  assert.equal(parsePosition({...position,provider:'network'},now).provider,'network');
  assert.equal(parsePosition({...position,provider:'ip'},now),null);
  const {provider,...legacy}=position;
  assert.ok(parsePosition(legacy,now));
});
