import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../src/lib/api.ts',import.meta.url),'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace("from 'axios'",`from '${import.meta.resolve('axios')}'`)
const {api,adminApi,setAccessToken,setAdminAccessToken}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
globalThis.window=new EventTarget()
const response=(config,data={})=>({config,data,status:200,statusText:'OK',headers:{}})
const unauthorized=(config)=>Promise.reject(Object.assign(new Error('Unauthorized'),{config,response:{config,status:401,data:{error:'Unauthorized'},headers:{}}}))
const flush=()=>new Promise(setImmediate)
test('requisições concorrentes compartilham um refresh sem repetir login',async()=>{
  setAccessToken('old');let refreshed=0
  api.defaults.adapter=async config=>{
    if(config.url==='/auth/refresh'){refreshed++;await flush();return response(config,{accessToken:'fresh'})}
    return config.headers.Authorization==='Bearer fresh'?response(config,{ok:true}):unauthorized(config)
  }
  const r=await Promise.all([api.get('/clients'),api.get('/budgets')]);assert.equal(refreshed,1);assert.ok(r.every(x=>x.data.ok))
})
test('falha de refresh encerra a sessão da interface',async()=>{
  setAccessToken('expired');let events=0;const listener=()=>events++;window.addEventListener('criaos:tenant-session-ended',listener)
  try{api.defaults.adapter=unauthorized;await assert.rejects(api.get('/clients'));assert.equal(events,1)}
  finally{window.removeEventListener('criaos:tenant-session-ended',listener)}
})
test('refresh atrasado não restaura sessão depois de novo login',async()=>{
  setAccessToken('old-user');let release;const waiting=new Promise(resolve=>release=resolve)
  api.defaults.adapter=async config=>{if(config.url==='/auth/refresh'){await waiting;return response(config,{accessToken:'old-user-refreshed'})}return unauthorized(config)}
  const request=api.get('/clients');await flush();setAccessToken('new-user');release();await assert.rejects(request)
  api.defaults.adapter=async config=>{assert.equal(config.headers.Authorization,'Bearer new-user');return response(config)}
  await api.get('/clients')
})
test('super admin e tenant usam tokens e refresh separados',async()=>{
  setAccessToken('tenant-user');setAdminAccessToken('admin-old');let refreshPath
  adminApi.defaults.adapter=async config=>{if(config.url.startsWith('/auth/')){refreshPath=config.url;return response(config,{accessToken:'admin-new'})}return config.headers.Authorization==='Bearer admin-new'?response(config):unauthorized(config)}
  await adminApi.get('/companies');assert.equal(refreshPath,'/auth/admin-refresh')
  api.defaults.adapter=async config=>{assert.equal(config.headers.Authorization,'Bearer tenant-user');return response(config)};await api.get('/clients')
})
test('erro de login não inicia ciclo de refresh',async()=>{
  let count=0;api.defaults.adapter=config=>{count++;return unauthorized(config)}
  await assert.rejects(api.post('/auth/login',{email:'test@example.com',password:'wrong'}));assert.equal(count,1)
})
