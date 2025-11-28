const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

// GET login
router.get('/login', (req, res) => {
  if (req.session.user) {
    const homes = {
      cliente: '/client/home',
      comercio: '/commerce/home',
      delivery: '/delivery/home',
      admin: '/admin/home'
    };
    return res.redirect(homes[req.session.user.rol]);
  }
  res.render('auth/login', { 
    title: 'AppCenar - Login',
    layout: 'layouts/layout'
  });
});

// POST login
router.post(
  '/login',
  [
    body('identifier').notEmpty().withMessage('Usuario o correo es requerido'),
    body('password').notEmpty().withMessage('Contraseña es requerida')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect('/auth/login');
    }

    const { identifier, password } = req.body;

    try {
      const user = await User.findOne({
        $or: [{ username: identifier }, { correo: identifier }]
      });

      if (!user) {
        req.flash('error_msg', 'Credenciales incorrectas');
        return res.redirect('/auth/login');
      }

      if (!user.isActive) {
        req.flash('error_msg', 'Tu cuenta está inactiva. Revisa tu correo o contacta un administrador.');
        return res.redirect('/auth/login');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        req.flash('error_msg', 'Credenciales incorrectas');
        return res.redirect('/auth/login');
      }

      req.session.user = {
        id: user._id,
        username: user.username,
        rol: user.rol
      };

      const homes = {
        cliente: '/client/home',
        comercio: '/commerce/home',
        delivery: '/delivery/home',
        admin: '/admin/home'
      };
      return res.redirect(homes[user.rol]);
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      return res.redirect('/auth/login');
    }
  }
);

// LOGOUT
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// GET registro cliente/delivery
router.get('/register/client', (req, res) => {
  res.render('auth/register_client', {
    title: 'Registro Cliente/Delivery',
    layout: 'layouts/layout'
  });
});

// POST registro cliente/delivery
router.post(
  '/register/client',
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('apellido').notEmpty().withMessage('Apellido requerido'),
    body('telefono').notEmpty().withMessage('Teléfono requerido'),
    body('correo').isEmail().withMessage('Correo inválido'),
    body('username').notEmpty().withMessage('Usuario requerido'),
    body('rol').isIn(['cliente', 'delivery']).withMessage('Rol inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
    body('password2').custom((v, { req }) => v === req.body.password).withMessage('Las contraseñas no coinciden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect('/auth/register/client');
    }

    const { nombre, apellido, telefono, correo, username, rol, password } = req.body;

    try {
      const exists = await User.findOne({ $or: [{ correo }, { username }] });
      if (exists) {
        req.flash('error_msg', 'Correo o usuario ya existe');
        return res.redirect('/auth/register/client');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const activationToken = crypto.randomBytes(20).toString('hex');

      await User.create({
        nombre,
        apellido,
        telefono,
        correo,
        username,
        passwordHash,
        rol,
        isActive: true,
        activationToken
      });

      req.flash('success_msg', 'Registro exitoso. Ya puedes iniciar sesión.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      res.redirect('/auth/register/client');
    }
  }
);

// GET registro comercio
router.get('/register/commerce', (req, res) => {
  res.render('auth/register_commerce', {
    title: 'Registro Comercio',
    layout: 'layouts/layout'
  });
});

// POST registro comercio
router.post(
  '/register/commerce',
  [
    body('nombreComercio').notEmpty().withMessage('Nombre del comercio requerido'),
    body('telefono').notEmpty().withMessage('Teléfono requerido'),
    body('correo').isEmail().withMessage('Correo inválido'),
    body('username').notEmpty().withMessage('Usuario requerido'),
    body('horaApertura').notEmpty().withMessage('Hora apertura requerida'),
    body('horaCierre').notEmpty().withMessage('Hora cierre requerida'),
    body('tipoComercio').notEmpty().withMessage('Tipo de comercio requerido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
    body('password2').custom((v, { req }) => v === req.body.password).withMessage('Las contraseñas no coinciden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect('/auth/register/commerce');
    }

    const { nombreComercio, telefono, correo, username, horaApertura, horaCierre, tipoComercio, password } = req.body;

    try {
      const exists = await User.findOne({ $or: [{ correo }, { username }] });
      if (exists) {
        req.flash('error_msg', 'Correo o usuario ya existe');
        return res.redirect('/auth/register/commerce');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const activationToken = crypto.randomBytes(20).toString('hex');

      await User.create({
        nombre: nombreComercio,
        apellido: '',
        telefono,
        correo,
        username,
        passwordHash,
        rol: 'comercio',
        nombreComercio,
        horaApertura,
        horaCierre,
        tipoComercio,
        isActive: true,
        activationToken
      });

      req.flash('success_msg', 'Comercio registrado. Ya puedes iniciar sesión.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      res.redirect('/auth/register/commerce');
    }
  }
);

module.exports = router;
