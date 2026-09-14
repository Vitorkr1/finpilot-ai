const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateBudgetPdf } = require('../services/pdf');
const { inflateSync } = require('node:zlib');
const base = { _id: '68c67f9e3a129d42e6500012', createdAt: '2026-09-15T01:00:00.000Z', status: 'enviado' };
async function render(items, extra = {}) {
  return generateBudgetPdf({ budget: { ...base, items, total: items.reduce((s, i) => s + i.qty * i.unitPrice, 0), ...extra }, company: { name: 'Empresa de teste' }, client: { name: 'Cliente de teste' } });
}
const pages = pdf => (pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
// Inspect PDFKit's Flate-compressed text operands, without a new production dependency.
function textOf(pdf) {
  return [...pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => {
    const stream = inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
    return [...stream.matchAll(/<([0-9a-f]+)>/gi)].map(token => new TextDecoder('windows-1252').decode(Buffer.from(token[1], 'hex'))).join('');
  }).join('\n');
}
test('short budget stays on A4, preserves BRL values and uses Brazilian issue date', async () => {
  const pdf = await render([{ description: 'Instalação técnica', qty: 2, unitPrice: 1234.5 }]);
  assert.ok(pdf.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.equal(pages(pdf), 1);
  assert.match(pdf.toString('latin1'), /\/MediaBox \[0 0 595\.28 841\.89\]/);
  const text = textOf(pdf);
  for (const value of ['Instalação técnica', 'R$ 1.234,50', 'R$ 2.469,00', '14/09/2026', 'Página 1 de 1']) assert.ok(text.includes(value), value);
});
test('multi-page budget repeats table headers and emits a single total', async () => {
  const pdf = await render(Array.from({length:60}, (_, i) => ({ description: `Serviço ${String(i+1).padStart(3,'0')}`, qty:1, unitPrice:100 })));
  const count = pages(pdf), text = textOf(pdf);
  assert.ok(count > 1);
  assert.equal((text.match(/VALOR TOTAL DO ORÇAMENTO/g) || []).length, 1);
  assert.ok((text.match(/DESCRIÇÃO DO SERVIÇO/g) || []).length >= count - 1);
  for (let i=1;i<=60;i++) assert.ok(text.includes(`Serviço ${String(i).padStart(3,'0')}`));
  for (let i=1;i<=count;i++) assert.ok(text.includes(`Página ${i} de ${count}`));
});
test('description taller than a page retains its ending and following item', async () => {
  const pdf = await render([{description: 'Texto longo de instalação. '.repeat(400) + 'MARCADORFINAL', qty:1, unitPrice:100}, {description:'ITEMSEGUINTE',qty:1,unitPrice:50}]);
  const text = textOf(pdf);
  assert.ok(pages(pdf)>1);
  assert.ok(text.includes('MARCADORFINAL'));
  assert.ok(text.includes('ITEMSEGUINTE'));
  assert.ok(text.includes('(continuação)'));
});
test('empty budget and missing optional details remain readable', async () => {
  const pdf = await generateBudgetPdf({ budget: { ...base, items:[], total:0, createdAt:null } });
  const text = textOf(pdf);
  assert.equal(pages(pdf),1);
  assert.ok(text.includes('Cliente não informado'));
  assert.ok(text.includes('Nenhum serviço adicionado'));
  assert.ok(text.includes('R$ 0,00'));
  assert.ok(!text.includes('Invalid Date'));
});
test('large fractional quantities remain intact', async () => {
  const text = textOf(await render([{ description:'Serviço',qty:12345.6789,unitPrice:9876543.21 }]));
  assert.ok(text.includes('12.345,6789'));
  assert.ok(text.includes('R$ 121.932.631.112,64'));
});
