const whatsapp = require('../services/whatsapp');
const asyncHandler = require('../utils/asyncHandler');
const { logAction } = require('../services/audit');

const connect = asyncHandler(async (req, res) => {
  const status = await whatsapp.connect(req.user.companyId);
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'connect', entity: 'WhatsApp' });
  res.status(202).json(status);
});

const status = asyncHandler(async (req, res) => {
  res.json(whatsapp.getStatus(req.user.companyId));
});

const disconnect = asyncHandler(async (req, res) => {
  await whatsapp.disconnect(req.user.companyId);
  await logAction({ companyId: req.user.companyId, userId: req.user._id, action: 'disconnect', entity: 'WhatsApp' });
  res.status(204).end();
});

module.exports = { connect, status, disconnect };
