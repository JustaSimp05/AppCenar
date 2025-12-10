const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comercio: { type: mongoose.Schema.Types.ObjectId, ref: 'Commerce', required: true },
  direccion: { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
  productos: [{
    producto: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    cantidad: { type: Number, default: 1 }
  }],
  subtotal: { type: Number, required: true },
  itbis: { type: Number, required: true },
  itbisMonto: { type: Number, required: true },
  total: { type: Number, required: true },
  estado: { type: String, enum: ['pendiente', 'en proceso', 'completado'], default: 'pendiente' },
  delivery: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  creadoEn: { type: Date, default: Date.now } 
});

module.exports = mongoose.model('Order', OrderSchema);
