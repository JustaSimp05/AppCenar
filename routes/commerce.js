const express = require('express');
const router = express.Router();

const requireCommerce = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'comercio') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireCommerce, (req, res) => {
  res.render('commerce/home', {
    title: 'Home Comercio',
    layout: 'layouts/layout'
  });
});

module.exports = router;
