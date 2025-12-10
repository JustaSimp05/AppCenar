const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido: { type: String, required: true },
  cedula: { type: String }, 
  telefono: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  rol: { type: String, enum: ['cliente', 'delivery', 'comercio', 'admin'], required: true },
  
  fotoPerfil: { type: String }, // ruta imagen, Multer
  
  // Datos comercio
  nombreComercio: { type: String }, 
  logoComercio: { type: String }, 
  horaApertura: { type: String }, 
  horaCierre: { type: String }, 
  tipoComercio: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceType' },
  
  // Datos delivery
  estadoDelivery: {
    type: String,
    enum: ['disponible', 'ocupado'],
    default: 'disponible'
  },

  isActive: { type: Boolean, default: false },
  activationToken: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);