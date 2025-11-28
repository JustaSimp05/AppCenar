const mongoose = require('mongoose');

const CommerceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  email: { type: String, required: true, unique: true },
  logo: String,
  openHour: String,
  closeHour: String,
  type: { type: mongoose.Schema.Types.ObjectId, ref: 'CommerceType' },
  isActive: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Commerce', CommerceSchema);
