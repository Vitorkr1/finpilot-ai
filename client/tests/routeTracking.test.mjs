import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/lib/routeTracking.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}})
const {positionStatus}=await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const now=Date.now()
test('sem amostra a interface informa que aguarda GPS',()=>assert.equal(positionStatus(null,now).tone,'waiting'))
test('amostra antiga nunca aparece como recente',()=>assert.equal(positionStatus({capturedAt:new Date(now-120001).toISOString(),accuracy:5},now).tone,'stale'))
test('precisão reduzida é informada mesmo com amostra nova',()=>assert.equal(positionStatus({capturedAt:new Date(now).toISOString(),accuracy:500},now).tone,'waiting'))
test('posição recente com boa precisão recebe estado correto',()=>assert.equal(positionStatus({capturedAt:new Date(now-15000).toISOString(),accuracy:10},now).tone,'recent'))
