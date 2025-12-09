const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  comercio: { type: mongoose.Schema.Types.ObjectId, ref: 'Commerce', required: true }
});

module.exports = mongoose.model('Category', CategorySchema);
