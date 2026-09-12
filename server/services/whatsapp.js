// Atendimento via WhatsApp (Seção 8, recurso Pro) usando Baileys.
// Uma sessão por empresa (piloto). Credenciais no MongoDB (nunca disco —
// Seção 11: o Render free apaga o disco a cada reinício).
const { makeWASocket, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const { useMongoAuthState, clearAuthState } = require('./whatsappAuthState');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const ai = require('./ai');

const logger = pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'error' });

// companyId (string) -> { sock, status, qr }
const sessions = new Map();
const RECONNECT_DELAY_MS = 4000;

function getSession(companyId) {
  return sessions.get(String(companyId));
}

function getStatus(companyId) {
  const session = getSession(companyId);
  if (!session) return { status: 'disconnected', qr: null };
  return { status: session.status, qr: session.qr };
}

async function handleIncomingMessages(companyId, { messages, type }) {
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (msg.key.fromMe || !msg.message) continue;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!text) continue;

    const record = await WhatsAppMessage.create({
      companyId,
      from: msg.key.remoteJid,
      text,
      direction: 'in',
    });

    // Triagem por IA (Seção 8/9): classifica antes de cair na fila humana.
    // Falha na IA nunca deve derrubar o recebimento da mensagem.
    try {
      const classification = await ai.classifyWhatsAppMessage(text);
      record.classification = classification;
      await record.save();
    } catch (err) {
      logger.warn({ err: err.message }, 'falha ao classificar mensagem via IA');
    }
  }
}

async function connect(companyId) {
  const key = String(companyId);
  const existing = sessions.get(key);
  if (existing && (existing.status === 'connected' || existing.status === 'connecting')) {
    return getStatus(key);
  }

  const session = { sock: null, status: 'connecting', qr: null };
  sessions.set(key, session);

  const { state, saveCreds, clearAll } = await useMongoAuthState(companyId);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
  });
  session.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', (payload) => {
    handleIncomingMessages(companyId, payload).catch((err) => logger.error({ err: err.message }, 'erro processando mensagem recebida'));
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.qr = await QRCode.toDataURL(qr);
      session.status = 'qr';
    }

    if (connection === 'open') {
      session.status = 'connected';
      session.qr = null;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        session.status = 'disconnected';
        session.qr = null;
        sessions.delete(key);
        await clearAll();
      } else {
        // Reconexão automática (Seção 11): o Render free "dorme" e derruba a
        // conexão do WhatsApp — reconecta sozinho ao acordar.
        session.status = 'reconnecting';
        setTimeout(() => {
          connect(companyId).catch((err) => logger.error({ err: err.message }, 'falha ao reconectar WhatsApp'));
        }, RECONNECT_DELAY_MS);
      }
    }
  });

  return getStatus(key);
}

async function disconnect(companyId) {
  const key = String(companyId);
  const session = sessions.get(key);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch {
      // já pode estar desconectado — segue para limpar o estado mesmo assim
    }
  }
  sessions.delete(key);
  await clearAuthState(companyId);
}

module.exports = { connect, disconnect, getStatus };
