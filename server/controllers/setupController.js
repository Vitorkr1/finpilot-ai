const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Bootstrap de uso único: cria o super admin sem exigir shell no host nem
// formulário público de cadastro (Seção 6 do spec continua valendo — isto
// não é um cadastro aberto, é um gatilho protegido por token + auto-desativação).
//
// Protegido por SETUP_TOKEN (env). Se a variável não estiver definida, a
// rota se comporta como inexistente (404). Depois que o primeiro
// super_admin existir, a rota fica permanentemente bloqueada (409),
// mesmo que o token vaze ou seja reaproveitado.
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

const bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  const configuredToken = process.env.SETUP_TOKEN;
  if (!configuredToken) {
    return res.status(404).json({ error: 'Não encontrado' });
  }

  const providedToken = req.headers['x-setup-token'] || '';
  if (!timingSafeEqual(providedToken, configuredToken)) {
    return res.status(404).json({ error: 'Não encontrado' });
  }

  const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
  if (existingSuperAdmin) {
    return res.status(409).json({ error: 'Super admin já inicializado — este bootstrap está desativado permanentemente.' });
  }

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    return res.status(500).json({ error: 'SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD não configurados no ambiente' });
  }

  const passwordHash = await User.hashPassword(password);
  await User.create({
    name: 'Super Admin CriaTech',
    email,
    passwordHash,
    role: 'super_admin',
    companyId: null,
  });

  res.status(201).json({ message: `Super admin criado: ${email}. Remova SETUP_TOKEN do ambiente agora.` });
});

module.exports = { bootstrapSuperAdmin };
