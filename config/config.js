require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  mongoUri: process.env.MONGODB_URI,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  cookieSecret: process.env.COOKIE_SECRET,
  csrfSecret: process.env.CSRF_SECRET,

  // Groq — IA gratuita (https://console.groq.com/keys)
  groqApiKey: process.env.GROQ_API_KEY,

  // Resend — e-mail transacional gratuito até 3.000 e-mails/mês (https://resend.com/api-keys)
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM || 'FinPilot AI <onboarding@resend.dev>',

  // Versão de build: um número que muda a cada vez que o servidor reinicia
  // (ou seja, a cada deploy). Usada como "?v=" nos arquivos CSS/JS próprios
  // pra forçar o navegador a buscar a versão nova em vez de usar uma
  // guardada em cache de antes da atualização — sem isso, quem já tinha o
  // site aberto continua rodando o JS antigo até limpar o cache manualmente.
  buildVersion: Date.now(),

  bankTypes: [
    'Conta Corrente',
    'Conta Poupança',
    'Carteira',
    'Conta Digital',
    'Cartão',
    'Investimento',
    'PIX'
  ],

  transactionMethods: [
    'PIX',
    'Cartão',
    'Boleto',
    'TED',
    'DOC',
    'Dinheiro',
    'Transferência'
  ]
};
