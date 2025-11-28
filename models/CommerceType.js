const mongoose = require('mongoose');

const CommerceTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  icon: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CommerceType', CommerceTypeSchema);
