const mongoose = require('mongoose');

// Modelos
require('./User');
require('./Commerce');
require('./CommerceType');
require('./Category');
require('./Product');
require('./Order');
require('./Address');
require('./Favorite');
require('./Config');

// Conexión a MongoDB (ya está en app.js, pero aquí para referencia)
module.exports = mongoose;
