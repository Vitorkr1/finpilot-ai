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
    const value = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(value) ? Number(value) : value === 'true' ? 1 : value === 'false' ? false : value);
  } else if (process.env.RENDER === 'true') {
    app.set('trust proxy', 1);
  }

  app.use(helmet({ referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, contentSecurityPolicy: { directives: {
    imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org', 'https://res.cloudinary.com'],
  } } }));
  const originAllowed = (req, origin) => {
    const configured = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
    const sameHost = `${process.env.NODE_ENV === 'production' ? 'https' : req.protocol}://${req.get('host')}`;
    return !origin || origin === configured || origin === sameHost;
  };
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!originAllowed(req, req.get('origin'))) return res.status(403).json({ error: 'Origem não autorizada.' });
    next();
  });
  app.use(cors((req, callback) => callback(null, { origin: originAllowed(req, req.get('origin')) ? req.get('origin') || false : false, credentials: true })));
  app.use(express.json({ limit: '128kb', inflate: false }));
  app.use(cookieParser());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(':method :url :status :response-time ms', { skip: (req) => req.path.startsWith('/api/route-tracking') }));
  }

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api/companies', companyRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/service-orders', serviceOrderRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/route-tracking', require('./routes/routeTrackingRoutes'));
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
