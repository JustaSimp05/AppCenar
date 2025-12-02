const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  rol: { type: String, enum: ['cliente', 'delivery', 'comercio', 'admin'], required: true },
  fotoPerfil: { type: String }, // ruta imagen, Multer
  nombreComercio: { type: String }, // solo para comercio
  logoComercio: { type: String }, // solo para comercio
  horaApertura: { type: String }, // solo para comercio
  horaCierre: { type: String }, // solo para comercio
  tipoComercio: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceType' },
  isActive: { type: Boolean, default: false },
  activationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
