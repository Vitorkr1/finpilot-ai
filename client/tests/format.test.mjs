import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(
  new URL('../src/lib/format.ts', import.meta.url),
  'utf8',
)
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
})
const { csvContent, formatDate, localDateISO, isOverdue } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
)
test('calendar dates preserve the stored day rather than shifting to the previous day', () => {
  assert.equal(formatDate('2026-09-14T00:00:00.000Z'), '14/09/2026')
  assert.equal(formatDate('2026-01-02'), '02/01/2026')
})
test('agenda uses the local calendar date, including late evenings', () => {
  assert.equal(localDateISO(new Date(2026, 8, 14, 23, 59)), '2026-09-14')
})
test('overdue excludes today and future dates', () => {
  assert.equal(isOverdue(localDateISO()), false)
  assert.equal(isOverdue('2099-01-01'), false)
  assert.equal(isOverdue('2000-01-01T00:00:00.000Z'), true)
})
test('CSV keeps accents, separators, quotes and newlines in valid quoted cells', () => {
  assert.equal(
    csvContent([
      ['Descrição', 'Valor'],
      ['Serviço; "A"\nVisita', '1,50'],
    ]),
    '\uFEFF"Descrição";"Valor"\r\n"Serviço; ""A""\nVisita";"1,50"',
  )
})
test('CSV neutralizes formula-like user content including leading whitespace', () => {
  const csv = csvContent([
    ['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '\t=1+1', '  =1+1', 'Normal'],
  ])
  for (const value of [
    '=1+1',
    '+SUM(A1)',
    '-1+1',
    '@SUM(A1)',
    '\t=1+1',
    '  =1+1',
  ])
    assert.ok(csv.includes(`"'${value}"`))
  assert.ok(csv.endsWith(';"Normal"'))
})
