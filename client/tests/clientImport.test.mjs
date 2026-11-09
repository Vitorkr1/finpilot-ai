import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
function compile(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText }
const helpers = compile(await readFile(new URL('../src/lib/clientImport.ts', import.meta.url), 'utf8'))
const helperUrl = `data:text/javascript;base64,${Buffer.from(helpers).toString('base64')}`
const { guessMapping, mappedRows, mappingError, checkXlsxArchive } = await import(helperUrl)
const parser = compile(await readFile(new URL('../src/lib/readClientFile.ts', import.meta.url), 'utf8')).replace(/from (['"])([^'"]+)\1/g, (_all, _quote, name) => `from ${JSON.stringify(name === './clientImport' ? helperUrl : import.meta.resolve(name))}`)
const { parseClientCsv, readClientFile } = await import(`data:text/javascript;base64,${Buffer.from(parser).toString('base64')}`)
const arrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
const fixture = await readFile(new URL('fixtures/clientes-importacao.xlsx', import.meta.url))

test('CSV preserva zeros, acentos, aspas e separadores dentro do endereço', () => {
  const sheet = parseClientCsv('\uFEFFNome;Telefone;CPF/CNPJ;Endereço;Observações\r\nAna;000123;012.345.678-90;"Rua A; 10";"Disse ""olá""\nsegunda linha"')
  const rows = mappedRows(sheet, guessMapping(sheet.headers))
  assert.equal(rows[0].data.phone, '000123'); assert.equal(rows[0].data.document, '012.345.678-90')
  assert.equal(rows[0].data.address, 'Rua A; 10'); assert.equal(rows[0].data.notes, 'Disse "olá"\nsegunda linha')
})
test('CSV aceita vírgula, tabulação, cabeçalho isolado e aliases sem ambiguidade', () => {
  for (const delimiter of [',', '\t']) {
    const sheet = parseClientCsv(['Razão social', 'Celular', 'E-mail'].join(delimiter) + '\n' + ['Empresa', '00123', 'a@example.com'].join(delimiter))
    const mapping = guessMapping(sheet.headers); assert.equal(mapping.name, 0); assert.equal(mapping.phone, 1); assert.equal(mapping.email, 2)
  }
  assert.equal(parseClientCsv('Nome\nAna').rows.length, 1)
  assert.throws(() => parseClientCsv('Nome;Telefone'), /não tem clientes/)
})
test('mapeamento exige nome e impede usar a mesma coluna em dois campos', () => {
  const mapping = guessMapping(['Nome', 'Telefone'])
  assert.equal(mappingError(mapping), null)
  assert.match(mappingError({ ...mapping, name: -1 }), /nome/)
  assert.match(mappingError({ ...mapping, email: mapping.phone }), /diferente/)
})
test('Excel real lê a aba de clientes, ignora instrução vazia e preserva documentos em texto', async () => {
  const sheets = await readClientFile('clientes.xlsx', arrayBuffer(fixture))
  assert.equal(sheets.length, 1); assert.equal(sheets[0].name, 'Clientes'); assert.equal(sheets[0].rows.length, 4)
  const rows = mappedRows(sheets[0], guessMapping(sheets[0].headers))
  assert.equal(rows[0].data.document, '012.345.678-90'); assert.equal(rows[1].data.phone, '000123456')
})
test('leitura suporta CSV do Excel em UTF-16 e Windows-1252', async () => {
  for (const bytes of [Buffer.concat([Buffer.from([255, 254]), Buffer.from('Nome;Endereço\r\nJoão;Praça', 'utf16le')]), Buffer.from('Nome;Endereço\r\nJoão;Praça', 'latin1')]) {
    const [sheet] = await readClientFile('clientes.csv', arrayBuffer(bytes)); assert.equal(sheet.rows[0].cells[0], 'João')
  }
})
test('limite de mil clientes e arquivos inválidos geram mensagens recuperáveis', async () => {
  assert.equal(parseClientCsv('Nome\n' + Array.from({ length: 1000 }, (_, i) => `Cliente ${i}`).join('\n')).rows.length, 1000)
  assert.throws(() => parseClientCsv('Nome\n' + 'Ana\n'.repeat(1001)), /1.000/)
  assert.throws(() => parseClientCsv('Nome;Notas\nAna;"aspas sem fim'), /aspas/)
  await assert.rejects(() => readClientFile('arquivo.xls', new ArrayBuffer(100)), /\.xlsx/)
  await assert.rejects(() => readClientFile('arquivo.xlsx', new ArrayBuffer(100)), /válid/)
  await assert.rejects(() => readClientFile('arquivo.csv', new ArrayBuffer(3 * 1024 * 1024 + 1)), /3 MB/)
})
test('estrutura ZIP excessiva ou criptografada é recusada antes da leitura do Excel', () => {
  const bytes = Buffer.from(fixture), position = bytes.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))
  bytes.writeUInt32LE(17 * 1024 * 1024, position + 24)
  assert.throws(() => checkXlsxArchive(arrayBuffer(bytes)), /grande demais/)
  const encrypted = Buffer.from(fixture); encrypted.writeUInt16LE(1, position + 8)
  assert.throws(() => checkXlsxArchive(arrayBuffer(encrypted)), /criptografadas/)
})
