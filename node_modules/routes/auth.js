const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const Commerce = require('../models/Commerce');
const CommerceType = require('../models/CommerceType');
const { sendMail } = require('../config/mailer');
const upload = require('../config/upload');

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

// POST login (clientes / delivery / admin / comercio)
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
      // 1) Buscar en User (cliente / delivery / admin / comercio “viejo”)
      let user = await User.findOne({
        $or: [{ username: identifier }, { correo: identifier }]
      });

      let rolSesion = null;
      let usernameSesion = null;
      let passwordHash = null;
      let isActive = false;

      if (user) {
        rolSesion = user.rol;
        usernameSesion = user.username;
        passwordHash = user.passwordHash;
        isActive = user.isActive;
      } else {
        // 2) Si no es User, buscar en Commerce por correo
        const commerce = await Commerce.findOne({ correo: identifier });
        if (!commerce) {
          req.flash('error_msg', 'Credenciales incorrectas');
          return res.redirect('/auth/login');
        }

        rolSesion = 'comercio';
        usernameSesion = commerce.nombreComercio; // lo que quieres mostrar en la sesión
        passwordHash = commerce.passwordHash;
        isActive = commerce.isActive;

        // Guardar id en la misma clave para que el resto del código funcione
        user = { id: commerce.id };
      }

      if (!isActive) {
        req.flash(
          'error_msg',
          'Tu cuenta está inactiva. Revisa tu correo o contacta un administrador.'
        );
        return res.redirect('/auth/login');
      }

      const isMatch = await bcrypt.compare(password, passwordHash);
      if (!isMatch) {
        req.flash('error_msg', 'Credenciales incorrectas');
        return res.redirect('/auth/login');
      }

      req.session.user = {
        id: user.id,
        username: usernameSesion,
        rol: rolSesion
      };

      const homes = {
        cliente: '/client/home',
        comercio: '/commerce/home',
        delivery: '/delivery/home',
        admin: '/admin/home'
      };

      return res.redirect(homes[rolSesion] || '/');
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

