const cron = require('node-cron');
const Company = require('../models/Company');

// Roda todo dia à meia-noite: marca como overdue quem passou do vencimento.
// Nunca exclui ou suspende automaticamente — isso é sempre uma ação manual do super admin.
async function checkOverdueSubscriptions() {
  const result = await Company.updateMany(
    { subscriptionStatus: 'active', nextDueDate: { $lt: new Date() } },
    { $set: { subscriptionStatus: 'overdue' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[subscription-cron] ${result.modifiedCount} empresa(s) marcada(s) como overdue`);
  }
}

function startSubscriptionCron() {
  cron.schedule('0 0 * * *', () => {
    checkOverdueSubscriptions().catch((err) => console.error('[subscription-cron] erro:', err.message));
  });
}

module.exports = { startSubscriptionCron, checkOverdueSubscriptions };
