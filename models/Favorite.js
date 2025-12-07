const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  comercio: { type: mongoose.Schema.Types.ObjectId, ref: 'Commerce', required: true }
});

module.exports = mongoose.model('Favorite', FavoriteSchema);
