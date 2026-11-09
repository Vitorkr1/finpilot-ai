import Papa from 'papaparse'
import readExcelFile from 'read-excel-file/universal'
import { checkXlsxArchive, gridToSheet, MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS, type ImportSheet } from './clientImport'

export function parseClientCsv(text: string): ImportSheet {
  const grid: string[][] = []
  let nonempty = 0, invalid = false, tooLarge = false
  Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    dynamicTyping: false, skipEmptyLines: false, delimitersToGuess: [';', ',', '\t'],
    step(result, parser) {
      if (result.errors.some(error => error.code !== 'UndetectableDelimiter')) { invalid = true; parser.abort(); return }
      grid.push(result.data)
      if (result.data.some(value => value.trim())) nonempty++
      if (nonempty > MAX_IMPORT_ROWS + 1 || grid.length > 10000) { tooLarge = true; parser.abort() }
    },
  })
  if (invalid) throw new Error('O CSV tem aspas ou separadores inválidos. Salve novamente como CSV no Excel.')
  if (tooLarge) throw new Error('Importe no máximo 1.000 clientes por arquivo.')
  return gridToSheet('CSV', grid)
}
export async function readClientFile(name: string, buffer: ArrayBuffer): Promise<ImportSheet[]> {
  if (!buffer.byteLength || buffer.byteLength > MAX_IMPORT_FILE_BYTES) throw new Error('Escolha um arquivo de até 3 MB.')
  if (/\.csv$/i.test(name)) {
    const bytes = new Uint8Array(buffer)
    let text: string
    if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le').decode(buffer)
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be').decode(buffer)
    else { try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer) } catch { text = new TextDecoder('windows-1252').decode(buffer) } }
    if (text.includes('\0')) throw new Error('O arquivo não parece ser um CSV de texto.')
    return [parseClientCsv(text)]
  }
  if (!/\.xlsx$/i.test(name)) throw new Error('Use Excel .xlsx ou CSV. Se o arquivo for .xls, salve como .xlsx no Excel.')
  checkXlsxArchive(buffer)
  const sheets = await readExcelFile(buffer, { parseNumber: value => value })
  const result: ImportSheet[] = []
  for (const sheet of sheets) {
    if (sheet.data.filter(row => row.some(value => value != null && String(value).trim())).length < 2) continue
    result.push(gridToSheet(sheet.sheet, sheet.data))
  }
  if (!result.length) throw new Error('O Excel não contém uma aba com clientes.')
  return result
}
