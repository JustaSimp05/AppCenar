const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const upload = require('../config/upload'); 

// ==================================================
// MIDDLEWARE DE SEGURIDAD (ANTI-ZOMBIE)
// ==================================================
const requireDelivery = async (req, res, next) => {
  // 1. Verificación básica de sesión
  if (!req.session.user || req.session.user.rol !== 'delivery') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }

  try {
    // 2. VERIFICACIÓN EN TIEMPO REAL (El arreglo)
    // Buscamos al usuario en la BD para ver su estado actual real
    const user = await User.findById(req.session.user.id);

    // Si el usuario no existe (fue borrado) o está inactivo (bloqueado por admin)
    if (!user || !user.isActive) {
      // MATAR LA SESIÓN ZOMBIE
      req.session.destroy((err) => {
        if (err) console.error(err);
        // No podemos usar flash después de destruir sesión, así que redirigimos con query
        res.redirect('/auth/login?error=cuenta_inactiva'); 
      });
      return; // Detenemos la ejecución aquí
    }

    // Si todo está bien, dejamos pasar
    next();

  } catch (error) {
    console.error(error);
    res.redirect('/auth/login');
  }
};

// =========================================
// DASHBOARD (HOME)
// =========================================
router.get('/home', requireDelivery, async (req, res) => {
  try {
    const deliveryId = req.session.user.id;
    const user = await User.findById(deliveryId);

    // 1. Pedidos DISPONIBLES 
    const availableOrders = await Order.find({
      estado: 'en proceso',
      delivery: null
    })
    .populate('comercio', 'nombreComercio direccion telefono')
    .populate('direccion')
    .sort({ creadoEn: 1 });

    // 2. Mis Pedidos ACTIVOS 
    const myActiveOrders = await Order.find({
      delivery: deliveryId,
      estado: 'en proceso'
    })
    .populate('comercio', 'nombreComercio telefono')
    .populate('cliente', 'nombre apellido telefono')
    .populate('direccion')
    .populate('productos.producto', 'nombre')
    .sort({ creadoEn: 1 });

    // 3. Historial 
    const historyOrders = await Order.find({
      delivery: deliveryId,
      estado: 'completado'
    })
    .sort({ creadoEn: -1 })
    .limit(10);

    res.render('delivery/home', {
      title: 'Home Delivery',
      layout: 'layouts/layout',
      user, 
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

    // Validación extra: Un delivery solo puede tener un pedido activo a la vez (Regla de negocio)
    const activeOrder = await Order.findOne({ delivery: deliveryId, estado: 'en proceso' });
    if (activeOrder) {
        req.flash('error_msg', '¡Ya tienes un pedido en curso! Termínalo antes de tomar otro.');
        return res.redirect('/delivery/home');
    }

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
      req.flash('error_msg', 'No se pudo completar el pedido (quizás no es tuyo)');
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

router.post('/profile', requireDelivery, upload.single('fotoPerfil'), async (req, res) => {
  try {
    const { nombre, apellido, telefono } = req.body;
    const updateData = { nombre, apellido, telefono };

    if (req.file) {
      updateData.fotoPerfil = `/uploads/${req.file.filename}`;
    }

    await User.findByIdAndUpdate(req.session.user.id, updateData);

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