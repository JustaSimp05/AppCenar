const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
  itbis: { 
    type: Number, 
    required: true, 
    default: 18 // 18% por defecto
  },
  tiempoEntrega: { 
    type: Number, 
    default: 30 // minutos por defecto
  },
  costoEntrega: { 
    type: Number, 
    default: 150 // RD$150 por defecto
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Sin pre('save'): los defaults ya cubren todo

module.exports = mongoose.model('Config', ConfigSchema);
