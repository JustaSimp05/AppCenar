const express = require('express');
const router = express.Router();

const requireClient = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'cliente') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireClient, (req, res) => {
  res.render('client/home', {
    title: 'Home Cliente',
    layout: 'layouts/layout'
  });
});

module.exports = router;
