const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const WhatsAppAuthFile = require('../models/WhatsAppAuthFile');

// Mesma forma que useMultiFileAuthState do Baileys, mas persistindo cada
// "arquivo" como um documento no MongoDB em vez do disco local (Seção 8/11).
async function useMongoAuthState(companyId) {
  const readData = async (file) => {
    const doc = await WhatsAppAuthFile.findOne({ companyId, file });
    if (!doc) return null;
    try {
      return JSON.parse(doc.data, BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeData = async (data, file) => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await WhatsAppAuthFile.findOneAndUpdate(
      { companyId, file },
      { data: serialized },
      { upsert: true }
    );
  };

  const removeData = async (file) => {
    await WhatsAppAuthFile.deleteOne({ companyId, file });
  };

  const creds = (await readData('creds.json')) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              const value = await readData(`${type}-${id}.json`);
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category of Object.keys(data)) {
            for (const id of Object.keys(data[category])) {
              const value = data[category][id];
              const file = `${category}-${id}.json`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData(creds, 'creds.json'),
    clearAll: async () => {
      await WhatsAppAuthFile.deleteMany({ companyId });
    },
  };
}

async function clearAuthState(companyId) {
  await WhatsAppAuthFile.deleteMany({ companyId });
}

module.exports = { useMongoAuthState, clearAuthState };
