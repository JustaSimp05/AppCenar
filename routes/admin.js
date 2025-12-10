const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const fs = require('fs'); 
const path = require('path');
const multer = require('multer');

// Modelos
const User = require('../models/User');
const Commerce = require('../models/Commerce');
const Order = require('../models/Order');
const Config = require('../models/Config');
const CommerceType = require('../models/CommerceType');
const Product = require('../models/Product');
const Favorite = require('../models/Favorite');

// --- CONFIGURACIÓN DE MULTER PARA ICONOS (CARPETA 'iconos') ---
const storageTypes = multer.diskStorage({
  destination: (req, file, cb) => {
    // AQUÍ ES DONDE CAMBIAMOS LA RUTA A TU CARPETA ESPECÍFICA
    const uploadPath = 'public/uploads/iconos/'; 
    
    // Crear carpeta si no existe (por seguridad)
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const uploadTypes = multer({ storage: storageTypes });
// --------------------------------------------------------------

// Middleware Admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'admin') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

/* =========================
   1. DASHBOARD (HOME) 
   ========================= */
router.get('/home', requireAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    const [
      ordersTotal,
      ordersToday,
      commercesActive,
      commercesInactive,
      clientsActive,
      clientsInactive,
      deliveryActive,
      deliveryInactive,
      productsTotal
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ creadoEn: { $gte: startOfDay } }),
      Commerce.countDocuments({ isActive: true }),
      Commerce.countDocuments({ isActive: false }),
      User.countDocuments({ rol: 'cliente', isActive: true }),
      User.countDocuments({ rol: 'cliente', isActive: false }),
      User.countDocuments({ rol: 'delivery', isActive: true }),
      User.countDocuments({ rol: 'delivery', isActive: false }),
      Product.countDocuments()
    ]);

    res.render('admin/home', {
      title: 'Dashboard Admin',
      layout: 'layouts/layout',
      user: req.session.user,
      stats: {
        ordersTotal,
        ordersToday,
        commerces: { active: commercesActive, inactive: commercesInactive },
        clients: { active: clientsActive, inactive: clientsInactive },
        deliveries: { active: deliveryActive, inactive: deliveryInactive },
        productsTotal
      }
    });
  } catch (error) {
    console.error(error);
    res.redirect('/auth/login');
  }
});

/* ========================================================
   2. LISTADO DE CLIENTES
   ======================================================== */
router.get('/clients', requireAdmin, async (req, res) => {
  try {
    const clients = await User.find({ rol: 'cliente' }).lean();
    for (let client of clients) {
      client.orderCount = await Order.countDocuments({ cliente: client._id });
    }
    res.render('admin/clients', {
      title: 'Listado de Clientes',
      layout: 'layouts/layout',
      clients
    });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/home');
  }
});

router.post('/clients/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    req.flash('success_msg', `Cliente ${user.isActive ? 'activado' : 'inactivado'}`);
    res.redirect('/admin/clients');
  } catch (error) {
    req.flash('error_msg', 'Error al cambiar estado');
    res.redirect('/admin/clients');
  }
});

/* ========================================================
   3. LISTADO DE DELIVERY 
   ======================================================== */
router.get('/deliveries', requireAdmin, async (req, res) => {
  try {
    const deliveries = await User.find({ rol: 'delivery' }).lean();
    for (let delivery of deliveries) {
      delivery.deliveredCount = await Order.countDocuments({ delivery: delivery._id, estado: 'completado' });
    }
    res.render('admin/deliveries', {
      title: 'Listado de Deliveries',
      layout: 'layouts/layout',
      deliveries
    });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/home');
  }
});

router.post('/deliveries/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    req.flash('success_msg', `Delivery ${user.isActive ? 'activado' : 'inactivado'}`);
    res.redirect('/admin/deliveries');
  } catch (error) {
    req.flash('error_msg', 'Error al cambiar estado');
    res.redirect('/admin/deliveries');
  }
});

/* ========================================================
   4. LISTADO DE COMERCIOS 
   ======================================================== */
router.get('/commerces', requireAdmin, async (req, res) => {
  try {
    const commerces = await Commerce.find().populate('tipoComercio').lean();
    for (let commerce of commerces) {
      commerce.orderCount = await Order.countDocuments({ comercio: commerce._id });
    }
    res.render('admin/commerces', {
      title: 'Listado de Comercios',
      layout: 'layouts/layout',
      commerces
    });
  } catch (error) {
    res.redirect('/admin/home');
  }
});

