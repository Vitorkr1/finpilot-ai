const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const config = require('./config/config');
const { generalLimiter } = require('./middlewares/rateLimiter');
const { attachUser } = require('./middlewares/auth');
const { csrfProtection, attachCsrfToken } = require('./middlewares/csrf');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();
app.locals.buildVersion = config.buildVersion; // disponível em toda view, sem precisar passar em cada res.render

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Segurança
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Bootstrap, Chart.js, AOS e Font Awesome agora são servidos localmente
        // (public/vendor), então não dependemos mais de CDNs externas — isso
        // evita que a página quebre se uma CDN estiver bloqueada/fora do ar.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser(config.cookieSecret));
app.use(mongoSanitize());
app.use(generalLimiter);

app.use(express.static(path.join(__dirname, 'public')));

// CSRF só depois dos arquivos estáticos — não faz sentido gerar/validar
// token pra imagem, CSS ou JS.
app.use(attachCsrfToken);
app.use(csrfProtection);

// Disponibiliza dados globais para todas as views
app.use(attachUser);
app.use((req, res, next) => {
  res.locals.path = req.path;
  res.locals.appName = 'FinPilot AI';
  next();
});

// Rota inicial
app.get('/', (req, res) => {
  if (res.locals.user) return res.redirect('/dashboard');
  res.render('landing', { title: 'FinPilot AI — A inteligência que cuida do seu dinheiro' });
});

// Rotas
app.use(require('./routes/authRoutes'));
app.use(require('./routes/faceRoutes'));
app.use(require('./routes/dashboardRoutes'));
app.use(require('./routes/bankRoutes'));
app.use(require('./routes/transactionRoutes'));
app.use(require('./routes/categoryRoutes'));
app.use(require('./routes/goalRoutes'));
app.use(require('./routes/budgetRoutes'));
app.use(require('./routes/calendarRoutes'));
app.use(require('./routes/reportRoutes'));
app.use(require('./routes/aiRoutes'));
app.use(require('./routes/userRoutes'));
app.use(require('./routes/notificationRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
