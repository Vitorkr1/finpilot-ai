const crypto = require('crypto');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

// Protegido por SETUP_TOKEN (env). Se a variável não estiver definida, a
// rota se comporta como inexistente (404) — mesma ideia nas duas rotas
// abaixo (Seção 6 do spec continua valendo: isto não é cadastro público,
// é um gatilho protegido por token).
function checkSetupToken(req, res) {
  const configuredToken = process.env.SETUP_TOKEN;
  if (!configuredToken) {
    res.status(404).json({ error: 'Não encontrado' });
    return false;
  }

  const provided = Buffer.from(req.headers['x-setup-token'] || '');
  const configured = Buffer.from(configuredToken);
  const valid = provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
  if (!valid) {
    res.status(404).json({ error: 'Não encontrado' });
    return false;
  }

  return true;
}

// Bootstrap de uso único: cria o super admin sem exigir shell no host nem
// formulário público de cadastro. Depois que o primeiro super_admin existir,
// a rota fica permanentemente bloqueada (409), mesmo que o token vaze ou
// seja reaproveitado.
const bootstrapSuperAdmin = asyncHandler(async (req, res) => {
  if (!checkSetupToken(req, res)) return;

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

// Recuperação: sincroniza a senha do super admin (identificado por
// SUPER_ADMIN_EMAIL) com o valor atual de SUPER_ADMIN_PASSWORD. Nunca aceita
// uma senha vinda da requisição — só reaplica o que já está configurado no
// ambiente do servidor, então um token vazado não permite escolher senha
// arbitrária nem visar outra conta.
const resetSuperAdminPassword = asyncHandler(async (req, res) => {
  if (!checkSetupToken(req, res)) return;

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    return res.status(500).json({ error: 'SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD não configurados no ambiente' });
  }

  const user = await User.findOne({ email, role: 'super_admin' });
  if (!user) {
    return res.status(404).json({ error: `Nenhum super admin encontrado com o e-mail ${email}` });
  }

  user.passwordHash = await User.hashPassword(password);
  user.active = true;
  await user.save();

  res.json({ message: `Senha do super admin ${email} sincronizada com SUPER_ADMIN_PASSWORD. Remova SETUP_TOKEN do ambiente agora.` });
});

module.exports = { bootstrapSuperAdmin, resetSuperAdminPassword };
