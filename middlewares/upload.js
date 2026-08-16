const multer = require('multer');
const path = require('path');
const fs = require('fs');

const avatarDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const receiptDir = path.join(__dirname, '..', 'public', 'uploads', 'receipts');
if (!fs.existsSync(receiptDir)) fs.mkdirSync(receiptDir, { recursive: true });

const IMAGE_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const RECEIPT_TYPES = [...IMAGE_TYPES, '.pdf'];
const RECEIPT_MIMES = [...IMAGE_MIMES, 'application/pdf'];

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  // Checa extensão E o mimetype declarado pelo navegador — checar só a
  // extensão permite renomear qualquer arquivo pra ".jpg" e passar batido.
  if (IMAGE_TYPES.includes(ext) && IMAGE_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Formato de imagem não suportado. Use JPG, PNG ou WEBP.'));
}

function receiptFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (RECEIPT_TYPES.includes(ext) && RECEIPT_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Formato não suportado. Use JPG, PNG, WEBP ou PDF.'));
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}-${Date.now()}${ext}`);
  }
});

const receiptStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, receiptDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user._id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 3 * 1024 * 1024 } // 3MB
});

const receiptUpload = multer({
  storage: receiptStorage,
  fileFilter: receiptFileFilter,
  limits: { fileSize: 8 * 1024 * 1024 } // 8MB (PDFs de boleto costumam ser maiores que fotos)
});

// Upload de extrato OFX — fica só em memória (nunca grava em disco), porque
// não precisamos guardar o arquivo cru, só os dados já extraídos dele.
const OFX_TYPES = ['.ofx', '.qfx'];
function ofxFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (OFX_TYPES.includes(ext)) return cb(null, true);
  cb(new Error('Formato inválido. Envie o extrato em .ofx ou .qfx.'));
}

const ofxUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: ofxFileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5MB
});

// Upload de CSV — também só em memória, mesmo raciocínio do OFX.
const CSV_TYPES = ['.csv'];
function csvFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (CSV_TYPES.includes(ext)) return cb(null, true);
  cb(new Error('Formato inválido. Envie um arquivo .csv.'));
}

const csvUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: csvFileFilter,
  limits: { fileSize: 3 * 1024 * 1024, files: 1 } // 3MB
});

module.exports = avatarUpload; // compatibilidade retroativa (upload.single('avatar'))
module.exports.receiptUpload = receiptUpload;
module.exports.ofxUpload = ofxUpload;
module.exports.csvUpload = csvUpload;
