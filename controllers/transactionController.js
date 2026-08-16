const crypto = require('crypto');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const Bank = require('../models/Bank');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const aiService = require('../services/aiService');
const subscriptionService = require('../services/subscriptionService');
const { sendTransactionEmail } = require('../services/emailService');

// Dispara o e-mail de notificação por movimentação sem travar a resposta ao
// usuário (fire-and-forget) — só envia se a pessoa ativou essa preferência.
function notifyTransactionEmail(user, transaction, event) {
  if (!user.emailOnEveryTransaction) return;
  sendTransactionEmail({ user, transaction, event }).catch((err) => {
    console.error('[transactionController] Falha ao enviar e-mail de movimentação:', err.message);
  });
}

// Compara uma despesa nova com a média das últimas movimentações da mesma
// categoria (últimos 6 meses) — se for muito acima do normal, sinaliza pra
// avisar o usuário na hora, sem precisar esperar o relatório de insights da IA.
async function detectAnomaly(userId, categoryId, amount) {
  if (!categoryId) return null;

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const stats = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        category: categoryId,
        type: 'despesa',
        date: { $gte: sixMonthsAgo }
      }
    },
    { $group: { _id: null, avg: { $avg: '$amount' }, count: { $sum: 1 } } }
  ]);

  if (!stats[0] || stats[0].count < 3) return null; // histórico curto demais pra ter uma média confiável
  const avg = stats[0].avg;
  if (amount > avg * 2.5 && amount - avg > 50) {
    return {
      isAnomaly: true,
      average: Math.round(avg * 100) / 100,
      message: `Esse valor está bem acima do que você costuma gastar nessa categoria (média de ${avg.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).`
    };
  }
  return null;
}

async function applyBalanceEffect(tx, sign = 1) {
  const bank = await Bank.findById(tx.bank);
  if (!bank) return;

  if (tx.type === 'receita') {
    bank.currentBalance += sign * tx.amount;
    bank.availableBalance += sign * tx.amount;
  } else if (tx.type === 'despesa') {
    bank.currentBalance -= sign * tx.amount;
    bank.availableBalance -= sign * tx.amount;
  } else if (tx.type === 'transferencia' && tx.destinationBank) {
    bank.currentBalance -= sign * tx.amount;
    bank.availableBalance -= sign * tx.amount;
    await bank.save();

    const destBank = await Bank.findById(tx.destinationBank);
    if (destBank) {
      destBank.currentBalance += sign * tx.amount;
      destBank.availableBalance += sign * tx.amount;
      await destBank.save();
    }
    return;
  }

  await bank.save();
}

// GET /transactions
exports.showTransactions = asyncHandler(async (req, res) => {
  const banks = await Bank.find({ user: req.user._id, archived: false });
  const categories = await Category.find({ user: req.user._id }).sort({ type: 1, name: 1 });
  res.render('transactions/index', { title: 'Movimentações', banks, categories });
});

