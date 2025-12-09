const express = require('express');
const router = express.Router();

const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'admin') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/home', requireAdmin, (req, res) => {
  res.render('admin/home', {
    title: 'Home Admin',
    layout: 'layouts/layout'
  });
});

module.exports = router;
