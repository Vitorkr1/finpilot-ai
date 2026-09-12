require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const mongoose = require('mongoose');

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Defina SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD no .env antes de rodar o seed.');
    process.exit(1);
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Super admin já existe: ${email}`);
  } else {
    const passwordHash = await User.hashPassword(password);
    await User.create({
      name: 'Super Admin CriaTech',
      email,
      passwordHash,
      role: 'super_admin',
      companyId: null,
    });
    console.log(`Super admin criado: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
