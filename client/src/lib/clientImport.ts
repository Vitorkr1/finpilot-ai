export const MAX_IMPORT_ROWS = 1000
export const MAX_IMPORT_FILE_BYTES = 3 * 1024 * 1024
export const IMPORT_FIELDS = [
  { key: 'name', label: 'Nome', aliases: ['nome', 'nome completo', 'cliente', 'razao social', 'name'] },
  { key: 'phone', label: 'Telefone', aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'phone'] },
  { key: 'email', label: 'E-mail', aliases: ['email', 'e mail'] },
  { key: 'document', label: 'CPF/CNPJ', aliases: ['cpf', 'cnpj', 'cpf cnpj', 'documento', 'document'] },
  { key: 'address', label: 'Endereço', aliases: ['endereco', 'endereco completo', 'address'] },
  { key: 'notes', label: 'Observações', aliases: ['observacoes', 'observacao', 'notas', 'notes'] },
] as const
export type ImportField = typeof IMPORT_FIELDS[number]['key']
export type Mapping = Record<ImportField, number>
export interface ImportSheet { name: string; headers: string[]; rows: { row: number; cells: string[] }[] }
export interface ImportRow { row: number; data: Record<ImportField, string> }
export interface ImportResult { row: number; status: 'ready' | 'duplicate' | 'invalid' | 'imported'; reason?: string }
export interface ImportReport { total: number; ready: number; duplicates: number; invalid: number; imported?: number; results: ImportResult[] }
const headerKey = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export function guessMapping(headers: string[]): Mapping {
  return Object.fromEntries(IMPORT_FIELDS.map(field => [field.key, headers.findIndex(header => (field.aliases as readonly string[]).includes(headerKey(header)))])) as Mapping
}
export function mappingError(mapping: Mapping): string | null {
  if (mapping.name < 0) return 'Escolha a coluna que contém o nome do cliente.'
  const selected = Object.values(mapping).filter(value => value >= 0)
  return new Set(selected).size !== selected.length ? 'Use uma coluna diferente para cada campo.' : null
}
export function mappedRows(sheet: ImportSheet, mapping: Mapping): ImportRow[] {
  return sheet.rows.map(item => ({ row: item.row, data: Object.fromEntries(IMPORT_FIELDS.map(field => [field.key, mapping[field.key] >= 0 ? item.cells[mapping[field.key]] || '' : ''])) as Record<ImportField, string> }))
}
export function gridToSheet(name: string, grid: unknown[][]): ImportSheet {
  const text = (value: unknown) => value == null ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value).trim()
  const first = grid.findIndex(row => row.some(value => text(value) !== ''))
  if (first < 0) throw new Error('A planilha está vazia.')
  const headers = grid[first].map(text)
  if (headers.length > 64 || headers.some(h => h.length > 200)) throw new Error('Use no máximo 64 colunas com títulos de até 200 caracteres.')
  const rows = grid.slice(first + 1).map((row, index) => ({ row: first + index + 2, cells: row.map(text) })).filter(row => row.cells.some(Boolean))
  if (!rows.length) throw new Error('A planilha tem cabeçalho, mas não tem clientes. Preencha as linhas abaixo dos títulos.')
  if (rows.length > MAX_IMPORT_ROWS) throw new Error('Importe no máximo 1.000 clientes por arquivo. Divida a planilha em partes.')
  if (rows.some(row => row.cells.length > 64 || row.cells.some(cell => cell.length > 5000))) throw new Error('A planilha contém colunas ou textos grandes demais.')
  return { name, headers, rows }
}
export function checkXlsxArchive(buffer: ArrayBuffer) {
  const view = new DataView(buffer), length = view.byteLength
  if (length < 22) throw new Error('O arquivo não é uma planilha Excel válida.')
  let end = -1
  for (let i = length - 22; i >= Math.max(0, length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === length) { end = i; break }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('Excel inválido ou dividido em vários arquivos.')
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true)
  if (count > 2048 || offset + size > end) throw new Error('A estrutura desta planilha é grande demais ou inválida.')
  let position = offset, expanded = 0
  for (let i = 0; i < count; i++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw new Error('A estrutura do Excel está corrompida.')
    const flags = view.getUint16(position + 8, true), bytes = view.getUint32(position + 24, true)
    const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true)
    if (flags & 1 || bytes === 0xffffffff) throw new Error('Não use planilhas criptografadas ou em formato ZIP64.')
    expanded += bytes
    position += 46 + nameLength + extraLength + commentLength
    if (expanded > 16 * 1024 * 1024 || position > offset + size) throw new Error('A planilha é grande demais depois de aberta. Divida o arquivo em partes.')
  }
  if (position !== offset + size) throw new Error('A estrutura do Excel está corrompida.')
}
