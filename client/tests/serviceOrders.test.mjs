import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
const source = await readFile(new URL('../src/lib/serviceOrders.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { toLocalDateTime, toIsoDateTime, formatDateTime, serviceOrderCsvRows } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('atendimento mantém o instante e os milissegundos ao abrir e salvar em fusos diferentes', () => {
  const previous = process.env.TZ
  try {
    for (const zone of ['America/Recife', 'UTC', 'Asia/Tokyo', 'America/New_York']) {
      process.env.TZ = zone
      for (const iso of ['2026-11-03T02:15:32.123Z', '2026-06-01T14:30:00.000Z']) {
        assert.equal(toIsoDateTime(toLocalDateTime(iso), iso), iso)
        assert.equal(toIsoDateTime(toLocalDateTime(iso)), iso.replace('.123Z', '.000Z'))
      }
    }
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
test('horários exibidos e editados seguem o dispositivo sem deslocar o dia do chamado', () => {
  const previous = process.env.TZ
  try {
    process.env.TZ = 'America/Recife'
    assert.equal(toLocalDateTime('2026-11-03T02:15:00Z'), '2026-11-02T23:15:00')
    assert.equal(toIsoDateTime('2026-11-02T23:15:00'), '2026-11-03T02:15:00.000Z')
    assert.match(formatDateTime('2026-11-03T02:15:00Z'), /02\/11\/2026.*23:15/)
    assert.equal(toIsoDateTime(''), null)
    assert.equal(formatDateTime(null), 'Não informado')
    for (const value of ['not-a-date', '2026-02-30T10:00:00']) assert.throws(() => toIsoDateTime(value))
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
})
test('exportação inclui chamado, execução e pendências, com fallback para OS antiga', () => {
  const legacy = { _id: 'old', clientId: 'client', technicianId: null, status: 'aberta', createdAt: '2026-11-02T12:00:00Z', laborHours: 0 }
  const updated = { ...legacy, _id: 'new', technicianId: 'tech', calledAt: '2026-11-01T12:00:00Z', requestDescription: 'Ar sem gelar', startedAt: '2026-11-02T12:00:00Z', finishedAt: '2026-11-02T13:00:00Z', serviceDescription: 'Feita inspeção', hasPending: true, pendingReason: 'material', pendingNotes: 'Falta sensor' }
  const rows = serviceOrderCsvRows([legacy, updated], [{ _id: 'client', name: 'Cliente A' }], [{ _id: 'tech', name: 'Técnico A' }])
  assert.equal(rows.length, 3); assert.equal(rows[0].length, 13)
  assert.equal(rows[1][4], formatDateTime(legacy.createdAt)); assert.equal(rows[1][6], 'Não informado')
  assert.equal(rows[2][2], 'Técnico A'); assert.equal(rows[2][4], formatDateTime(updated.calledAt))
  assert.deepEqual(rows[2].slice(8, 12), ['Feita inspeção', 'Em aberto', 'Falta de material', 'Falta sensor'])
  assert.equal(serviceOrderCsvRows([{ ...updated, hasPending: false }], [], [])[1][9], 'Resolvida')
})
