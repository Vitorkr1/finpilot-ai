require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const { defaultCategories } = require('../utils/defaultCategories');
const config = require('../config/config');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, resolve);
      return;
    }
    // Entrada oculta para senha
    const stdin = process.openStdin();
    process.stdin.on('data', () => {});
    rl.question(question, (value) => resolve(value));
  });
}

async function main() {
  console.log('\n=== FinPilot AI — Criador de Usuário Administrador ===\n');

  await mongoose.connect(config.mongoUri);
  console.log('✅ Conectado ao MongoDB\n');

  const name = (await ask('Nome: ')).trim() || process.env.ADMIN_NAME || 'Administrador';
  const email = (await ask('Email: ')).trim().toLowerCase() || process.env.ADMIN_EMAIL;
  const password = (await ask('Senha (mín. 8 caracteres): ')).trim();
  const confirmPassword = (await ask('Confirmar senha: ')).trim();

  rl.close();

  if (!email || !password) {
    console.error('\n❌ Nome, email e senha são obrigatórios.');
    process.exit(1);
  }

  if (password !== confirmPassword) {
    console.error('\n❌ As senhas não coincidem.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n❌ A senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    console.error(`\n❌ Já existe um usuário com o e-mail ${email}.`);
    process.exit(1);
  }

  const user = await User.create({
    name,
    email,
    password,
    role: 'admin',
    isVerified: true
  });

  await Category.insertMany(defaultCategories.map((c) => ({ ...c, user: user._id })));

  console.log(`\n✅ Usuário administrador criado com sucesso!`);
  console.log(`   Nome:  ${user.name}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Role:  ${user.role}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro ao criar usuário:', err.message);
  process.exit(1);
});
