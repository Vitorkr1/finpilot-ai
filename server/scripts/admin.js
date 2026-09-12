#!/usr/bin/env node
/**
 * CLI de administração da CriaTech (super admin).
 * Não expõe nenhuma rota HTTP — opera direto no banco.
 *
 * Uso:
 *   node server/scripts/admin.js create-company --name "JDS" --email admin@jds.com --plan basic
 *   node server/scripts/admin.js list
 *   node server/scripts/admin.js set-plan --company <id> --plan pro
 *   node server/scripts/admin.js mark-paid --company <id> --next-due 2026-11-10
 *   node server/scripts/admin.js suspend --company <id>
 *   node server/scripts/admin.js delete --company <id>
 *   node server/scripts/admin.js edit --company <id> --field name --value "Novo Nome"
 */
require('dotenv').config();
const readline = require('readline');
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Company = require('../models/Company');
const User = require('../models/User');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i += 1;
    }
  }
  return args;
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question} (digite "sim" para confirmar): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'sim');
    });
  });
}

async function createCompany(args) {
  if (!args.name || !args.email) {
    throw new Error('Uso: create-company --name <nome> --email <email do admin> [--plan basic|pro] [--segment ...] [--cnpj ...]');
  }

  const company = await Company.create({
    name: args.name,
    cnpj: args.cnpj || undefined,
    segment: args.segment || 'outro',
    plan: args.plan || 'basic',
    subscriptionStatus: 'active',
  });

  const tempPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await User.hashPassword(tempPassword);
  const adminUser = await User.create({
    companyId: company._id,
    name: `Admin ${args.name}`,
    email: args.email,
    passwordHash,
    role: 'admin',
  });

  console.log(`Empresa criada: ${company.name} (${company._id})`);
  console.log(`Usuário admin criado: ${adminUser.email}`);
  console.log(`Senha temporária (envie com segurança e peça troca no primeiro login): ${tempPassword}`);
}

async function listCompanies() {
  const companies = await Company.find().sort({ createdAt: -1 });
  if (companies.length === 0) {
    console.log('Nenhuma empresa cadastrada.');
    return;
  }
  console.table(
    companies.map((c) => ({
      id: c._id.toString(),
      nome: c.name,
      plano: c.plan,
      status: c.subscriptionStatus,
      proximoVencimento: c.nextDueDate ? c.nextDueDate.toISOString().slice(0, 10) : '-',
    }))
  );
}

async function findCompanyOrThrow(id) {
  if (!id) throw new Error('Informe --company <id>');
  const company = await Company.findById(id);
  if (!company) throw new Error(`Empresa não encontrada: ${id}`);
  return company;
}

async function setPlan(args) {
  const company = await findCompanyOrThrow(args.company);
  if (!['basic', 'pro'].includes(args.plan)) {
    throw new Error('--plan deve ser "basic" ou "pro"');
  }
  company.plan = args.plan;
  await company.save();
  console.log(`Plano de ${company.name} atualizado para: ${company.plan}`);
}

async function markPaid(args) {
  const company = await findCompanyOrThrow(args.company);
  company.subscriptionStatus = 'active';
  if (args['next-due']) {
    company.nextDueDate = new Date(args['next-due']);
  }
  await company.save();
  console.log(`${company.name} marcada como paga. Próximo vencimento: ${company.nextDueDate ? company.nextDueDate.toISOString().slice(0, 10) : 'não definido'}`);
}

async function suspend(args) {
  const company = await findCompanyOrThrow(args.company);
  company.subscriptionStatus = 'suspended';
  await company.save();
  console.log(`${company.name} suspensa.`);
}

async function remove(args) {
  const company = await findCompanyOrThrow(args.company);
  const ok = args.yes || (await confirm(`Tem certeza que deseja EXCLUIR "${company.name}" e todos os seus usuários?`));
  if (!ok) {
    console.log('Operação cancelada.');
    return;
  }
  await User.deleteMany({ companyId: company._id });
  await company.deleteOne();
  console.log(`Empresa "${company.name}" e seus usuários foram excluídos.`);
}

const EDITABLE_FIELDS = ['name', 'cnpj', 'segment', 'price', 'plan', 'subscriptionStatus'];

async function edit(args) {
  const company = await findCompanyOrThrow(args.company);
  if (!EDITABLE_FIELDS.includes(args.field)) {
    throw new Error(`--field deve ser um de: ${EDITABLE_FIELDS.join(', ')}`);
  }
  company[args.field] = args.field === 'price' ? Number(args.value) : args.value;
  await company.save();
  console.log(`Campo "${args.field}" de ${company.name} atualizado para: ${company[args.field]}`);
}

const COMMANDS = {
  'create-company': createCompany,
  list: listCompanies,
  'set-plan': setPlan,
  'mark-paid': markPaid,
  suspend,
  delete: remove,
  edit,
};

async function main() {
  const [, , command, ...rest] = process.argv;
  const handler = COMMANDS[command];

  if (!handler) {
    console.log(`Comando desconhecido: ${command || '(nenhum)'}`);
    console.log(`Comandos disponíveis: ${Object.keys(COMMANDS).join(', ')}`);
    process.exit(1);
  }

  await connectDB();
  await handler(parseArgs(rest));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
