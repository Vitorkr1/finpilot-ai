const { z } = require('zod');
const { createHash } = require('node:crypto');
const Client = require('../models/Client');
const Company = require('../models/Company');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');
const ClientImport = require('../models/ClientImport');
const { validateRows, analyzeRows } = require('../services/clientImport');
const asyncHandler = require('../utils/asyncHandler');
const transaction = require('../utils/transaction');
const { httpError } = require('../utils/validation');
const { logAction } = require('../services/audit');
const selection = 'name phone email document address';

const preview = asyncHandler(async (req, res) => {
  const body = z.object({ rows: z.unknown() }).strict().parse(req.body);
  const rows = validateRows(body.rows);
  const existing = await Client.find({ companyId: req.user.companyId }).select(selection).lean();
  res.json(analyzeRows(rows, existing).report);
});
const save = asyncHandler(async (req, res) => {
  const body = z.object({ rows: z.unknown(), confirm: z.literal(true), requestId: z.string().uuid() }).strict().parse(req.body);
  const rows = validateRows(body.rows);
  const fingerprint = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const result = await transaction(async session => {
    const company = await Company.findOneAndUpdate({ _id: req.user.companyId, subscriptionStatus: { $ne: 'suspended' } }, { $inc: { clientRevision: 1 } }, { session });
    if (!company) throw httpError(403, 'Empresa indisponível para importação.');
    const actor = await User.exists({ _id: req.user._id, companyId: company._id, active: true, role: { $in: ['admin', 'financeiro'] } }).session(session);
    const validSession = await AuthSession.exists({ _id: req.authSession._id, userId: req.user._id, expiresAt: { $gt: new Date() } }).session(session);
    if (!actor || !validSession) throw httpError(401, 'Seu acesso foi encerrado. Entre novamente.');
    const previous = await ClientImport.findOne({ companyId: company._id, requestId: body.requestId }).session(session);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw httpError(409, 'Essa confirmação pertence a outra importação. Confira novamente a planilha.');
      return { ...previous.result, replayed: true };
    }
    const existing = await Client.find({ companyId: company._id }).select(selection).session(session).lean();
    const { clients, report } = analyzeRows(rows, existing);
    if (clients.length) await Client.insertMany(clients.map(client => ({ ...client, companyId: company._id })), { session, ordered: true });
    const saved = { ...report, imported: clients.length, results: report.results.map(r => r.status === 'ready' ? { ...r, status: 'imported' } : r) };
    await ClientImport.create([{ companyId: company._id, requestId: body.requestId, fingerprint, result: saved, expiresAt: new Date(Date.now() + 86400000) }], { session });
    return saved;
  });
  if (!result.replayed) await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'import', entity: 'Client', details: { imported: result.imported, duplicates: result.duplicates, invalid: result.invalid } });
  res.json(result);
});
module.exports = { preview, save };
