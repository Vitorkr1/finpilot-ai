require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const User = require('../models/User');
const config = require('../config/config');
const { createInviteToken } = require('../controllers/faceController');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('\n=== FinPilot AI — Gerar link de cadastro facial ===\n');

  await mongoose.connect(config.mongoUri);
  console.log('✅ Conectado ao MongoDB\n');

  const email = (await ask('E-mail do usuário que vai cadastrar o rosto: ')).trim().toLowerCase();
  const minutosStr = (await ask('Validade do link em minutos (padrão 60): ')).trim();
  rl.close();

  const minutos = Number(minutosStr) > 0 ? Number(minutosStr) : 60;

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`\n❌ Nenhum usuário encontrado com o e-mail ${email}.`);
    process.exit(1);
  }

  const { token, expires } = await createInviteToken(user._id, minutos * 60 * 1000);

  const link = `${config.appUrl}/faces/register/${token}`;

  console.log(`\n✅ Link gerado para ${user.name} (${user.email}):\n`);
  console.log(`   ${link}\n`);
  console.log(`   Expira em: ${expires.toLocaleString('pt-BR')}`);
  console.log('   Envie esse link diretamente para a pessoa (whatsapp, e-mail, etc).');
  console.log('   O link só funciona uma vez e para de funcionar após o cadastro.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erro ao gerar link:', err.message);
  process.exit(1);
});
