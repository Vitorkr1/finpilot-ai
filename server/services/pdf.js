const PDFDocument = require('pdfkit');

const COLORS = {
  ink: '#18243E', muted: '#63718A', accent: '#5064F5', border: '#DFE5EF',
  soft: '#F5F7FC', white: '#FFFFFF', green: '#147D59', red: '#AE3844',
};
const STATUS_LABEL = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado',
};
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 });
const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
const clean = (value) => String(value ?? '').replace(/[\u2010-\u2015]/g, '-').replace(/\u00a0/g, ' ');
const currency = (value) => clean(money.format(Number(value ?? 0)));
const MARGIN = 42;
const LINE_HEIGHT = 14;
const CELL_PADDING = 8;

// Explicit lines keep PDFKit's flowing text cursor out of the table layout.
// A long word is split by code point, so even an unbroken SKU cannot overflow.
function wrapText(doc, value, width, font = 'Helvetica', size = 9) {
  doc.font(font).fontSize(size);
  const lines = [];
  for (const paragraph of clean(value).split(/\r?\n/)) {
    let line = '';
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    for (let word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (doc.widthOfString(candidate) <= width) { line = candidate; continue; }
      if (line) { lines.push(line); line = ''; }
      while (doc.widthOfString(word) > width) {
        const chars = Array.from(word);
        let low = 1, high = chars.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (doc.widthOfString(chars.slice(0, mid).join('')) <= width) low = mid;
          else high = mid - 1;
        }
        lines.push(chars.slice(0, low).join(''));
        word = chars.slice(low).join('');
      }
      line = word;
    }
    // Preserve explicit paragraph breaks without dropping content.
    lines.push(line);
  }
  return lines;
}

