const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

function transactionsToCSV(transactions) {
  const fields = [
    { label: 'Data', value: (row) => row.date.toISOString().slice(0, 10) },
    { label: 'Tipo', value: 'type' },
    { label: 'Descrição', value: 'description' },
    { label: 'Categoria', value: (row) => row.category?.name || '' },
    { label: 'Banco', value: (row) => row.bank?.name || '' },
    { label: 'Método', value: 'method' },
    { label: 'Valor', value: 'amount' },
    { label: 'Status', value: 'status' }
  ];
  const parser = new Parser({ fields, delimiter: ';' });
  return parser.parse(transactions);
}

function transactionsToPDF(transactions, user, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="finpilot-transacoes.pdf"');
  doc.pipe(res);

  doc.fontSize(20).fillColor('#2563EB').text('FinPilot AI — Relatório de Transações', { align: 'left' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#666').text(`Usuário: ${user.name} (${user.email})`);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
  doc.moveDown();

  doc.fontSize(11).fillColor('#000');
  transactions.forEach((t) => {
    const sign = t.type === 'despesa' ? '-' : '+';
    doc
      .text(
        `${t.date.toISOString().slice(0, 10)}  |  ${t.description}  |  ${
          t.category?.name || 'Sem categoria'
        }  |  ${sign} R$ ${t.amount.toFixed(2)}`
      )
      .moveDown(0.15);
  });

  doc.end();
}

module.exports = { transactionsToCSV, transactionsToPDF };
