const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Nome é obrigatório'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'E-mail é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'E-mail inválido']
    },
    password: { type: String, required: [true, 'Senha é obrigatória'], minlength: 8, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar: { type: String, default: '/img/default-avatar.svg' },

    isVerified: { type: Boolean, default: true },

    refreshTokens: [{ type: String, select: false }],

    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    emailAlertsEnabled: { type: Boolean, default: true },
    emailOnEveryTransaction: { type: Boolean, default: false },

    // --- 2FA (autenticação em dois fatores via app autenticador / TOTP) ---
    twoFactorSecret: { type: String, select: false, default: null },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorBackupCodes: { type: [String], select: false, default: [] }, // hash bcrypt de cada código, não o código em si

    financialScore: { type: Number, default: 500, min: 0, max: 1000 },

    active: { type: Boolean, default: true },

    // --- Login facial ---
    // Descriptor de 128 posições gerado pelo face-api.js (face_recognition_model).
    // Não é uma foto: é uma "impressão" matemática do rosto, não dá pra
    // reconstruir a imagem original a partir dela.
    faceDescriptor: { type: [Number], select: false, default: undefined },
    faceEnabled: { type: Boolean, default: false },
    faceRegisteredAt: { type: Date, select: false },

    // Token de convite para a pessoa cadastrar o próprio rosto.
    // Gerado pelo admin (script), enviado por fora (whatsapp/email) e
    // consumido uma única vez na página /faces/register/:token.
    faceRegistrationToken: { type: String, select: false },
    faceRegistrationTokenExpires: { type: Date, select: false }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
