const Bank = require('../models/Bank');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const config = require('../config/config');
const ofxService = require('../services/ofxService');
const csvImportService = require('../services/csvImportService');

// Calcula o período da fatura atual (aberta) de um cartão a partir do dia de fechamento.
// Ex: fechamento dia 10 -> período vai do dia 11 do mês anterior até dia 10 do mês atual.
function currentInvoicePeriod(closingDay, refDate = new Date()) {
  const day = Math.min(closingDay, 28); // evita estourar meses curtos
  let periodEnd = new Date(refDate.getFullYear(), refDate.getMonth(), day, 23, 59, 59, 999);
  if (refDate.getDate() > day) {
    periodEnd = new Date(refDate.getFullYear(), refDate.getMonth() + 1, day, 23, 59, 59, 999);
  }
  const periodStart = new Date(periodEnd);
  periodStart.setMonth(periodStart.getMonth() - 1);
  periodStart.setDate(periodStart.getDate() + 1);
  periodStart.setHours(0, 0, 0, 0);
  return { periodStart, periodEnd };
}

// GET /banks
exports.showBanks = asyncHandler(async (req, res) => {
  const banks = await Bank.find({ user: req.user._id, archived: false }).sort({ createdAt: 1 });
  res.render('banks/index', { title: 'Meus Bancos', banks, bankTypes: config.bankTypes });
});

// GET /api/banks
exports.listBanks = asyncHandler(async (req, res) => {
  const banks = await Bank.find({ user: req.user._id, archived: false }).sort({ createdAt: 1 });
  res.json({ success: true, banks });
});

// POST /api/banks
exports.createBank = asyncHandler(async (req, res) => {
  const { name, type, color, logo, currentBalance, availableBalance, isCustom, closingDay, dueDay } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'Informe o nome do banco.' });

  const bank = await Bank.create({
    user: req.user._id,
    name,
    type: type || 'Conta Corrente',
    color: color || '#2563EB',
    logo: logo || '',
    currentBalance: Number(currentBalance) || 0,
    availableBalance: Number(availableBalance) || Number(currentBalance) || 0,
    closingDay: type === 'Cartão' && closingDay ? Number(closingDay) : null,
    dueDay: type === 'Cartão' && dueDay ? Number(dueDay) : null,
    isCustom: !!isCustom
  });

  res.status(201).json({ success: true, bank });
});

// PUT /api/banks/:id
exports.updateBank = asyncHandler(async (req, res) => {
  const bank = await Bank.findOne({ _id: req.params.id, user: req.user._id });
  if (!bank) return res.status(404).json({ success: false, message: 'Banco não encontrado.' });

  const fields = ['name', 'type', 'color', 'logo', 'currentBalance', 'availableBalance', 'closingDay', 'dueDay'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) bank[f] = req.body[f];
  });

  await bank.save();
  res.json({ success: true, bank });
});

// DELETE /api/banks/:id
exports.deleteBank = asyncHandler(async (req, res) => {
  const bank = await Bank.findOne({ _id: req.params.id, user: req.user._id });
  if (!bank) return res.status(404).json({ success: false, message: 'Banco não encontrado.' });

  const txCount = await Transaction.countDocuments({ bank: bank._id });
  if (txCount > 0) {
    bank.archived = true;
    await bank.save();
    return res.json({ success: true, message: 'Banco possui movimentações e foi arquivado.' });
  }

  await bank.deleteOne();
  res.json({ success: true, message: 'Banco excluído com sucesso.' });
});

// GET /api/banks/:id/invoice
// Retorna o total da fatura aberta (período atual) de um cartão de crédito.
exports.getInvoice = asyncHandler(async (req, res) => {
  const bank = await Bank.findOne({ _id: req.params.id, user: req.user._id });
  if (!bank) return res.status(404).json({ success: false, message: 'Banco não encontrado.' });
  if (bank.type !== 'Cartão') {
    return res.status(400).json({ success: false, message: 'Esta conta não é um cartão de crédito.' });
  }
  if (!bank.closingDay) {
    return res.status(400).json({ success: false, message: 'Defina o dia de fechamento da fatura para este cartão.' });
  }

  const { periodStart, periodEnd } = currentInvoicePeriod(bank.closingDay);

  const transactions = await Transaction.find({
    user: req.user._id,
    bank: bank._id,
    type: 'despesa',
    date: { $gte: periodStart, $lte: periodEnd }
  })
    .sort({ date: -1 })
    .populate('category', 'name icon color');

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  let dueDate = null;
  if (bank.dueDay) {
    dueDate = new Date(periodEnd);
    dueDate.setDate(bank.dueDay);
    if (dueDate <= periodEnd) dueDate.setMonth(dueDate.getMonth() + 1);
  }

  res.json({
    success: true,
    invoice: { periodStart, periodEnd, dueDate, total, transactions }
  });
});