// GET /api/transactions  (com filtros, busca e paginação)
exports.listTransactions = asyncHandler(async (req, res) => {
  const { type, bank, category, method, status, search, startDate, endDate, page = 1, limit = 20 } = req.query;

  const query = { user: req.user._id };
  if (type) query.type = type;
  if (bank) query.bank = bank;
  if (category) query.category = category;
  if (method) query.method = method;
  if (status) query.status = status;
  if (search) query.$text = { $search: search };
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const [transactions, total] = await Promise.all([
    Transaction.find(query)
      .populate('bank', 'name color logo')
      .populate('destinationBank', 'name color logo')
      .populate('category', 'name icon color')
      .sort({ date: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Transaction.countDocuments(query)
  ]);

  res.json({
    success: true,
    transactions,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
  });
});

// POST /api/transactions
exports.createTransaction = asyncHandler(async (req, res) => {
  const {
    bank, destinationBank, category, type, description, amount,
    method, date, dueDate, isRecurring, recurrenceFrequency, isInstallment,
    installmentTotal, tags, notes, status, attachment
  } = req.body;

  if (!bank || !type || !description || !amount) {
    return res.status(400).json({ success: false, message: 'Preencha os campos obrigatórios.' });
  }
  if (type === 'transferencia' && !destinationBank) {
    return res.status(400).json({ success: false, message: 'Selecione o banco de destino para a transferência.' });
  }

  const ownerBank = await Bank.findOne({ _id: bank, user: req.user._id });
  if (!ownerBank) return res.status(404).json({ success: false, message: 'Banco de origem inválido.' });

  // Parcelamento: cria N transações vinculadas
  if (isInstallment && installmentTotal && Number(installmentTotal) > 1) {
    const total = Number(installmentTotal);
    const groupId = crypto.randomUUID();
    const baseDate = date ? new Date(date) : new Date();
    const installmentAmount = Number(amount) / total;
    const created = [];

    for (let i = 0; i < total; i++) {
      const txDate = new Date(baseDate);
      txDate.setMonth(txDate.getMonth() + i);

      const tx = await Transaction.create({
        user: req.user._id,
        bank,
        category: category || null,
        type,
        description: `${description} (${i + 1}/${total})`,
        amount: installmentAmount,
        method: method || 'Cartão',
        date: txDate,
        isInstallment: true,
        installmentNumber: i + 1,
        installmentTotal: total,
        installmentGroupId: groupId,
        tags: tags || [],
        notes,
        status: i === 0 ? (status || 'pago') : 'pendente'
      });

      if (i === 0 && tx.status === 'pago') await applyBalanceEffect(tx, 1);
      created.push(tx);
    }

    notifyTransactionEmail(req.user, {
      description: `${description} (${total}x)`,
      amount: Number(amount),
      type, date: baseDate, method, dueDate: null
    }, 'criada');

    return res.status(201).json({ success: true, transactions: created });
  }

  const tx = await Transaction.create({
    user: req.user._id,
    bank,
    destinationBank: type === 'transferencia' ? destinationBank : null,
    category: category || null,
    type,
    description,
    amount: Number(amount),
    method: method || 'PIX',
    date: date ? new Date(date) : new Date(),
    dueDate: dueDate ? new Date(dueDate) : null,
    isRecurring: !!isRecurring,
    recurrenceFrequency: isRecurring ? recurrenceFrequency : null,
    tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map((t) => t.trim()) : []),
    notes,
    attachment: attachment || null,
    status: status || 'pago'
  });

  if (tx.status === 'pago') {
    await applyBalanceEffect(tx, 1);
  }

  notifyTransactionEmail(req.user, tx, tx.status === 'pago' ? 'paga' : 'criada');

  const anomaly = type === 'despesa' ? await detectAnomaly(req.user._id, tx.category, tx.amount) : null;

  res.status(201).json({ success: true, transaction: tx, anomaly });
});

// PUT /api/transactions/:id
exports.updateTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });

  const wasPago = tx.status === 'pago';

  // Reverte o efeito anterior no saldo se estava paga
  if (wasPago) await applyBalanceEffect(tx, -1);

  const fields = ['bank', 'destinationBank', 'category', 'type', 'description', 'amount', 'method', 'date', 'dueDate', 'tags', 'notes', 'status', 'attachment'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) tx[f] = req.body[f];
  });

  await tx.save();

  if (tx.status === 'pago') await applyBalanceEffect(tx, 1);

  // Só notifica quando o boleto/movimentação ACABOU de ser marcado como pago
  // (transição pendente/agendado -> pago), pra não mandar e-mail em toda edição pequena.
  if (!wasPago && tx.status === 'pago') {
    notifyTransactionEmail(req.user, tx, 'paga');
  }

  res.json({ success: true, transaction: tx });
});

// DELETE /api/transactions/:id
exports.deleteTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });

  if (tx.status === 'pago') await applyBalanceEffect(tx, -1);
  await tx.deleteOne();

  res.json({ success: true, message: 'Transação excluída com sucesso.' });
});

// GET /api/transactions/subscriptions
exports.listSubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await subscriptionService.detectSubscriptions(req.user._id);
  res.json({ success: true, subscriptions });
});

