const Company = require('../models/Company');
const asyncHandler = require('../utils/asyncHandler');

// Rotas restritas ao super_admin: apenas dados administrativos da empresa
// (plano, status de assinatura). Nunca expõe dados operacionais do tenant.
const list = asyncHandler(async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.json(companies);
});

const getOne = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
  res.json(company);
});

module.exports = { list, getOne };
