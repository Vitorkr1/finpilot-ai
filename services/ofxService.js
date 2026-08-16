const crypto = require('crypto');
const { parse: parseOfxRaw } = require('ofx-js');

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// OFX: YYYYMMDDHHMMSS[.mmm][-3:TZ] ou só YYYYMMDD
function parseOfxDate(dt) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/.exec(String(dt || '').trim());
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00'] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
}

function looksLikeOfx(buffer) {
  return /^OFXHEADER:/.test(buffer.slice(0, 64).toString('latin1').trim());
}

function hashBuffer(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

/**
 * Extrai o extrato (saldo + lançamentos) de um arquivo OFX. Aceita tanto
 * conta corrente (BANKMSGSRSV1) quanto cartão de crédito (CREDITCARDMSGSRSV1)
 * — a maioria dos bancos brasileiros exporta os dois nesse mesmo formato.
 */
async function parseStatement(buffer) {
  let data;
  try {
    data = await parseOfxRaw(buffer.toString('utf8'));
  } catch {
    data = await parseOfxRaw(buffer.toString('latin1')); // alguns bancos usam ISO-8859-1
  }

  const ofx = data.OFX;
  if (!ofx) throw new Error('Arquivo OFX inválido: tag <OFX> não encontrada.');

  const bankSet = ofx.BANKMSGSRSV1 && ofx.BANKMSGSRSV1.STMTTRNRS;
  const cardSet = ofx.CREDITCARDMSGSRSV1 && ofx.CREDITCARDMSGSRSV1.CCSTMTTRNRS;
  const set = bankSet || cardSet;
  if (!set) throw new Error('Arquivo OFX não contém extrato de conta nem de cartão reconhecível.');

  const rs = Array.isArray(set) ? set[0] : set; // alguns bancos mandam múltiplas contas no mesmo arquivo
  if (rs.TRNSTATUS && Number(rs.TRNSTATUS.CODE) !== 0) {
    throw new Error(`O banco retornou erro no arquivo: ${rs.TRNSTATUS.MESSAGE || rs.TRNSTATUS.CODE}`);
  }

  const isCard = !!cardSet;
  const stmt = isCard ? rs.CCSTMTRS : rs.STMTRS;
  if (!stmt) throw new Error('Arquivo OFX sem dados de extrato.');

  const acct = (isCard ? stmt.CCACCTFROM : stmt.BANKACCTFROM) || {};
  const ledger = stmt.LEDGERBAL || {};
  const avail = stmt.AVAILBAL || {};
  const list = stmt.BANKTRANLIST || {};
  const rawTx = Array.isArray(list.STMTTRN) ? list.STMTTRN : list.STMTTRN ? [list.STMTTRN] : [];

  const transactions = rawTx.map((t) => ({
    fitId: String(t.FITID || ''),
    date: parseOfxDate(t.DTPOSTED),
    amount: toNumber(t.TRNAMT) || 0,
    description: String(t.NAME || t.MEMO || 'Lançamento importado').slice(0, 200).trim()
  })).filter((t) => t.fitId); // sem FITID não dá pra deduplicar com segurança — descarta

  return {
    isCard,
    accountId: String(acct.ACCTID || acct.ACCTID2 || ''),
    periodStart: parseOfxDate(list.DTSTART),
    periodEnd: parseOfxDate(list.DTEND),
    balance: toNumber(ledger.BALAMT),
    balanceAsOf: parseOfxDate(ledger.DTASOF),
    balanceAvailable: avail.BALAMT != null ? toNumber(avail.BALAMT) : null,
    transactions
  };
}

module.exports = { parseStatement, looksLikeOfx, hashBuffer };