// GET /api/transactions/suggest-category?description=...&type=despesa
// Sugestão de categoria baseada no PRÓPRIO histórico do usuário — sem
// gastar chamada de IA. Procura lançamentos passados com descrição parecida
// e retorna a categoria mais usada entre eles.
exports.suggestCategory = asyncHandler(async (req, res) => {
  const { description, type } = req.query;
  if (!description || description.trim().length < 3) {
    return res.json({ success: true, category: null });
  }

  const words = description
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3); // ignora "de", "no", "um" etc.

  if (words.length === 0) return res.json({ success: true, category: null });

  const regexPattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  const matches = await Transaction.find({
    user: req.user._id,
    type: type || 'despesa',
    category: { $ne: null },
    description: { $regex: regexPattern, $options: 'i' }
  })
    .sort({ date: -1 })
    .limit(30)
    .select('category');

  if (matches.length === 0) return res.json({ success: true, category: null });

  const counts = {};
  matches.forEach((m) => {
    const id = m.category.toString();
    counts[id] = (counts[id] || 0) + 1;
  });

  const [topCategoryId] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  res.json({ success: true, category: topCategoryId });
});

// POST /api/transactions/scan-receipt
// Recebe um comprovante (imagem) OU um boleto (PDF), salva o arquivo e pede
// à IA para extrair os dados. Não cria a transação sozinha — devolve
// sugestões para o usuário revisar e confirmar no formulário.
exports.scanReceipt = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Envie uma imagem ou um PDF do boleto.' });
  }

  const attachmentPath = `/uploads/receipts/${req.file.filename}`;
  const isPdf = req.file.mimetype === 'application/pdf';

  try {
    const categories = await Category.find({ user: req.user._id }).select('name type');

    let result;
    if (isPdf) {
      const pdfParse = require('pdf-parse');
      const buffer = fs.readFileSync(req.file.path);
      const pdfData = await pdfParse(buffer);

      if (!pdfData.text || pdfData.text.trim().length < 20) {
        return res.json({
          success: true,
          configured: true,
          error: true,
          attachment: attachmentPath,
          message: 'Este PDF parece ser uma imagem escaneada (sem texto selecionável). Tire uma foto do boleto em vez de enviar o PDF, ou preencha manualmente.'
        });
      }

      result = await aiService.analyzeBoletoText({ text: pdfData.text, categories });
    } else {
      const base64Image = fs.readFileSync(req.file.path).toString('base64');
      result = await aiService.scanReceiptImage({ base64Image, mimeType: req.file.mimetype, categories });
    }

    if (!result.configured) {
      return res.json({ success: true, configured: false, attachment: attachmentPath, message: result.message });
    }
    if (result.error) {
      return res.json({ success: true, configured: true, error: true, attachment: attachmentPath, message: result.message });
    }

    // Tenta casar a categoria sugerida (texto) com um _id real do usuário
    let categoryId = null;
    if (result.suggestedCategory) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === String(result.suggestedCategory).toLowerCase()
      );
      if (match) categoryId = match._id;
    }

    res.json({
      success: true,
      configured: true,
      attachment: attachmentPath,
      isBoleto: isPdf,
      suggestion: {
        description: result.description || '',
        amount: result.amount || null,
        date: isPdf ? (result.issueDate || null) : (result.date || null),
        dueDate: result.dueDate || null,
        type: isPdf ? 'despesa' : (result.type === 'receita' ? 'receita' : 'despesa'),
        method: isPdf ? 'Boleto' : (result.method || 'PIX'),
        status: isPdf ? 'pendente' : undefined, // boleto recém-enviado começa pendente por padrão; o usuário confirma
        category: categoryId,
        confidence: result.confidence || 'baixa'
      }
    });
  } catch (err) {
    console.error('[transactionController] Falha ao analisar comprovante/boleto:', err.message);
    res.json({
      success: true,
      configured: true,
      error: true,
      attachment: attachmentPath,
      message: 'Não foi possível analisar automaticamente. Preencha os dados manualmente.'
    });
  }
});
