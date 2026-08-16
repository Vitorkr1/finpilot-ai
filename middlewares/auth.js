const jwt = require('jsonwebtoken');
const config = require('../config/config');
const User = require('../models/User');

// Protege rotas: exige access token válido
exports.protect = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;

    if (!token) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Não autenticado' });
      }
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id);

    if (!user || !user.active) {
      res.clearCookie('accessToken');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Usuário inválido' });
      }
      return res.redirect('/login');
    }

    req.user = user;
    res.locals.user = user;
    next();
  } catch (err) {
    res.clearCookie('accessToken');
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Sessão expirada, faça login novamente' });
    }
    return res.redirect('/login');
  }
};

// Redireciona usuários já logados para longe das páginas de auth
exports.redirectIfAuth = async (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return next();
  try {
    jwt.verify(token, config.jwt.secret);
    return res.redirect('/dashboard');
  } catch {
    return next();
  }
};

// Restringe a determinadas roles
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Acesso negado' });
  }
  next();
};

// Carrega usuário em res.locals (para uso em todas as views, sem bloquear)
exports.attachUser = async (req, res, next) => {
  try {
    const token = req.cookies.accessToken;
    if (!token) return next();
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id);
    if (user) res.locals.user = user;
  } catch {
    // ignora silenciosamente
  }
  next();
};
