import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../../android/app/src/main/assets/downloads.js', import.meta.url), 'utf8')
function page({ bridge = true, blob = new Blob(['%PDF-1.7\ncontent'], { type: 'application/pdf' }) } = {}) {
  const handlers = [], messages = [], alerts = []
  const native = { postMessage: (value) => messages.push(JSON.parse(value)) }
  const window = { location: { origin: 'https://empresa.example' }, ...(bridge ? { CriaOSFiles: native } : {}) }
  class FileReader {
    readAsDataURL(value) {
      value.arrayBuffer().then((bytes) => { this.result = `data:${value.type};base64,${Buffer.from(bytes).toString('base64')}`; this.onload() })
    }
  }
  const context = vm.createContext({ window, document: { addEventListener: (...args) => handlers.push(args) }, alert: (message) => alerts.push(message), FileReader, fetch: async () => ({ blob: async () => blob }) })
  vm.runInContext(source, context)
  return { context, handlers, messages, alerts, native, async click(href = 'blob:https://empresa.example/id', name = 'orcamento.pdf') {
    let prevented = false
    await handlers[0]?.[1]({ target: { closest: () => href ? { href, download: name } : null }, preventDefault: () => { prevented = true } })
    return prevented
  } }
}
test('PDF gerado no sistema chega ao seletor nativo com nome e conteúdo', async () => {
  const p = page()
  assert.equal(await p.click(), true)
  assert.equal(p.messages.length, 1)
  assert.equal(p.messages[0].type, 'save-file')
  assert.equal(p.messages[0].name, 'orcamento.pdf')
  assert.match(p.messages[0].data, /^data:application\/pdf;base64,JVBERi0/)
})
test('CSV com caracteres brasileiros mantém conteúdo na transferência', async () => {
  const p = page({ blob: new Blob(['\uFEFFNome;Valor\r\nJoão;10'], { type: 'text/csv;charset=utf-8;' }) })
  await p.click(undefined, 'financeiro.csv')
  const data = p.messages[0].data.split(',')[1]
  assert.equal(Buffer.from(data, 'base64').toString('utf8'), '\uFEFFNome;Valor\r\nJoão;10')
})
test('links comuns e arquivos de outra origem não usam a integração nativa', async () => {
  const p = page()
  for (const href of ['https://empresa.example/rotas', 'blob:https://outra.example/id', 'blob:https://empresa.example.evil.test/id', null]) assert.equal(await p.click(href), false)
  assert.equal(p.messages.length, 0)
})
test('salvamentos concorrentes aguardam o retorno do seletor nativo', async () => {
  const p = page()
  await p.click(); await p.click()
  assert.equal(p.messages.length, 1)
  p.native.onmessage({ data: '{}' })
  await p.click()
  assert.equal(p.messages.length, 2)
})
test('arquivos maiores que o limite não são transferidos para o Android', async () => {
  const p = page({ blob: { size: 16 * 1024 * 1024 + 1 } })
  await p.click()
  assert.equal(p.messages.length, 0)
  assert.match(p.alerts[0], /16 MB/)
})
test('reinjeção não duplica downloads e navegador comum mantém comportamento padrão', () => {
  const p = page()
  vm.runInContext(source, p.context)
  assert.equal(p.handlers.length, 1)
  assert.equal(page({ bridge: false }).handlers.length, 0)
})
