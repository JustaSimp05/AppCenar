const mongoose = require('mongoose');

const CommerceTypeSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  icono: { type: String }, // ruta a imagen/icono
  descripcion: { type: String }
});

module.exports = mongoose.model('CommerceType', CommerceTypeSchema);