// POST /api/banks/:id/import-ofx
// Importa um extrato OFX pra atualizar o saldo REAL de um banco que o
// usuário já cadastrou manualmente, e cria as movimentações do período que
// ainda não existiam (usando o FITID do próprio banco pra nunca duplicar,
// mesmo importando o mesmo arquivo ou um período sobreposto de novo).
exports.importOfx = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Envie o arquivo .ofx do extrato.' });
  }

  const bank = await Bank.findOne({ _id: req.params.id, user: req.user._id });
  if (!bank) {
    return res.status(404).json({ success: false, message: 'Banco não encontrado.' });
  }

  if (!ofxService.looksLikeOfx(req.file.buffer)) {
    return res.status(400).json({
      success: false,
      message: 'O arquivo não parece ser um OFX válido (deveria começar com "OFXHEADER:").'
    });
  }

  let stmt;
  try {
    stmt = await ofxService.parseStatement(req.file.buffer);
  } catch (err) {
    console.error('[bankController] Erro ao interpretar OFX:', err.message);
    return res.status(400).json({ success: false, message: `Não consegui ler esse extrato: ${err.message}` });
  }

  // Evita criar lançamento duplicado se a mesma transação do banco (FITID)
  // já foi importada antes pra esse mesmo banco.
  const incomingFitIds = stmt.transactions.map((t) => t.fitId);
  const existing = await Transaction.find({
    user: req.user._id,
    bank: bank._id,
    ofxFitId: { $in: incomingFitIds }
  }).select('ofxFitId');
  const existingSet = new Set(existing.map((t) => t.ofxFitId));

  const newOnes = stmt.transactions.filter((t) => !existingSet.has(t.fitId));

  // Categoria genérica "Extrato importado" — cria uma vez por usuário se
  // ainda não existir, só pra não deixar a movimentação sem categoria.
  let importCategory = await Category.findOne({ user: req.user._id, name: 'Extrato importado' });
  if (!importCategory && newOnes.length > 0) {
    importCategory = await Category.create({
      user: req.user._id,
      name: 'Extrato importado',
      type: 'despesa',
      icon: 'fa-solid fa-file-arrow-up',
      color: '#64748B',
      isDefault: false
    });
  }

  const docs = newOnes.map((t) => ({
    user: req.user._id,
    bank: bank._id,
    category: t.amount < 0 ? importCategory?._id || null : null,
    type: t.amount < 0 ? 'despesa' : 'receita',
    description: t.description,
    amount: Math.abs(t.amount),
    method: bank.type === 'Cartão' ? 'Cartão' : 'Outro',
    date: t.date || new Date(),
    status: 'pago', // já aconteceu de verdade, veio do extrato do banco
    ofxFitId: t.fitId
  }));

  if (docs.length > 0) {
    await Transaction.insertMany(docs, { ordered: false }).catch((err) => {
      // Corrida rara (mesmo FITID inserido em paralelo) — o índice único
      // já protege contra duplicata real; só logamos e seguimos.
      console.error('[bankController] Aviso ao inserir lançamentos do OFX:', err.message);
    });
  }

  // Atualiza o saldo do banco com o saldo REAL que veio do extrato
  // (LEDGERBAL) — essa é a fonte de verdade, não uma soma calculada.
  if (stmt.balance !== null) {
    bank.currentBalance = stmt.balance;
    bank.availableBalance = stmt.balanceAvailable !== null ? stmt.balanceAvailable : stmt.balance;
    await bank.save();
  }

  res.json({
    success: true,
    message: `Extrato importado: ${docs.length} lançamento(s) novo(s), ${stmt.transactions.length - docs.length} já existiam.`,
    bank,
    imported: docs.length,
    skipped: stmt.transactions.length - docs.length,
    periodStart: stmt.periodStart,
    periodEnd: stmt.periodEnd
  });
});

