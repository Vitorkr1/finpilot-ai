const { createHash } = require('node:crypto');
const { z } = require('zod');

const ROUTE_DURATION_MS = 12 * 60 * 60 * 1000;
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const startSchema = z.object({ consent: z.literal(true), deviceToken: tokenSchema }).strict();
const positionSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().min(0).max(100000),
  capturedAt: z.string().datetime({ offset: true }),
}).strict();

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parsePosition(body, now = new Date()) {
  const result = positionSchema.safeParse(body);
  if (!result.success) return null;
  const capturedAt = new Date(result.data.capturedAt);
  const age = now.getTime() - capturedAt.getTime();
  if (age > 120000 || age < -30000) return null;
  return { ...result.data, capturedAt, receivedAt: now };
}

function publicSession(session) {
  return {
    _id: session._id,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    position: session.position,
    technician: session.technicianId?.name
      ? { _id: session.technicianId._id, name: session.technicianId.name }
      : undefined,
  };
}

module.exports = { ROUTE_DURATION_MS, tokenSchema, startSchema, hashToken, parsePosition, publicSession };
