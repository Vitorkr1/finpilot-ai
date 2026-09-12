const Company = require('../models/Company');

// Carrega a empresa do usuário autenticado e a expõe em req.company,
// para checagem de plano (requirePlan) e escopo de dados por companyId.
async function loadCompany(req, res, next) {
  if (!req.user || !req.user.companyId) {
    return next();
  }

  const company = await Company.findById(req.user.companyId);
  if (!company) {
    return res.status(404).json({ error: 'Empresa não encontrada' });
  }
  if (company.subscriptionStatus === 'suspended') {
    return res.status(403).json({ error: 'Assinatura suspensa. Contate o suporte da CriaTech.' });
  }

  req.company = company;
  next();
}

module.exports = loadCompany;
