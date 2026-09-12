require('dotenv').config();
const createApp = require('./app');
const connectDB = require('./config/db');
const { startSubscriptionCron } = require('./services/subscriptionCron');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const app = createApp();
  startSubscriptionCron();
  app.listen(PORT, () => {
    console.log(`[server] CriaOS rodando na porta ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] falha ao iniciar:', err);
  process.exit(1);
});
