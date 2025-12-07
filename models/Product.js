const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: { type: String },
  precio: { type: Number, required: true },
  foto: { type: String },
  categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  comercio: { type: mongoose.Schema.Types.ObjectId, ref: 'Commerce', required: true }
});

module.exports = mongoose.model('Product', ProductSchema);
