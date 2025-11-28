const express = require('express');
const router = express.Router();

const requireDelivery = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'delivery') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireDelivery, (req, res) => {
  res.render('delivery/home', {
    title: 'Home Delivery',
    layout: 'layouts/layout'
  });
});

module.exports = router;
