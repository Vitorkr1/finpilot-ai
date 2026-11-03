const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido.');
const name = z.string().trim().min(1).max(200);
const text = (max = 4000) => z.string().trim().max(max);
const email = z.string().trim().toLowerCase().email().max(254);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Data inválida.');
const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const quantity = z.number().finite().min(0).max(1000000);
const money = z.number().finite().min(0).max(1000000000).refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 0.0001, 'Use no máximo duas casas decimais.');
const imageUrl = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password;
}, 'Use uma imagem enviada pelo sistema.');
const httpError = (status, message) => Object.assign(new Error(message), { status });

function validateId(req, res, next, value) {
  if (!objectId.safeParse(value).success) return res.status(400).json({ error: 'Identificador inválido.' });
  next();
}

module.exports = { objectId, name, text, email, date, time, quantity, money, imageUrl, httpError, validateId };
