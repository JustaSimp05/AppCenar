const express = require('express');
const User = require('../models/User'); // Asegúrate de tener el path correcto
const router = express.Router();

const requireClient = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'cliente') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireClient, async (req, res) => {
  // Busca el usuario en la base para obtener la foto
  const user = await User.findById(req.session.user.id);
  res.render('client/home', {
    title: 'Home Cliente',
    layout: 'layouts/layout',
    user // lo mandas completo
  });
});

module.exports = router;
