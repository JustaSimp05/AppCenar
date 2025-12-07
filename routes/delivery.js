const express = require('express');
const User = require('../models/User');
const router = express.Router();

const requireDelivery = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'delivery') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireDelivery, async (req, res) => {
  const user = await User.findById(req.session.user.id);
  res.render('delivery/home', {
    title: 'Home Delivery',
    layout: 'layouts/layout',
    user
  });
});

module.exports = router;