// Returns a Buffer for GET /api/budgets/:id/pdf. No database or network access.
function generateBudgetPdf({ budget, client, company }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margin: MARGIN, bufferPages: true, autoFirstPage: false,
      info: { Title: 'Orçamento de serviço', Author: clean(company?.name || 'CriaOS'), Creator: 'CriaOS - Cria Tech' },
    });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      const reference = clean(budget._id || '-');
      const createdAt = budget.createdAt ? new Date(budget.createdAt) : null;
      const issued = createdAt && !Number.isNaN(createdAt.getTime()) ? date.format(createdAt) : '-';
      const status = STATUS_LABEL[budget.status] || 'Não informado';
      const items = budget.items || [];
      let y;
      let width;
      let bottom;

      function text(value, x, top, cellWidth, options = {}) {
        const { font = 'Helvetica', size = 9, color = COLORS.ink, align = 'left' } = options;
        doc.font(font).fontSize(size).fillColor(color).text(clean(value), x, top, {
          width: cellWidth, align, lineBreak: false,
        });
      }
      function rule(top) {
        doc.moveTo(MARGIN, top).lineTo(MARGIN + width, top).lineWidth(0.6).strokeColor(COLORS.border).stroke();
      }
      function newPage(first = false) {
        doc.addPage();
        width = doc.page.width - MARGIN * 2;
        bottom = doc.page.height - 96;
        doc.rect(MARGIN, MARGIN, 30, 3).fill(COLORS.accent);
        text(first ? 'PROPOSTA COMERCIAL' : 'PROPOSTA COMERCIAL / CONTINUAÇÃO', MARGIN + 39, MARGIN - 2, 280,
          { size: 8, color: COLORS.muted });
        text('Orçamento de serviço', MARGIN, 64, width, { font: 'Helvetica-Bold', size: first ? 24 : 19 });
        text(`Referência: ${reference}`, MARGIN, first ? 102 : 96, width - 150, { size: 8, color: COLORS.muted });
        text(`Emissão: ${issued}`, MARGIN + width - 150, first ? 102 : 96, 150, { size: 8, color: COLORS.muted, align: 'right' });
        rule(first ? 124 : 117);
        y = first ? 143 : 135;
      }

      // Issuer and client data grow vertically instead of overlapping the table.
      function drawParties() {
        const gap = 26;
        const columnWidth = (width - gap) / 2;
        const fields = [
          [
            { value: company?.name || 'CriaOS', bold: true },
            ...(company?.cnpj ? [{ value: `CNPJ: ${company.cnpj}` }] : []),
          ],
          [
            { value: client?.name || 'Cliente não informado', bold: true },
            ...(client?.document ? [{ value: `Documento: ${client.document}` }] : []),
            ...(client?.phone ? [{ value: `Telefone: ${client.phone}` }] : []),
            ...(client?.address ? [{ value: `Endereço: ${client.address}` }] : []),
          ],
        ].map((column) => column.flatMap((field) => wrapText(doc, field.value, columnWidth,
          field.bold ? 'Helvetica-Bold' : 'Helvetica', field.bold ? 11 : 9)
          .map((line) => ({ line, bold: field.bold }))));
        const count = Math.max(fields[0].length, fields[1].length);
        let offset = 0;
        while (offset < count) {
          text('EMPRESA EMITENTE', MARGIN, y, columnWidth, { size: 8, color: COLORS.muted });
          text('DADOS DO CLIENTE', MARGIN + columnWidth + gap, y, columnWidth, { size: 8, color: COLORS.muted });
          y += 21;
          const capacity = Math.max(1, Math.floor((bottom - y - 12) / LINE_HEIGHT));
          const take = Math.min(capacity, count - offset);
          fields.forEach((column, index) => column.slice(offset, offset + take).forEach((field, lineIndex) => {
            text(field.line, MARGIN + index * (columnWidth + gap), y + lineIndex * LINE_HEIGHT, columnWidth,
              { font: field.bold ? 'Helvetica-Bold' : 'Helvetica', size: field.bold ? 11 : 9, color: field.bold ? COLORS.ink : COLORS.muted });
          }));
          y += take * LINE_HEIGHT + 20;
          offset += take;
          if (offset < count) newPage();
        }
      }

      const columns = [
        { label: '#', width: 34, align: 'center' },
        { label: 'DESCRIÇÃO DO SERVIÇO', width: 211, align: 'left' },
        { label: 'QTD.', width: 62, align: 'right' },
        { label: 'VALOR UNIT.', width: 94, align: 'right' },
        { label: 'SUBTOTAL', width: 110.28, align: 'right' },
      ];
      function tableHeader() {
        doc.roundedRect(MARGIN, y, width, 29, 4).fill(COLORS.ink);
        let x = MARGIN;
        columns.forEach((column) => {
          text(column.label, x + CELL_PADDING, y + 10, column.width - CELL_PADDING * 2,
            { font: 'Helvetica-Bold', size: 7.5, color: COLORS.white, align: column.align });
          x += column.width;
        });
        y += 29;
      }
      function newTablePage() { newPage(); tableHeader(); }

      newPage(true);
      drawParties();
      if (y + 65 > bottom) newPage();
      tableHeader();
      if (!items.length) {
        text('Nenhum serviço adicionado a este orçamento.', MARGIN + 10, y + 15, width - 20,
          { color: COLORS.muted });
        y += 45;
        rule(y);
      }
      items.forEach((item, index) => {
        const values = [String(index + 1), item.description || '-', quantity.format(item.qty), currency(item.unitPrice), currency(item.qty * item.unitPrice)];
        const fontSizes = values.map((value, columnIndex) => {
          if (columnIndex === 1) return 9;
          doc.font('Helvetica').fontSize(9);
          const available = columns[columnIndex].width - CELL_PADDING * 2;
          return Math.max(7, Math.min(9, 9 * available / (doc.widthOfString(clean(value)) || 1)));
        });
        const cells = values.map((value, columnIndex) => wrapText(doc, value,
          columns[columnIndex].width - CELL_PADDING * 2, 'Helvetica', fontSizes[columnIndex]));
        const lineCount = Math.max(...cells.map((cell) => cell.length));
        const fullHeight = lineCount * LINE_HEIGHT + 20;
        const freshCapacity = bottom - 164; // continuation header + table header
        // Keep ordinary rows together; split only rows taller than a fresh page.
        if (y + fullHeight > bottom && fullHeight <= freshCapacity) newTablePage();
        let offset = 0;
        while (offset < lineCount) {
          const continuationHeight = offset ? 12 : 0;
          if (bottom - y < LINE_HEIGHT + 20 + continuationHeight) newTablePage();
          const capacity = Math.floor((bottom - y - 20 - continuationHeight) / LINE_HEIGHT);
          const take = Math.min(capacity, lineCount - offset);
          const height = take * LINE_HEIGHT + 20 + continuationHeight;
          if (index % 2 === 0) doc.rect(MARGIN, y, width, height).fill(COLORS.soft);
          if (offset) text(`Item ${index + 1} (continuação)`, MARGIN + columns[0].width + CELL_PADDING,
            y + 7, columns[1].width - CELL_PADDING * 2, { size: 7, color: COLORS.muted });
          let x = MARGIN;
          cells.forEach((cell, columnIndex) => {
            cell.slice(offset, offset + take).forEach((line, lineIndex) => {
              text(line, x + CELL_PADDING, y + 10 + continuationHeight + lineIndex * LINE_HEIGHT,
                columns[columnIndex].width - CELL_PADDING * 2, { align: columns[columnIndex].align, size: fontSizes[columnIndex] });
            });
            x += columns[columnIndex].width;
          });
          y += height;
          rule(y);
          offset += take;
          if (offset < lineCount) newTablePage();
        }
      });

      const totalLines = wrapText(doc, currency(budget.total), 221, 'Helvetica-Bold', 21);
      const totalHeight = 49 + totalLines.length * 25;
      if (y + totalHeight + 71 > bottom) newPage();
      y += 24;
      text('RESUMO DA PROPOSTA', MARGIN, y + 2, 230, { font: 'Helvetica-Bold', size: 8, color: COLORS.muted });
      text(`${items.length} ${items.length === 1 ? 'item no orçamento' : 'itens no orçamento'}`, MARGIN, y + 23, 230, { size: 10 });
      text(`Status: ${status}`, MARGIN, y + 42, 230,
        { size: 9, color: budget.status === 'aprovado' ? COLORS.green : budget.status === 'recusado' ? COLORS.red : COLORS.muted });
      const totalX = MARGIN + width - 245;
      doc.roundedRect(totalX, y, 245, totalHeight, 7).fill(COLORS.ink);
      text('VALOR TOTAL DO ORÇAMENTO', totalX + 12, y + 14, 221, { size: 8, color: '#BFCBEB' });
      totalLines.forEach((line, index) => text(line, totalX + 12, y + 34 + index * 25, 221,
        { font: 'Helvetica-Bold', size: 21, color: COLORS.white, align: 'right' }));
      y += totalHeight + 17;
      text('Valores em reais (BRL). Consulte a empresa emitente para condições de pagamento e execução.',
        MARGIN, y, width, { size: 8, color: COLORS.muted });

      const range = doc.bufferedPageRange();
      for (let page = range.start; page < range.start + range.count; page += 1) {
        doc.switchToPage(page);
        const footerY = doc.page.height - 52;
        rule(footerY - 11);
        text('CriaOS / Cria Tech', MARGIN, footerY, 200, { font: 'Helvetica-Bold', size: 8, color: COLORS.muted });
        text('criatech.online', MARGIN + 150, footerY, 200, { size: 8, color: COLORS.muted });
        text(`Página ${page - range.start + 1} de ${range.count}`, MARGIN + width - 100, footerY, 100,
          { size: 8, color: COLORS.muted, align: 'right' });
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}

module.exports = { generateBudgetPdf };
