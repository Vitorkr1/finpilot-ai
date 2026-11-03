const mongoose = require('mongoose');
const { httpError } = require('./validation');

async function transaction(work) {
  try { return await mongoose.connection.transaction(work, { readPreference: 'primary' }); }
  catch (error) {
    if (error.code === 20 || error.codeName === 'IllegalOperation') {
      throw httpError(503, 'Esta operação precisa de MongoDB com replica set, como o MongoDB Atlas.');
    }
    throw error;
  }
}

module.exports = transaction;
