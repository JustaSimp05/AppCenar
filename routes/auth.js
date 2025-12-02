const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');

const router = express.Router();

/* ========== LOGIN ========== */

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

/* ========== LOGOUT ========== */

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

/* ========== OLVIDÉ MI CONTRASEÑA ========== */

// GET - formulario "Olvidé mi contraseña"
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot_password', {
    title: 'Restablecer contraseña',
    layout: 'layouts/layout'
  });
});

// POST - procesar "Olvidé mi contraseña"
router.post(
  '/forgot-password',
  [
    body('identifier').notEmpty().withMessage('Usuario o correo es requerido')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect('/auth/forgot-password');
    }

    const { identifier } = req.body;

    try {
      const user = await User.findOne({
        $or: [{ username: identifier }, { correo: identifier }]
      });

      if (!user) {
        // No revelar si existe o no
        req.flash('success_msg', 'Si el usuario existe, se ha enviado un correo con las instrucciones.');
        return res.redirect('/auth/login');
      }

      const resetToken = crypto.randomBytes(20).toString('hex');
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 1000 * 60 * 60; // 1 hora
      await user.save();

      const resetLink = `${req.protocol}://${req.get('host')}/auth/reset-password/${resetToken}`;

      // Aquí luego integras Nodemailer. Por ahora lo verás en consola.
      console.log('🔗 Enlace de restablecimiento:', resetLink);

      req.flash('success_msg', 'Si el usuario existe, se ha enviado un correo con las instrucciones.');
      return res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      return res.redirect('/auth/forgot-password');
    }
  }
);

// GET - pantalla para nueva contraseña (con token)
router.get('/reset-password/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      req.flash('error_msg', 'Enlace inválido o expirado.');
      return res.redirect('/auth/forgot-password');
    }

    res.render('auth/reset_password', {
      title: 'Nueva contraseña',
      layout: 'layouts/layout',
      token
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error en el servidor');
    return res.redirect('/auth/forgot-password');
  }
});

// POST - guardar nueva contraseña
router.post(
  '/reset-password/:token',
  [
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
    body('password2').custom((v, { req }) => v === req.body.password).withMessage('Las contraseñas no coinciden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { token } = req.params;

    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect(`/auth/reset-password/${token}`);
    }

    try {
      const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
      });

      if (!user) {
        req.flash('error_msg', 'Enlace inválido o expirado.');
        return res.redirect('/auth/forgot-password');
      }

      const { password } = req.body;
      const passwordHash = await bcrypt.hash(password, 10);

      user.passwordHash = passwordHash;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      req.flash('success_msg', 'Contraseña actualizada. Ya puedes iniciar sesión.');
      return res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      return res.redirect('/auth/forgot-password');
    }
  }
);

/* ========== REGISTRO CLIENTE / DELIVERY ========== */

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
        isActive: false,          // se crea inactivo según documento
        activationToken
      });

      // Aquí luego se envía correo de activación con activationToken
      console.log('🔗 Enlace de activación (cliente/delivery):',
        `${req.protocol}://${req.get('host')}/auth/activate/${activationToken}`);

      req.flash('success_msg', 'Registro exitoso. Revisa tu correo para activar tu cuenta.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      res.redirect('/auth/register/client');
    }
  }
);

/* ========== REGISTRO COMERCIO ========== */

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
        isActive: false, // se crea inactivo según documento
        activationToken
      });

      console.log('🔗 Enlace de activación (comercio):',
        `${req.protocol}://${req.get('host')}/auth/activate/${activationToken}`);

      req.flash('success_msg', 'Comercio registrado. Revisa tu correo para activar tu cuenta.');
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      res.redirect('/auth/register/commerce');
    }
  }
);

/* ========== ACTIVACIÓN DE CUENTA ========== */

router.get('/activate/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({ activationToken: token });

    if (!user) {
      req.flash('error_msg', 'Enlace de activación inválido.');
      return res.redirect('/auth/login');
    }

    user.isActive = true;
    user.activationToken = undefined;
    await user.save();

    req.flash('success_msg', 'Cuenta activada. Ya puedes iniciar sesión.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error en el servidor');
    res.redirect('/auth/login');
  }
});

module.exports = router;
