const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const clientRoutes = require('./routes/clientRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const serviceOrderRoutes = require('./routes/serviceOrderRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const companyUserRoutes = require('./routes/companyUserRoutes');
const stockRoutes = require('./routes/stockRoutes');
const financialRoutes = require('./routes/financialRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const aiRoutes = require('./routes/aiRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const setupRoutes = require('./routes/setupRoutes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Necessário atrás do proxy reverso do Render (e de qualquer PaaS) para que
  // req.ip e o express-rate-limit leiam o IP real do cliente via X-Forwarded-For.
  if (process.env.TRUST_PROXY) {
    app.set('trust proxy', process.env.TRUST_PROXY);
  }

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/service-orders', serviceOrderRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/company-users', companyUserRoutes);
  app.use('/api/stock-items', stockRoutes);
  app.use('/api/financial-entries', financialRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/setup', setupRoutes);

  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res, next) => {
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
