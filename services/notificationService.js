const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { sendBillsDueEmail } = require('./emailService');

/**
 * Para um usuário específico: busca boletos vencidos ou vencendo nos
 * próximos 3 dias e envia o e-mail de alerta (se ele tiver ativado).
 * Retorna quantos boletos foram encontrados (útil pro teste manual).
 */
async function checkBillsForUser(userId) {
  const user = await User.findById(userId);
  if (!user || !user.emailAlertsEnabled) return { sent: false, count: 0 };

  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);

  const bills = await Transaction.find({
    user: userId,
    status: 'pendente',
    dueDate: { $ne: null, $lte: in3Days }
  }).sort({ dueDate: 1 });

  if (bills.length === 0) return { sent: false, count: 0 };

  const result = await sendBillsDueEmail({ user, bills });
  return { ...result, count: bills.length };
}

/**
 * Roda para todos os usuários ativos com alertas de e-mail habilitados.
 * Pensado para ser chamado uma vez por dia (ver server.js).
 */
async function runDailyBillCheck() {
  const users = await User.find({ active: true, emailAlertsEnabled: true }).select('_id');
  let sent = 0;
  for (const u of users) {
    try {
      const result = await checkBillsForUser(u._id);
      if (result.sent) sent += 1;
    } catch (err) {
      console.error(`[notificationService] Falha ao checar boletos do usuário ${u._id}:`, err.message);
    }
  }
  console.log(`[notificationService] Verificação diária concluída. E-mails enviados: ${sent}/${users.length}.`);
  return { usersChecked: users.length, emailsSent: sent };
}

module.exports = { checkBillsForUser, runDailyBillCheck };
