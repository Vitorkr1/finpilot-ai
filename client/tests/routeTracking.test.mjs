import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/lib/routeTracking.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}})
const {positionStatus,canPlotPosition}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const now=Date.now()
const point=(overrides={})=>({latitude:-8.05,longitude:-34.88,accuracy:10,capturedAt:new Date(now).toISOString(),receivedAt:new Date(now).toISOString(),...overrides})
test('sem amostra a interface informa que aguarda GPS',()=>assert.equal(positionStatus(null,now).tone,'waiting'))
test('amostra com mais de 30 segundos deixa de parecer atual',()=>assert.equal(positionStatus(point({capturedAt:new Date(now-30001).toISOString()}),now).tone,'stale'))
test('precisão reduzida é informada mesmo com amostra nova',()=>assert.equal(positionStatus(point({accuracy:500}),now).tone,'waiting'))
test('posição recente com boa precisão recebe estado correto',()=>assert.equal(positionStatus(point({capturedAt:new Date(now-15000).toISOString()}),now).tone,'recent'))
test('ponto impreciso não vira marcador no mapa',()=>{
  for(const accuracy of [0,-1,50.1,500,NaN,Infinity]) assert.equal(canPlotPosition(point({accuracy}),now),false)
  assert.equal(canPlotPosition(point({accuracy:50}),now),true)
  assert.equal(positionStatus(point({accuracy:35}),now).tone,'limited')
})
test('coordenadas e horário inválidos são bloqueados na exibição',()=>{
  for(const p of [point({latitude:91}),point({longitude:-181}),point({latitude:NaN}),point({capturedAt:'invalid'}),point({capturedAt:new Date(now+5001).toISOString()})]) assert.equal(canPlotPosition(p,now),false)
})
test('último GPS bom fica identificado como anterior quando a conexão cai',()=>{
  const p=point({capturedAt:new Date(now-120000).toISOString()})
  assert.equal(canPlotPosition(p,now),true)
  assert.equal(positionStatus(p,now).tone,'stale')
})
