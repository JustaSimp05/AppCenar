const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  rol: { type: String, enum: ['cliente', 'delivery', 'comercio', 'admin'], required: true },
  fotoPerfil: { type: String },           // ruta de la imagen subida (Multer se agregará luego)
  nombreComercio: { type: String },       // solo para comercio
  logoComercio: { type: String },         // solo para comercio
  horaApertura: { type: String },         // solo para comercio
  horaCierre: { type: String },           // solo para comercio
  tipoComercio: { type: String },         // placeholder por ahora
  isActive: { type: Boolean, default: false },
  activationToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
