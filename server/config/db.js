const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI não definida no .env');
  }

  mongoose.connection.on('error', (err) => {
    console.error('[mongodb] erro de conexão:', err.message);
  });

  await mongoose.connect(uri);
  console.log(`[mongodb] conectado (db: ${mongoose.connection.name})`);
}

module.exports = connectDB;
