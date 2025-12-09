const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const upload = require('../config/upload'); // Importante para la foto de perfil

// Middleware de seguridad
const requireDelivery = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'delivery') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

// =========================================
// DASHBOARD (HOME)
// =========================================
router.get('/home', requireDelivery, async (req, res) => {
  try {
    const deliveryId = req.session.user.id;
    // Traemos al usuario completo para asegurar que la foto/nombre estén actualizados
    const user = await User.findById(deliveryId);

    // 1. Pedidos DISPONIBLES (En proceso, sin delivery asignado)
    const availableOrders = await Order.find({
      estado: 'en proceso',
      delivery: null
    })
    .populate('comercio', 'nombreComercio direccion telefono')
    .populate('direccion')
    .sort({ creadoEn: 1 }); // Los más antiguos primero

    // 2. Mis Pedidos ACTIVOS (En proceso, asignados a MÍ)
    const myActiveOrders = await Order.find({
      delivery: deliveryId,
      estado: 'en proceso'
    })
    .populate('comercio', 'nombreComercio telefono')
    .populate('cliente', 'nombre apellido telefono')
    .populate('direccion')
    .populate('productos.producto', 'nombre')
    .sort({ creadoEn: 1 });

    // 3. Historial (Completados por MÍ)
    const historyOrders = await Order.find({
      delivery: deliveryId,
      estado: 'completado'
    })
    .sort({ creadoEn: -1 })
    .limit(10);

    res.render('delivery/home', {
      title: 'Home Delivery',
      layout: 'layouts/layout',
      user, // Objeto usuario real (no solo el de sesión)
      availableOrders,
      myActiveOrders,
      historyOrders
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando dashboard');
    res.redirect('/auth/login');
  }
});

// =========================================
// GESTIÓN DE PEDIDOS
// =========================================

// POST: Tomar pedido
router.post('/orders/:id/take', requireDelivery, async (req, res) => {
  try {
    const orderId = req.params.id;
    const deliveryId = req.session.user.id;

    // Verificar si sigue disponible
    const order = await Order.findOne({ _id: orderId, delivery: null, estado: 'en proceso' });

    if (!order) {
      req.flash('error_msg', 'El pedido ya no está disponible o fue tomado por otro.');
      return res.redirect('/delivery/home');
    }

    order.delivery = deliveryId;
    await order.save();

    req.flash('success_msg', 'Pedido asignado. ¡A trabajar!');
    res.redirect('/delivery/home');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al tomar pedido');
    res.redirect('/delivery/home');
  }
});

// POST: Completar pedido
router.post('/orders/:id/complete', requireDelivery, async (req, res) => {
  try {
    const orderId = req.params.id;
    const deliveryId = req.session.user.id;

    const order = await Order.findOneAndUpdate(
      { _id: orderId, delivery: deliveryId, estado: 'en proceso' },
      { estado: 'completado' }
    );

    if (order) {
      req.flash('success_msg', 'Pedido entregado correctamente');
    } else {
      req.flash('error_msg', 'No se pudo completar el pedido');
    }
    res.redirect('/delivery/home');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error al completar pedido');
    res.redirect('/delivery/home');
  }
});

// =========================================
// PERFIL DELIVERY
// =========================================

// GET: Ver Perfil
router.get('/profile', requireDelivery, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('delivery/profile', {
      title: 'Mi Perfil Delivery',
      layout: 'layouts/layout',
      user
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error cargando perfil');
    res.redirect('/delivery/home');
  }
});

// POST: Actualizar Perfil
router.post('/profile', requireDelivery, upload.single('fotoPerfil'), async (req, res) => {
  try {
    const { nombre, apellido, telefono } = req.body;
    const updateData = { nombre, apellido, telefono };

    if (req.file) {
      updateData.fotoPerfil = `/uploads/${req.file.filename}`;
    }

    await User.findByIdAndUpdate(req.session.user.id, updateData);

    // Actualizar nombre en sesión para el navbar
    if (req.session.user) {
        req.session.user.username = nombre; 
    }

    req.flash('success_msg', 'Perfil actualizado correctamente');
    res.redirect('/delivery/profile');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error actualizando perfil');
    res.redirect('/delivery/profile');
  }
});

module.exports = router;