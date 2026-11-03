const multer = require('multer');

// Memória apenas — o buffer vai direto para o Cloudinary, nunca toca o disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5, fieldSize: 4096, parts: 6 },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return cb(Object.assign(new Error('Envie uma imagem JPEG, PNG, WebP ou GIF.'), { status: 400 }));
    }
    cb(null, true);
  },
});

function validImage(file) {
  const b = file.buffer;
  if (file.mimetype === 'image/jpeg') return b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  if (file.mimetype === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (file.mimetype === 'image/webp') return b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return /^GIF8[79]a$/.test(b.toString('ascii', 0, 6));
}
module.exports = { single: (field) => (req, res, next) => upload.single(field)(req, res, (error) => {
  if (error) return next(error);
  if (req.file && !validImage(req.file)) return res.status(400).json({ error: 'O conteúdo do arquivo não corresponde a uma imagem válida.' });
  next();
}) };
