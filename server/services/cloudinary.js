// Único ponto de contato com o Cloudinary (Seção 3/11 do spec).
// Upload de fotos de OS e assinaturas NUNCA vai para o disco local — o
// Render free apaga tudo a cada reinício/deploy.
const { v2: cloudinary } = require('cloudinary');

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    const err = new Error('Cloudinary não configurado — defina CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET no .env');
    err.status = 503;
    throw err;
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

async function uploadBuffer(buffer, folder) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
    stream.end(buffer);
  });
}

module.exports = { uploadBuffer };
