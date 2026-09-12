const AuditLog = require('../models/AuditLog');

async function logAction({ companyId = null, userId, action, entity, entityId = null, details = {} }) {
  try {
    await AuditLog.create({ companyId, userId, action, entity, entityId, details });
  } catch (err) {
    console.error('[audit] falha ao registrar log:', err.message);
  }
}

module.exports = { logAction };
