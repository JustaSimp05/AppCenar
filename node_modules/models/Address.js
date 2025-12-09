const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  nombre: { type: String, required: true }, // Ejemplo: Casa, Oficina
  descripcion: { type: String, required: true }
});

module.exports = mongoose.model('Address', AddressSchema);
