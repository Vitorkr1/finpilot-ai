import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { downloadCsv } from '../lib/format'
import { IMPORT_FIELDS, MAX_IMPORT_FILE_BYTES, guessMapping, mappedRows, mappingError, type ImportSheet, type Mapping, type ImportReport } from '../lib/clientImport'
import './client-import.css'

const statusLabel = { ready: 'Pronto', duplicate: 'Já cadastrado', invalid: 'Corrigir', imported: 'Importado' }
const message = (error: unknown) => (error as { response?: { data?: { error?: string } } })?.response?.data?.error || (error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.')

export function ClientImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const worker = useRef<Worker | null>(null)
  const timeout = useRef<number | undefined>(undefined)
  const sequence = useRef(0)
  const busy = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const requestId = useRef('')
  const [sheets, setSheets] = useState<ImportSheet[]>([])
  const [sheetIndex, setSheetIndex] = useState(0)
  const [mapping, setMapping] = useState<Mapping>(guessMapping([]))
  const [filename, setFilename] = useState('')
  const [reading, setReading] = useState(false)
  const [working, setWorking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ImportReport | null>(null)
  const sheet = sheets[sheetIndex]
  const rows = sheet ? mappedRows(sheet, mapping) : []
  const finished = report?.imported !== undefined
  const mapError = mappingError(mapping)
  const unused = sheet?.headers.filter((_, index) => !Object.values(mapping).includes(index)) || []

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => { sequence.current++; worker.current?.terminate(); clearTimeout(timeout.current); abort.current?.abort(); element?.close() }
  }, [])

  function resetPreview() { setReport(null); setError(''); setConfirmed(false); requestId.current = '' }
  function chooseSheet(index: number) { setSheetIndex(index); setMapping(guessMapping(sheets[index].headers)); resetPreview() }
  async function chooseFile(file?: File) {
    if (!file || busy.current || saving) return
    const current = ++sequence.current
    worker.current?.terminate(); clearTimeout(timeout.current)
    resetPreview(); setSheets([]); setFilename(file.name)
    if (!/\.(xlsx|csv)$/i.test(file.name)) { setError('Escolha Excel .xlsx ou CSV. Converta arquivos .xls para .xlsx no Excel.'); return }
    if (!file.size || file.size > MAX_IMPORT_FILE_BYTES) { setError('Escolha um arquivo de até 3 MB.'); return }
    setReading(true)
    try {
      const buffer = await file.arrayBuffer()
      if (current !== sequence.current) return
      const parser = new Worker(new URL('../workers/clientImport.worker.ts', import.meta.url), { type: 'module' })
      worker.current = parser
      const fail = (text: string) => { if (current !== sequence.current) return; parser.terminate(); clearTimeout(timeout.current); setReading(false); setError(text) }
      timeout.current = window.setTimeout(() => fail('A leitura demorou demais. Tente dividir a planilha em arquivos menores.'), 15000)
      parser.onerror = () => fail('Não foi possível ler o arquivo. Confira se ele abre no Excel e tente salvar novamente.')
      parser.onmessage = (event: MessageEvent<{ sheets?: ImportSheet[]; error?: string }>) => {
        if (current !== sequence.current) return
        if (event.data.error) { fail(event.data.error); return }
        const parsed = event.data.sheets || []
        if (!parsed.length) { fail('O arquivo não contém clientes.'); return }
        clearTimeout(timeout.current); parser.terminate(); setReading(false); setSheets(parsed)
        const best = Math.max(0, parsed.findIndex(item => guessMapping(item.headers).name >= 0))
        setSheetIndex(best); setMapping(guessMapping(parsed[best].headers))
      }
      parser.postMessage({ name: file.name, buffer }, [buffer])
    } catch (err) { if (current === sequence.current) { setReading(false); setError(message(err)) } }
  }
  async function preview() {
    if (busy.current || mapError || !rows.length) return
    busy.current = true; setWorking(true); setError(''); setConfirmed(false)
    const current = sequence.current, controller = new AbortController()
    abort.current = controller
    try {
      const { data } = await api.post<ImportReport>('/clients/import/preview', { rows }, { signal: controller.signal })
      if (current !== sequence.current) return
      setReport(data); requestId.current = crypto.randomUUID()
    } catch (err) { if (current === sequence.current) setError(message(err)) }
    finally { busy.current = false; if (current === sequence.current) setWorking(false) }
  }
  async function save() {
    if (busy.current || !confirmed || !report?.ready || !requestId.current || finished) return
    busy.current = true; setSaving(true); setError('')
    try {
      const { data } = await api.post<ImportReport>('/clients/import', { rows, requestId: requestId.current, confirm: true })
      setReport(data); onImported()
    } catch (err) { setError(message(err)) }
    finally { busy.current = false; setSaving(false) }
  }
  function downloadReport() {
    if (!report) return
    const byRow = new Map(rows.map(row => [row.row, row]))
    downloadCsv('resultado-importacao-clientes.csv', [['Linha', ...IMPORT_FIELDS.map(field => field.label), 'Situação', 'Detalhe'], ...report.results.map(result => [result.row, ...IMPORT_FIELDS.map(field => byRow.get(result.row)?.data[field.key] || ''), statusLabel[result.status], result.reason || ''])])
  }

  return <dialog ref={dialog} className="client-import-dialog" aria-labelledby="client-import-title" aria-describedby="client-import-description" onCancel={event => { if (saving) event.preventDefault(); else onClose() }}>
    <div className="client-import-heading"><div><p>CADASTRO DE CLIENTES</p><h2 id="client-import-title">{finished ? 'Importação concluída' : 'Importar planilha'}</h2></div><button type="button" className="secondary-button" disabled={saving} onClick={onClose} aria-label="Fechar importação">Fechar</button></div>
    <p id="client-import-description" className="client-import-copy">Excel .xlsx ou CSV, até 3 MB e 1.000 clientes por arquivo. A primeira linha deve conter os títulos das colunas. Somente os dados conferidos serão enviados para sua empresa.</p>
    {!finished && <>
      {!report && <>
      <div className="client-import-file"><label className="form-field"><span>Planilha de clientes</span><input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" disabled={working || saving || reading} onChange={event => { void chooseFile(event.target.files?.[0]); event.target.value = '' }} /></label><button type="button" className="secondary-button" onClick={() => downloadCsv('modelo-clientes-criaos.csv', [IMPORT_FIELDS.map(field => field.label)])}>Baixar modelo CSV para Excel</button></div>
      <p className="client-import-hint">No Excel, formate telefone e CPF/CNPJ como texto para preservar zeros à esquerda. O formato antigo .xls precisa ser salvo como .xlsx.</p>
      {reading && <p role="status">Lendo a planilha…</p>}
      </>}
      {sheet && !report && <>
        <div className="client-import-sheet"><strong>{filename}</strong><span>{sheet.rows.length} clientes encontrados</span>{sheets.length > 1 && <label> Aba <select aria-label="Aba da planilha" value={sheetIndex} disabled={working} onChange={event => chooseSheet(Number(event.target.value))}>{sheets.map((item, index) => <option key={index} value={index}>{item.name}</option>)}</select></label>}</div>
        <h3>Confira o que cada coluna representa</h3>
        <div className="client-import-mapping">{IMPORT_FIELDS.map(field => <label className="form-field" key={field.key}><span>{field.label}{field.key === 'name' ? ' *' : ''}</span><select aria-label={`Coluna para ${field.label}`} disabled={working} value={mapping[field.key]} onChange={event => { setMapping({ ...mapping, [field.key]: Number(event.target.value) }); resetPreview() }}><option value={-1}>{field.key === 'name' ? 'Escolha a coluna do nome' : 'Não importar este campo'}</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{index + 1} · {header || 'Sem título'}</option>)}</select></label>)}</div>
        {unused.length > 0 && <p className="client-import-hint">Colunas que ficarão de fora: {unused.map(header => header || '(sem título)').join(', ')}.</p>}
        {mapError && <p className="client-import-hint">{mapError}</p>}
        <button type="button" className="primary-button" disabled={working || !!mapError} onClick={preview}>{working ? 'Conferindo…' : 'Conferir dados antes de salvar'}</button>
      </>}
    </>}
    {report && <>
      <p className="client-import-hint">{filename} · Aba {sheet?.name}</p>
      <div className="client-import-totals" role="status"><div><strong>{finished ? report.imported : report.ready}</strong><span>{finished ? (report.imported === 1 ? 'Importado' : 'Importados') : (report.ready === 1 ? 'Pronto para importar' : 'Prontos para importar')}</span></div><div><strong>{report.duplicates}</strong><span>Já cadastrados ou repetidos</span></div><div><strong>{report.invalid}</strong><span>Com dados para corrigir</span></div></div>
      <p className="client-import-copy">{finished ? 'Os clientes importados já estão na lista da sua empresa.' : 'Clientes já cadastrados não serão alterados. Os repetidos e os que têm erro ficarão de fora. Se houver algum ajuste, volte à planilha antes de confirmar.'}</p>
      <div className="client-import-table"><table><thead><tr><th>Linha</th>{IMPORT_FIELDS.map(field => <th key={field.key}>{field.label}</th>)}<th>Situação</th></tr></thead><tbody>{report.results.slice(0, 100).map(result => { const row = rows.find(item => item.row === result.row); return <tr key={result.row}><td>{result.row}</td>{IMPORT_FIELDS.map(field => <td key={field.key} title={row?.data[field.key]}>{row?.data[field.key] || '—'}</td>)}<td><span className={`client-import-status ${result.status}`}>{statusLabel[result.status]}</span>{result.reason && <small>{result.reason}</small>}</td></tr> })}</tbody></table></div>
      {report.results.length > 100 && <p className="client-import-hint">Mostrando as primeiras 100 de {report.total} linhas. A importação e o relatório consideram todas.</p>}
      {!finished && report.ready > 0 && <label className="client-import-confirm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} />Conferi os dados e quero cadastrar {report.ready} {report.ready === 1 ? 'novo cliente' : 'novos clientes'}.</label>}
      <div className="client-import-actions"><button type="button" className="secondary-button" onClick={downloadReport}>Baixar relatório CSV</button>{!finished && <><button type="button" className="secondary-button" disabled={saving} onClick={resetPreview}>Voltar e ajustar colunas</button><button type="button" className="primary-button" disabled={saving || !confirmed || !report.ready} onClick={save}>{saving ? 'Importando…' : `Importar ${report.ready} ${report.ready === 1 ? 'cliente válido' : 'clientes válidos'}`}</button></>}</div>
    </>}
    {error && <p className="client-import-error" role="alert">{error}</p>}
  </dialog>
}