router.post('/commerces/:id/toggle', requireAdmin, async (req, res) => {
  try {
    const commerce = await Commerce.findById(req.params.id);
    commerce.isActive = !commerce.isActive;
    if(commerce.isActive) commerce.activationToken = undefined;
    await commerce.save();
    req.flash('success_msg', `Comercio ${commerce.isActive ? 'activado' : 'inactivado'}`);
    res.redirect('/admin/commerces');
  } catch (error) {
    res.redirect('/admin/commerces');
  }
});

/* ========================================================
   5. MANTENIMIENTO ADMINISTRADORES 
   ======================================================== */
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ rol: 'admin' });
    res.render('admin/admins', {
      title: 'Mantenimiento Administradores',
      layout: 'layouts/layout',
      admins,
      currentUser: req.session.user 
    });
  } catch (error) {
    res.redirect('/admin/home');
  }
});

router.post('/admins/create', requireAdmin, [
  body('nombre').notEmpty(),
  body('apellido').notEmpty(),
  body('cedula').notEmpty(),
  body('correo').isEmail(),
  body('username').notEmpty(),
  body('password').isLength({ min: 6 }),
  body('password2').custom((val, { req }) => val === req.body.password)
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error_msg', 'Error en validación: ' + errors.array()[0].msg);
    return res.redirect('/admin/admins');
  }

  try {
    const { nombre, apellido, cedula, correo, username, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);

    await User.create({
      nombre, apellido, cedula, correo, username, passwordHash,
      rol: 'admin', isActive: true 
    });
    
    req.flash('success_msg', 'Administrador creado');
    res.redirect('/admin/admins');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error creando admin (posible duplicado)');
    res.redirect('/admin/admins');
  }
});

router.post('/admins/:id/toggle', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.user.id) {
    req.flash('error_msg', 'No puedes desactivar tu propia cuenta');
    return res.redirect('/admin/admins');
  }
  try {
    const user = await User.findById(req.params.id);
    user.isActive = !user.isActive;
    await user.save();
    res.redirect('/admin/admins');
  } catch (error) {
    res.redirect('/admin/admins');
  }
});

router.post('/admins/:id/edit', requireAdmin, async (req, res) => {
  if (req.params.id === req.session.user.id) {
    req.flash('error_msg', 'No puedes editar tu propia cuenta desde aquí');
    return res.redirect('/admin/admins');
  }
  try {
    const { nombre, apellido, cedula, correo, username, password, password2 } = req.body;
    
    const updateData = { nombre, apellido, cedula, correo, username };
    
    if (password && password.length >= 6) {
      if (password !== password2) {
        req.flash('error_msg', 'Contraseñas no coinciden');
        return res.redirect('/admin/admins');
      }
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    await User.findByIdAndUpdate(req.params.id, updateData);
    req.flash('success_msg', 'Administrador actualizado');
    res.redirect('/admin/admins');
  } catch (error) {
    req.flash('error_msg', 'Error actualizando admin');
    res.redirect('/admin/admins');
  }
});

/* ========================================================
   6. TIPOS DE COMERCIO (USANDO LA CARPETA 'iconos')
   ======================================================== */
router.get('/commerce-types', requireAdmin, async (req, res) => {
  try {
    const types = await CommerceType.find().lean();
    for (let type of types) {
      type.count = await Commerce.countDocuments({ tipoComercio: type._id });
    }
    res.render('admin/commerce_types', {
      title: 'Tipos de Comercio',
      layout: 'layouts/layout',
      types
    });
  } catch (error) {
    res.redirect('/admin/home');
  }
});

router.get('/commerce-types/new', requireAdmin, (req, res) => {
  res.render('admin/commerce_type_form', { title: 'Nuevo Tipo', layout: 'layouts/layout' });
});

// CREAR TIPO COMERCIO (Lógica de limpieza de URL)
router.post('/commerce-types/new', requireAdmin, uploadTypes.single('icono'), async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    
    let iconoPath = null;
    if (req.file) {
        // CORRECCIÓN: Guardar en formato URL web (/uploads/iconos/archivo.png)
        // 1. Quitar backslashes de Windows
        let rawPath = req.file.path.replace(/\\/g, "/"); 
        // 2. Quitar 'public' del inicio para que el navegador lo encuentre
        iconoPath = rawPath.replace("public", "");
    }

    await CommerceType.create({
      nombre,
      descripcion,
      icono: iconoPath
    });
    req.flash('success_msg', 'Tipo de comercio creado');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error creando tipo');
    res.redirect('/admin/commerce-types/new');
  }
});

