const { verifyAccessToken } = require('../utils/tokens');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Usuário inválido' });
  }

  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sem permissão para esta ação' });
    }
    next();
  };
}

// Todo dado operacional é isolado por companyId — super_admin nunca acessa dados de tenant.
function requireTenant(req, res, next) {
  if (!req.user || !req.user.companyId) {
    return res.status(403).json({ error: 'Esta rota é exclusiva de usuários de empresa (tenant)' });
  }
  next();
}

const PLAN_RANK = { basic: 0, pro: 1 };

function requirePlan(minPlan) {
  return (req, res, next) => {
    const companyPlan = req.company ? req.company.plan : null;
    if (!companyPlan || PLAN_RANK[companyPlan] < PLAN_RANK[minPlan]) {
      return res.status(403).json({ error: `Este recurso requer o plano ${minPlan}` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireTenant, requirePlan };
