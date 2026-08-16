const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

authenticator.options = { window: 1 }; // aceita o código atual + 1 período antes/depois (tolerância de relógio)

function generateSecret() {
  return authenticator.generateSecret();
}

function verifyToken(token, secret) {
  try {
    return authenticator.verify({ token: String(token).trim(), secret });
  } catch {
    return false;
  }
}

async function generateQrCodeDataUrl(email, secret) {
  const uri = authenticator.keyuri(email, 'FinPilot AI', secret);
  return QRCode.toDataURL(uri);
}

// Códigos de backup: 8 códigos de uso único, pra quando a pessoa perde o
// celular com o app autenticador. Mostrados em texto puro só uma vez (na
// hora de gerar); guardamos só o hash bcrypt de cada um.
async function generateBackupCodes() {
  const plainCodes = Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-')
  );
  const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));
  return { plainCodes, hashedCodes };
}

async function verifyBackupCode(code, hashedCodes) {
  const normalized = String(code || '').trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      return i; // índice do código usado, pra remover da lista (uso único)
    }
  }
  return -1;
}

module.exports = { generateSecret, verifyToken, generateQrCodeDataUrl, generateBackupCodes, verifyBackupCode };
