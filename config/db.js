const mongoose = require('mongoose');

async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI não definido no arquivo .env');
    }

    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(uri, {
      autoIndex: process.env.NODE_ENV !== 'production'
    });

    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ Erro na conexão MongoDB:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB desconectado.');
    });
  } catch (err) {
    console.error('❌ Falha ao conectar ao MongoDB:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
