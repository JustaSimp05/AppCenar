// models/Commerce.js
const mongoose = require('mongoose');

const CommerceSchema = new mongoose.Schema({
  nombreComercio: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  logoComercio: { type: String },
  horaApertura: { type: String, required: true },
  horaCierre: { type: String, required: true },
  tipoComercio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CommerceType',
    required: true
  },
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: false },
  activationToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Commerce', CommerceSchema);
