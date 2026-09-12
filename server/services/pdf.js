const PDFDocument = require('pdfkit');

const currency = (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

// Retorna um Buffer com o PDF do orçamento — usado em GET /api/budgets/:id/pdf.
function generateBudgetPdf({ budget, client, company }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(company?.name || 'CriaOS', { continued: false });
    doc.fontSize(10).fillColor('#666').text('Orçamento de serviço');
    doc.moveDown();

    doc.fillColor('#000').fontSize(11);
    doc.text(`Cliente: ${client?.name || '-'}`);
    if (client?.document) doc.text(`Documento: ${client.document}`);
    if (client?.phone) doc.text(`Telefone: ${client.phone}`);
    if (client?.address) doc.text(`Endereço: ${client.address}`);
    doc.text(`Data: ${new Date(budget.createdAt).toLocaleDateString('pt-BR')}`);
    doc.text(`Status: ${budget.status}`);
    doc.moveDown();

    doc.fontSize(12).text('Itens', { underline: true });
    doc.moveDown(0.5);

    const startX = doc.x;
    doc.fontSize(10).fillColor('#444');
    doc.text('Descrição', startX, doc.y, { continued: true, width: 260 });
    doc.text('Qtd', startX + 260, doc.y, { continued: true, width: 60 });
    doc.text('Preço unit.', startX + 320, doc.y, { continued: true, width: 90 });
    doc.text('Subtotal', startX + 410, doc.y);
    doc.moveDown(0.3);
    doc.moveTo(startX, doc.y).lineTo(startX + 500, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.3);

    doc.fillColor('#000');
    budget.items.forEach((item) => {
      const subtotal = item.qty * item.unitPrice;
      const y = doc.y;
      doc.text(item.description, startX, y, { continued: true, width: 260 });
      doc.text(String(item.qty), startX + 260, y, { continued: true, width: 60 });
      doc.text(currency(item.unitPrice), startX + 320, y, { continued: true, width: 90 });
      doc.text(currency(subtotal), startX + 410, y);
    });

    doc.moveDown();
    doc.moveTo(startX, doc.y).lineTo(startX + 500, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(0.5);
    doc.fontSize(13).text(`Total: ${currency(budget.total)}`, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#888').text('Gerado pelo CriaOS — powered by CriaTech (criatech.online)', { align: 'center' });

    doc.end();
  });
}

module.exports = { generateBudgetPdf };
