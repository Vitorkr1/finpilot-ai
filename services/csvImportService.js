const crypto = require('crypto');
const Papa = require('papaparse');

function hashRow(rowArray) {
  return crypto.createHash('sha1').update(rowArray.join('|')).digest('hex');
}

// Converte "1.234,56" ou "1234,56" ou "1234.56" ou "-89,90" em número.
// CSVs brasileiros costumam usar vírgula decimal; formatos internacionais
// usam ponto — detecta pelo que aparece por último na string.
function parseAmount(raw) {
  const str = String(raw || '').trim().replace(/[R$\s]/g, '');
  if (!str) return null;

  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  let normalized = str;
  if (lastComma > lastDot) {
    // vírgula é o separador decimal: remove pontos de milhar, troca vírgula por ponto
    normalized = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // ponto é o separador decimal: remove vírgulas de milhar
    normalized = str.replace(/,/g, '');
  }

  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

// Converte data em vários formatos comuns (DD/MM/YYYY, YYYY-MM-DD, etc.)
function parseDate(raw, format) {
  const str = String(raw || '').trim();
  if (!str) return null;

  if (format === 'YYYY-MM-DD') {
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY (padrão brasileiro, default)
  const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.exec(str);
  if (!m) return null;
  let [, day, month, year] = m;
  if (year.length === 2) year = `20${year}`;
  const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Lê só as primeiras linhas — usado pra montar a tela de mapeamento de colunas.
function preview(buffer, maxRows = 6) {
  const text = buffer.toString('utf8');
  const result = Papa.parse(text, { skipEmptyLines: true });
  const rows = result.data.slice(0, maxRows);
  return { rows, totalRowsDetected: result.data.length, delimiter: result.meta.delimiter };
}

// Processa o arquivo inteiro de acordo com o mapeamento de colunas escolhido
// pelo usuário na tela de preview.
function parseWithMapping(buffer, mapping) {
  const { dateCol, descriptionCol, amountCol, hasHeader, dateFormat } = mapping;
  const text = buffer.toString('utf8');
  const result = Papa.parse(text, { skipEmptyLines: true });
  const rows = hasHeader ? result.data.slice(1) : result.data;

  const transactions = [];
  rows.forEach((row) => {
    const date = parseDate(row[dateCol], dateFormat);
    const description = String(row[descriptionCol] || '').trim();
    const amount = parseAmount(row[amountCol]);

    if (!date || !description || amount === null || amount === 0) return; // linha inválida ou incompleta, ignora

    transactions.push({
      rowHash: hashRow(row),
      date,
      description: description.slice(0, 200),
      amount
    });
  });

  return transactions;
}

module.exports = { preview, parseWithMapping, parseAmount, parseDate };