await sendMail({
  to: user.correo,
  subject: 'AppCenar - Restablecer contraseña',
  html: `
    <p>Hola ${user.nombre},</p>
    <p>Has solicitado restablecer tu contraseña de AppCenar.</p>
    <p>Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>Si no fuiste tú, puedes ignorar este correo.</p>
  `
});
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
  upload.single('fotoPerfil'),                 // ← agregar ESTO aquí
  [
    body('nombre').notEmpty().withMessage('Nombre requerido'),
    body('apellido').notEmpty().withMessage('Apellido requerido'),
    body('telefono').notEmpty().withMessage('Teléfono requerido'),
    body('correo').isEmail().withMessage('Correo inválido'),
    body('username').notEmpty().withMessage('Usuario requerido'),
    body('rol').isIn(['cliente', 'delivery']).withMessage('Rol inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
    body('password2')
      .custom((v, { req }) => v === req.body.password)
      .withMessage('Las contraseñas no coinciden')
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
        fotoPerfil: req.file ? `/uploads/${req.file.filename}` : null,
        isActive: false,
        activationToken
      });

      const activationLink = `${req.protocol}://${req.get('host')}/auth/activate/${activationToken}`;

      await sendMail({
        to: correo,
        subject: 'AppCenar - Activa tu cuenta',
        html: `
          <p>Hola ${nombre},</p>
          <p>Gracias por registrarte en AppCenar.</p>
          <p>Activa tu cuenta haciendo clic en el siguiente enlace:</p>
          <p><a href="${activationLink}">${activationLink}</a></p>
        `
      });

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
router.get('/register/commerce', async (req, res) => {
  try {
    const tipos = await CommerceType.find().sort({ nombre: 1 });
    res.render('auth/register_commerce', {
      title: 'Registro Comercio',
      layout: 'layouts/layout',
      tiposComercio: tipos
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando tipos de comercio');
    res.redirect('/auth/login');
  }
});


// POST registro comercio
router.post(
  '/register/commerce',
  upload.single('logoComercio'),
  [
    body('nombreComercio').notEmpty().withMessage('Nombre del comercio requerido'),
    body('telefono').notEmpty().withMessage('Teléfono requerido'),
    body('correo').isEmail().withMessage('Correo inválido'),
    body('horaApertura').notEmpty().withMessage('Hora apertura requerida'),
    body('horaCierre').notEmpty().withMessage('Hora cierre requerida'),
    body('tipoComercio').notEmpty().withMessage('Tipo de comercio requerido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
    body('password2')
      .custom((v, { req }) => v === req.body.password)
      .withMessage('Las contraseñas no coinciden')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join('. '));
      return res.redirect('/auth/register/commerce');
    }

    const {
      nombreComercio,
      telefono,
      correo,
      horaApertura,
      horaCierre,
      tipoComercio,
      password
    } = req.body;

    try {
      const exists = await Commerce.findOne({ correo });
      if (exists) {
        req.flash('error_msg', 'El correo ya existe para un comercio');
        return res.redirect('/auth/register/commerce');
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const activationToken = crypto.randomBytes(20).toString('hex');

      await Commerce.create({
        nombreComercio,
        telefono,
        correo,
        horaApertura,
        horaCierre,
        tipoComercio,
        passwordHash,
        logoComercio: req.file ? `/uploads/${req.file.filename}` : null,
        isActive: false,
        activationToken
      });

      const activationLink = `${req.protocol}://${req.get(
        'host'
      )}/auth/activate/${activationToken}`;

      await sendMail({
        to: correo,
        subject: 'AppCenar - Activa tu comercio',
        html: `
          <p>Hola ${nombreComercio},</p>
          <p>Gracias por registrar tu comercio en AppCenar.</p>
          <p>Activa tu cuenta haciendo clic en el siguiente enlace:</p>
          <p><a href="${activationLink}">${activationLink}</a></p>
        `
      });

      req.flash(
        'success_msg',
        'Comercio registrado. Revisa tu correo para activar tu cuenta.'
      );
      res.redirect('/auth/login');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error en el servidor');
      res.redirect('/auth/register/commerce');
    }
  }
);


router.get('/activate-commerce/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const commerce = await Commerce.findOne({ activationToken: token });
    if (!commerce) {
      req.flash('error_msg', 'Enlace de activación inválido.');
      return res.redirect('/auth/login');
    }

    commerce.isActive = true;
    commerce.activationToken = undefined;
    await commerce.save();

    req.flash('success_msg', 'Comercio activado. Ya puedes iniciar sesión.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error en el servidor');
    res.redirect('/auth/login');
  }
});

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


// Cómo usarlo para activar tu cuenta

// En el navegador ve a:

// http://localhost:3000/auth/force-activate/TU_USERNAME

// Ejemplo, si tu usuario es rafa:

// http://localhost:3000/auth/force-activate/rafa

// Si existe, verás un mensaje en la página tipo:

// Usuario rafa activado

// Ahora ve a /auth/login, pon ese usuario y contraseña: ya no debería salir “Tu cuenta está inactiva”.

router.get('/c-activate/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.send('Usuario no encontrado');
    }
    user.isActive = true;
    user.activationToken = undefined;
    await user.save();
    res.send(`Usuario ${username} activado`);
  } catch (err) {
    console.error(err);
    res.send('Error activando usuario');
  }
});


// Activar comercio sin usar el correo de activación (solo para desarrollo)
//http://localhost:3000/auth/c-activate-commerce/correo@comercio.com
router.get('/c-activate-commerce/:correo', async (req, res) => {
  const { correo } = req.params;

  try {
    const commerce = await Commerce.findOne({ correo });
    if (!commerce) {
      return res.send('Comercio no encontrado');
    }

    commerce.isActive = true;
    commerce.activationToken = undefined;
    await commerce.save();

    res.send(`Comercio con correo ${correo} activado`);
  } catch (err) {
    console.error(err);
    res.send('Error activando comercio');
  }
});

module.exports = router;
