const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeRows, validateRows } = require('../services/clientImport');
const row = (data, n = 2) => ({ row: n, data });
test('importação identifica documento formatado e repetição com acentos e espaços', () => {
  const result = analyzeRows([row({ name: 'Outra pessoa', document: '01234567890' }), row({ name: ' JOAO  silva ', phone: '81900000000' }, 3)], [{ name: 'João Silva', phone: '(81) 90000-0000', document: '012.345.678-90' }]);
  assert.equal(result.report.duplicates, 2); assert.equal(result.clients.length, 0);
});
test('documentos diferentes distinguem homônimos e os dados originais não são alterados', () => {
  const existing = [{ name: 'Ana', document: '123', phone: '999', notes: 'Preservar' }];
  const result = analyzeRows([row({ name: 'Ana', document: '456', phone: '999', notes: 'Novo' })], existing);
  assert.equal(result.clients.length, 1); assert.equal(existing[0].notes, 'Preservar');
});
test('linhas inválidas não impedem clientes válidos nem entram no índice de duplicados', () => {
  const result = analyzeRows([row({ name: '', document: '123' }), row({ name: 'Ana', document: '123', email: ' ANA@EXAMPLE.COM ' }, 3), row({ name: 'Ana', document: '123' }, 4)], []);
  assert.equal(result.report.invalid, 1); assert.equal(result.report.ready, 1); assert.equal(result.report.duplicates, 1); assert.equal(result.clients[0].email, 'ana@example.com');
});
test('importação rejeita operadores, campos de tenant e tipos inesperados', () => {
  const result = analyzeRows([row({ name: { $ne: null } }), row({ name: 'Ana', companyId: 'forged' }, 3), row({ name: 'Bruno', notes: 'x'.repeat(4001) }, 4)], []);
  assert.equal(result.report.invalid, 3); assert.equal(result.clients.length, 0);
});
test('repetições por e-mail e por nome/endereço são ignoradas sem fundir clientes', () => {
  const result = analyzeRows([row({ name: 'Ana', email: 'a@example.com' }), row({ name: 'ANA', email: 'A@example.com' }, 3), row({ name: 'Bruno', address: 'Rua A' }, 4), row({ name: 'Bruno', address: 'Rua B' }, 5)], []);
  assert.equal(result.report.ready, 3); assert.equal(result.report.duplicates, 1);
});
test('lotes vazios, números de linha repetidos e excesso de linhas são recusados', () => {
  assert.throws(() => validateRows([]));
  assert.throws(() => validateRows([row({ name: 'A' }), row({ name: 'B' })]), /diferentes/);
  assert.throws(() => validateRows(Array.from({ length: 1001 }, (_, i) => row({ name: 'A' }, i + 1))));
});
test('e-mail identifica cadastro sem telefone na nova linha e o código +55 é normalizado', () => {
  const existing = [{ name: 'Ana', phone: '(81) 90000-0001', email: 'a@example.com' }];
  const result = analyzeRows([row({ name: 'Ana', email: 'a@example.com' }), row({ name: 'Ana', phone: '+55 81 90000-0001' }, 3)], existing);
  assert.equal(result.report.duplicates, 2);
});
