const { z } = require('zod');
const v = require('../utils/validation');

const clientSchema = z.object({
  name: v.name,
  phone: v.text(40).optional(),
  email: z.union([v.email, z.string().trim().length(0)]).optional(),
  document: v.text(40).optional(),
  address: v.text(500).optional(),
  notes: v.text().optional(),
});
module.exports = { clientSchema };
