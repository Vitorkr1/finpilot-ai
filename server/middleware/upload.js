const multer = require('multer');

// Memória apenas — o buffer vai direto para o Cloudinary, nunca toca o disco.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas arquivos de imagem são aceitos'));
    }
    cb(null, true);
  },
});

module.exports = upload;