// POST /api/banks/:id/import-csv/preview
// Lê só as primeiras linhas do CSV e devolve pro usuário escolher, na tela,
// qual coluna é data/descrição/valor — cobre bancos que não exportam OFX.
exports.previewCsv = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Envie o arquivo CSV.' });

  try {
    const preview = csvImportService.preview(req.file.buffer);
    res.json({ success: true, ...preview });
  } catch (err) {
    console.error('[bankController] Erro ao pré-visualizar CSV:', err.message);
    res.status(400).json({ success: false, message: 'Não foi possível ler esse CSV. Confira o arquivo.' });
  }
});

// POST /api/banks/:id/import-csv/commit
// Body (multipart): csvFile + colunas escolhidas (dateCol, descriptionCol,
// amountCol, hasHeader, dateFormat). Mesma lógica de dedupe do OFX, só que
// usando hash da linha em vez de FITID (CSV não tem ID único de verdade).
exports.commitCsv = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Envie o arquivo CSV.' });

  const bank = await Bank.findOne({ _id: req.params.id, user: req.user._id });
  if (!bank) return res.status(404).json({ success: false, message: 'Banco não encontrado.' });

  const { dateCol, descriptionCol, amountCol, hasHeader, dateFormat } = req.body;
  if (dateCol === undefined || descriptionCol === undefined || amountCol === undefined) {
    return res.status(400).json({ success: false, message: 'Selecione as colunas de data, descrição e valor.' });
  }

  let parsed;
  try {
    parsed = csvImportService.parseWithMapping(req.file.buffer, {
      dateCol: Number(dateCol),
      descriptionCol: Number(descriptionCol),
      amountCol: Number(amountCol),
      hasHeader: hasHeader === 'true' || hasHeader === true,
      dateFormat: dateFormat || 'DD/MM/YYYY'
    });
  } catch (err) {
    console.error('[bankController] Erro ao processar CSV:', err.message);
    return res.status(400).json({ success: false, message: 'Não foi possível processar esse CSV com o mapeamento escolhido.' });
  }

  if (parsed.length === 0) {
    return res.status(400).json({ success: false, message: 'Nenhuma linha válida encontrada com esse mapeamento de colunas.' });
  }

  const incomingHashes = parsed.map((t) => t.rowHash);
  const existing = await Transaction.find({
    user: req.user._id,
    bank: bank._id,
    csvRowHash: { $in: incomingHashes }
  }).select('csvRowHash');
  const existingSet = new Set(existing.map((t) => t.csvRowHash));

  const newOnes = parsed.filter((t) => !existingSet.has(t.rowHash));

  let importCategory = await Category.findOne({ user: req.user._id, name: 'Extrato importado' });
  if (!importCategory && newOnes.length > 0) {
    importCategory = await Category.create({
      user: req.user._id,
      name: 'Extrato importado',
      type: 'despesa',
      icon: 'fa-solid fa-file-arrow-up',
      color: '#64748B',
      isDefault: false
    });
  }

  const docs = newOnes.map((t) => ({
    user: req.user._id,
    bank: bank._id,
    category: t.amount < 0 ? importCategory?._id || null : null,
    type: t.amount < 0 ? 'despesa' : 'receita',
    description: t.description,
    amount: Math.abs(t.amount),
    method: 'Outro',
    date: t.date,
    status: 'pago',
    csvRowHash: t.rowHash
  }));

  if (docs.length > 0) {
    await Transaction.insertMany(docs, { ordered: false }).catch((err) => {
      console.error('[bankController] Aviso ao inserir lançamentos do CSV:', err.message);
    });
  }

  res.json({
    success: true,
    message: `CSV importado: ${docs.length} lançamento(s) novo(s), ${parsed.length - docs.length} já existiam.`,
    imported: docs.length,
    skipped: parsed.length - docs.length
  });
});
