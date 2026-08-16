require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const config = require('./config/config');
const { runDailyBillCheck } = require('./services/notificationService');

// Roda a checagem de boletos vencendo uma vez por dia (a cada 24h a partir do
// boot do servidor). Simples e sem dependências extras — para um agendamento
// horário exato (ex: sempre às 8h), trocar por uma lib como node-cron.
function scheduleDailyBillCheck() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  runDailyBillCheck().catch((err) => console.error('[notificationService] Erro na checagem inicial:', err.message));
  setInterval(() => {
    runDailyBillCheck().catch((err) => console.error('[notificationService] Erro na checagem diária:', err.message));
  }, TWENTY_FOUR_HOURS);
}

async function start() {
  await connectDB();

  const server = app.listen(config.port, () => {
    console.log(`
🚀 FinPilot AI rodando em: ${config.appUrl}
🌎 Ambiente: ${config.env}
    `);
    scheduleDailyBillCheck();
  });

  process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err.message);
    server.close(() => process.exit(1));
  });
}

start();