router.get('/commerce-types/:id/edit', requireAdmin, async (req, res) => {
  const type = await CommerceType.findById(req.params.id);
  res.render('admin/commerce_type_form', { 
    title: 'Editar Tipo', 
    layout: 'layouts/layout', 
    type, 
    isEdit: true 
  });
});

// EDITAR TIPO COMERCIO
router.post('/commerce-types/:id/edit', requireAdmin, uploadTypes.single('icono'), async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const update = { nombre, descripcion };
    
    if (req.file) {
        let rawPath = req.file.path.replace(/\\/g, "/");
        update.icono = rawPath.replace("public", "");
    }
    
    await CommerceType.findByIdAndUpdate(req.params.id, update);
    req.flash('success_msg', 'Tipo actualizado');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    console.error(error);
    res.redirect('/admin/commerce-types');
  }
});

router.get('/commerce-types/:id/delete', requireAdmin, async (req, res) => {
  const type = await CommerceType.findById(req.params.id);
  res.render('admin/commerce_type_delete', { type, layout: 'layouts/layout' });
});

router.post('/commerce-types/:id/delete', requireAdmin, async (req, res) => {
  try {
    const typeId = req.params.id;
    const commercesToDelete = await Commerce.find({ tipoComercio: typeId }).select('_id');
    const commerceIds = commercesToDelete.map(c => c._id);

    if (commerceIds.length > 0) {
        await Favorite.deleteMany({ comercio: { $in: commerceIds } });
    }

    await Commerce.deleteMany({ tipoComercio: typeId });
    await CommerceType.findByIdAndDelete(typeId);

    req.flash('success_msg', 'Tipo, comercios y favoritos asociados eliminados');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    req.flash('error_msg', 'Error eliminando');
    res.redirect('/admin/commerce-types');
  }
});

/* ========================================================
   7. CONFIGURACIÓN 
   ======================================================== */
router.get('/config', requireAdmin, async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) config = new Config();
    res.render('admin/config', { title: 'Configuración', layout: 'layouts/layout', config });
  } catch (error) {
    console.error(error);
    res.redirect('/admin/home');
  }
});

router.post('/config', requireAdmin, async (req, res) => {
  try {
    const { itbis, costoEntrega, tiempoEntrega } = req.body;

    let errors = [];
    const itbisVal = parseFloat(itbis);
    if (isNaN(itbisVal) || itbisVal < 0) {
      errors.push('El ITBIS no puede ser negativo.');
    }
    if (itbisVal > 50) { 
      errors.push('El ITBIS parece demasiado alto (máximo 50%).');
    }

    let costoVal = 0;
    if (costoEntrega) {
       costoVal = parseFloat(costoEntrega);
       if (isNaN(costoVal) || costoVal < 0) errors.push('Costo entrega no negativo.');
    }
    
    let tiempoVal = 0;
    if (tiempoEntrega) {
       tiempoVal = parseFloat(tiempoEntrega);
       if (isNaN(tiempoVal) || tiempoVal <= 0) errors.push('Tiempo entrega > 0.');
    }

    if (errors.length > 0) {
      req.flash('error_msg', errors.join(' '));
      return res.redirect('/admin/config');
    }

    const updateData = { 
        itbis: itbisVal, 
        updatedAt: Date.now() 
    };
    if(costoEntrega) updateData.costoEntrega = costoVal;
    if(tiempoEntrega) updateData.tiempoEntrega = tiempoVal;

    await Config.findOneAndUpdate({}, updateData, { upsert: true, new: true });

    req.flash('success_msg', 'Configuración actualizada correctamente');
    res.redirect('/admin/config');

  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error guardando configuración');
    res.redirect('/admin/config');
  }
});

module.exports = router;