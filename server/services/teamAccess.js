const User = require('../models/User');
const { httpError } = require('../utils/validation');

async function lockTechnician(technicianId, companyId, session) {
  if (!technicianId) return null;
  // A escrita coordena as atribuições com a exclusão do membro.
  const technician = await User.findOneAndUpdate(
    { _id: technicianId, companyId, active: true, role: 'tecnico' },
    { $inc: { __v: 1 } }, { session }
  );
  if (!technician) throw httpError(400, 'Técnico não encontrado ou indisponível nesta empresa.');
  return technician;
}

module.exports = { lockTechnician };
