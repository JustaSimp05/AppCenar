const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Modelos
const User = require('../models/User');
const Commerce = require('../models/Commerce');
const Order = require('../models/Order');
const Config = require('../models/Config');
const CommerceType = require('../models/CommerceType');
const Product = require('../models/Product');

// Configuración de subida (Multer) para Iconos de Tipos de Comercio
const upload = require('../config/upload'); 

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
   =========================
*/
router.get('/home', requireAdmin, async (req, res) => {
  try {
    // Fechas para "Pedidos de hoy"
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);

    // Consultas paralelas para rendimiento
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
    // Obtener clientes y calcular cantidad de pedidos de cada uno
    const clients = await User.find({ rol: 'cliente' }).lean();
    
    // Agregamos conteo de pedidos manualmente
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

// Activar/Desactivar Cliente
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

// Activar/Desactivar Delivery
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
   ======================================================== 
*/
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const admins = await User.find({ rol: 'admin' });
    res.render('admin/admins', {
      title: 'Mantenimiento Administradores',
      layout: 'layouts/layout',
      admins,
      currentUser: req.session.user // Para evitar editarse a sí mismo
    });
  } catch (error) {
    res.redirect('/admin/home');
  }
});

// Crear Admin
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
      rol: 'admin', isActive: true // Admins nacen activos
    });
    
    req.flash('success_msg', 'Administrador creado');
    res.redirect('/admin/admins');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error creando admin (posible duplicado)');
    res.redirect('/admin/admins');
  }
});

// Activar/Desactivar Admin (Protección: No a sí mismo)
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

// Editar Admin
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
   6. TIPOS DE COMERCIO
   ======================================================== */
router.get('/commerce-types', requireAdmin, async (req, res) => {
  try {
    const types = await CommerceType.find().lean();
    // Contar comercios por tipo
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

// Formulario Crear
router.get('/commerce-types/new', requireAdmin, (req, res) => {
  res.render('admin/commerce_type_form', { title: 'Nuevo Tipo', layout: 'layouts/layout' });
});

// Procesar Crear
router.post('/commerce-types/new', requireAdmin, upload.single('icono'), async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    await CommerceType.create({
      nombre,
      descripcion,
      icono: req.file ? `/uploads/${req.file.filename}` : null
    });
    req.flash('success_msg', 'Tipo de comercio creado');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    req.flash('error_msg', 'Error creando tipo');
    res.redirect('/admin/commerce-types/new');
  }
});

// Formulario Editar
router.get('/commerce-types/:id/edit', requireAdmin, async (req, res) => {
  const type = await CommerceType.findById(req.params.id);
  res.render('admin/commerce_type_form', { 
    title: 'Editar Tipo', 
    layout: 'layouts/layout', 
    type, 
    isEdit: true 
  });
});

// Procesar Editar
router.post('/commerce-types/:id/edit', requireAdmin, upload.single('icono'), async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const update = { nombre, descripcion };
    if (req.file) update.icono = `/uploads/${req.file.filename}`;
    
    await CommerceType.findByIdAndUpdate(req.params.id, update);
    req.flash('success_msg', 'Tipo actualizado');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    res.redirect('/admin/commerce-types');
  }
});

// Eliminar (Con advertencia de cascada)
router.get('/commerce-types/:id/delete', requireAdmin, async (req, res) => {
  const type = await CommerceType.findById(req.params.id);
  res.render('admin/commerce_type_delete', { type, layout: 'layouts/layout' });
});

router.post('/commerce-types/:id/delete', requireAdmin, async (req, res) => {
  try {
    // PDF pág 22: "Eliminar este tipo de comercio y todos los comercios asociado"
    const typeId = req.params.id;
    
    // 1. Eliminar comercios de este tipo
    await Commerce.deleteMany({ tipoComercio: typeId });
    
    // 2. Eliminar el tipo
    await CommerceType.findByIdAndDelete(typeId);

    req.flash('success_msg', 'Tipo y comercios asociados eliminados');
    res.redirect('/admin/commerce-types');
  } catch (error) {
    req.flash('error_msg', 'Error eliminando');
    res.redirect('/admin/commerce-types');
  }
});

/* ========================================================
   7. CONFIGURACIÓN - Requerimiento PDF Pág. 20
   ======================================================== */
router.get('/config', requireAdmin, async (req, res) => {
  let config = await Config.findOne();
  if (!config) config = new Config();
  res.render('admin/config', { title: 'Configuración', layout: 'layouts/layout', config });
});

router.post('/config', requireAdmin, async (req, res) => {
  const { itbis } = req.body; // PDF solo exige ITBIS en pág 20, pero mantenemos extras si quieres
  await Config.findOneAndUpdate({}, { itbis, updatedAt: Date.now() }, { upsert: true });
  req.flash('success_msg', 'Configuración guardada');
  res.redirect('/admin/config');
});

module.exports = router;