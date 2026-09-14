export function localDateISO(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function formatDate(value: string): string {
  const day = value.slice(0, 10)
  const [year, month, date] = day.split('-')
  return year && month && date ? `${date}/${month}/${year}` : '—'
}
export function isOverdue(value: string): boolean {
  return value.slice(0, 10) < localDateISO()
}
export function csvContent(rows: (string | number)[][]): string {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value)
            // Spreadsheet formula injection also applies to quoted CSV cells.
            const safe = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
            return `"${safe.replace(/"/g, '""')}"`
          })
          .join(';'),
      )
      .join('\r\n')
  )
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(
    new Blob([csvContent(rows)], { type: 'text/csv;charset=utf-8;' }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
