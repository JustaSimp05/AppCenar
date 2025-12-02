const mongoose = require('mongoose');

const CommerceSchema = new mongoose.Schema({
  nombreComercio: { type: String, required: true },
  telefono: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  logoComercio: { type: String },
  horaApertura: { type: String },
  horaCierre: { type: String },
  tipoComercio: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceType', required: true },
  isActive: { type: Boolean, default: false },
  activationToken: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Commerce', CommerceSchema);
