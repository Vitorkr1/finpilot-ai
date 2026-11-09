const { z } = require('zod');
const { clientSchema } = require('./clientData');
const { httpError } = require('../utils/validation');
const MAX_IMPORT_ROWS = 1000;
const rowsSchema = z.array(z.object({ row: z.number().int().min(1).max(1000000), data: z.unknown() }).strict()).min(1).max(MAX_IMPORT_ROWS);
const labels = { name: 'Nome', phone: 'Telefone', email: 'E-mail', document: 'CPF/CNPJ', address: 'Endereço', notes: 'Observações' };
function validateRows(rows) {
  const result = rowsSchema.parse(rows);
  if (new Set(result.map(r => r.row)).size !== result.length) throw httpError(400, 'As linhas da planilha precisam ter números diferentes.');
  return result;
}
const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const doc = value => normal(value).replace(/[^a-z0-9]/g, '');
function contactKeys(client) {
  const name = normal(client.name), keys = [];
  let phone = String(client.phone || '').replace(/\D/g, '');
  if ((phone.length === 12 || phone.length === 13) && phone.startsWith('55')) phone = phone.slice(2);
  if (phone) keys.push(JSON.stringify(['phone', name, phone]));
  if (client.email) keys.push(JSON.stringify(['email', name, normal(client.email)]));
  if (!keys.length) keys.push(JSON.stringify(['address', name, normal(client.address)]));
  return keys;
}
function makeIndex(existing) {
  const documents = new Set(), contacts = new Map();
  function add(client) {
    const document = doc(client.document);
    if (document) documents.add(document);
    for (const key of contactKeys(client)) {
      if (!contacts.has(key)) contacts.set(key, new Set());
      contacts.get(key).add(document);
    }
  }
  for (const client of existing) add(client);
  return { add, reason(client) {
    const document = doc(client.document);
    if (document && documents.has(document)) return 'CPF/CNPJ já cadastrado ou repetido na planilha.';
    for (const key of contactKeys(client)) {
      const matches = contacts.get(key);
      if (matches && (!document || matches.has('') || matches.has(document))) return 'Mesmo nome e contato/endereço já cadastrado ou repetido na planilha.';
    }
    return null;
  } };
}
function analyzeRows(rows, existing) {
  const index = makeIndex(existing), results = [], clients = [];
  for (const item of rows) {
    const parsed = clientSchema.strict().safeParse(item.data);
    if (!parsed.success) {
      const fields = [...new Set(parsed.error.issues.map(issue => labels[issue.path[0]] || 'Dados'))];
      results.push({ row: item.row, status: 'invalid', reason: `Confira: ${fields.join(', ')}. Nome é obrigatório; respeite os formatos e tamanhos dos campos.` });
      continue;
    }
    const reason = index.reason(parsed.data);
    if (reason) results.push({ row: item.row, status: 'duplicate', reason });
    else { index.add(parsed.data); clients.push(parsed.data); results.push({ row: item.row, status: 'ready' }); }
  }
  return { clients, report: { total: rows.length, ready: clients.length, invalid: results.filter(r => r.status === 'invalid').length, duplicates: results.filter(r => r.status === 'duplicate').length, results } };
}
module.exports = { MAX_IMPORT_ROWS, validateRows, analyzeRows };
