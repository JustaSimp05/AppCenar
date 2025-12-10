const express = require('express');
const User = require('../models/User');
const Commerce = require('../models/Commerce');
const CommerceType = require('../models/CommerceType'); 
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Address = require('../models/Address');
const Favorite = require('../models/Favorite');
const Config = require('../models/Config');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); 

const router = express.Router();

// Middleware de protección para rol cliente
const requireClient = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'cliente') {
    if (req.xhr || req.headers['accept']?.includes('application/json')) {
      return res.status(401).json({ success: false, message: 'No autorizado' });
    }
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

// Configuración de multer (Crea carpeta si no existe)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'public/uploads/users/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// ===== HOME DEL CLIENTE =====
router.get('/home', requireClient, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    const tipos = await CommerceType.find({}).sort({ nombre: 1 });
    
    res.render('client/home', {
      title: 'Home Cliente - AppCenar',
      layout: 'layouts/layout',
      user,
      commerceTypes: tipos
    });
  } catch (error) {
    console.error('Error en home cliente:', error);
    req.flash('error_msg', 'Error al cargar la página');
    res.redirect('/client/home');
  }
});

// ===== LISTADO DE COMERCIOS POR TIPO =====
router.get('/commerces/:typeId', requireClient, async (req, res) => {
  try {
    const tipoId = req.params.typeId;
    const commerceType = await CommerceType.findById(tipoId);
    
    if (!commerceType) {
      req.flash('error_msg', 'Tipo de comercio no encontrado');
      return res.redirect('/client/home');
    }

    const commerces = await Commerce.find({ 
      tipoComercio: tipoId, 
      isActive: true 
    }).populate('tipoComercio', 'nombre icono');

    const favoritos = await Favorite.find({ 
      cliente: req.session.user.id 
    }).select('comercio');
    const favoritosSet = favoritos.map(fav => fav.comercio?.toString() || "");

    res.render('client/commerces', { 
      title: `Comercios - ${commerceType.nombre}`,
      layout: 'layouts/layout',
      commerceType,
      commerces,
      favoritosSet,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error en comercios por tipo:', error);
    req.flash('error_msg', 'Error al cargar comercios');
    res.redirect('/client/home');
  }
});

// ===== BÚSQUEDA DE COMERCIOS (AJAX) =====
router.get('/search-commerces', requireClient, async (req, res) => {
  try {
    const busqueda = req.query.q || '';
    const tipoId = req.query.type || '';
    
    let query = { isActive: true };
    
    if (busqueda) {
      query.nombreComercio = { $regex: busqueda, $options: 'i' };
    }
    
    if (tipoId) {
      query.tipoComercio = tipoId;
    }

    const commerces = await Commerce.find(query)
      .populate('tipoComercio', 'nombre')
      .sort({ nombreComercio: 1 });

    const favoritos = await Favorite.find({ 
      cliente: req.session.user.id 
    }).select('comercio');
    const favoritosSet = favoritos.map(fav => fav.comercio?.toString() || "");

    res.json({
      commerces,
      favoritosSet,
      total: commerces.length
    });
  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// ===== CATÁLOGO DE PRODUCTOS =====
router.get('/catalog/:commerceId', requireClient, async (req, res) => {
  try {
    const commerceId = req.params.commerceId;
    const commerce = await Commerce.findById(commerceId).populate('tipoComercio');
    
    if (!commerce || !commerce.isActive) {
      req.flash('error_msg', 'Comercio no encontrado o inactivo');
      return res.redirect('/client/home');
    }

    const categories = await Category.find({ comercio: commerceId });
    
    const categoriesWithProducts = await Promise.all(
      categories.map(async (category) => {
        const products = await Product.find({ 
          categoria: category._id, 
          comercio: commerceId 
        }).populate('categoria', 'nombre');
        
        return {
          ...category.toObject(),
          products
        };
      })
    );

    const productsWithoutCategory = await Product.find({ 
      comercio: commerceId, 
      categoria: null 
    });

    const carrito = req.session.carrito || [];
    const subtotal = carrito.reduce((sum, p) => sum + p.price * p.quantity, 0);

    const favoritos = await Favorite.find({ 
      cliente: req.session.user.id 
    }).select('comercio');

    const favoritosSet = favoritos.map(f => f.comercio.toString());
    const isFavorite = favoritosSet.includes(commerceId);

    res.render('client/catalog', { 
      carrito,
      subtotal,
      title: `Catálogo - ${commerce.nombreComercio}`,
      layout: 'layouts/layout',
      commerce,
      categories: categoriesWithProducts,
      productsWithoutCategory,
      user: req.session.user,
      favoritosSet,        
      isFavorite           
    });
  } catch (error) {
    console.error('Error en catálogo:', error);
    req.flash('error_msg', 'Error al cargar catálogo');
    res.redirect('/client/home');
  }
});

// ===== ACTUALIZAR CARRITO (AJAX) =====
router.post('/cart', requireClient, async (req, res) => {
  try {
    const { action, productId, quantity } = req.body;
    let carrito = req.session.carrito || [];

    const index = carrito.findIndex(p => p.productId === productId);

    if (action === 'add') {
      const product = await Product.findById(productId).populate('categoria', 'nombre');

      if (index !== -1) {
        carrito[index].quantity += 1;
      } else {
        carrito.push({
          productId: productId,
          name: product.nombre,
          description: product.descripcion,
          price: product.precio,
          photo: product.foto,
          category: product.categoria?.nombre || 'Sin categoría',
          commerceId: product.comercio, 
          quantity: 1
        });
      }
    }

    if (action === 'increment') {
      if (index !== -1) carrito[index].quantity += 1;
    }

    if (action === 'decrement') {
      if (index !== -1) {
        carrito[index].quantity -= 1;
        if (carrito[index].quantity <= 0) {
          carrito.splice(index, 1);
        }
      }
    }

    if (action === 'remove') {
      carrito = carrito.filter(p => p.productId !== productId);
    }

    const subtotal = carrito.reduce((sum, p) => sum + p.price * p.quantity, 0);

    req.session.carrito = carrito;

    res.json({
      success: true,
      carrito,
      subtotal,
      totalItems: carrito.reduce((sum, p) => sum + p.quantity, 0)
    });

  } catch (error) {
    console.error('Error actualizando carrito:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar carrito' });
  }
});

// ===== SELECCIÓN DE DIRECCIÓN PARA PEDIDO =====
router.get('/order/address', requireClient, async (req, res) => {
  try {
    if (!req.session.carrito || req.session.carrito.length === 0) {
      req.flash('error_msg', 'Carrito vacío');
      return res.redirect('/client/home');
    }

    const addresses = await Address.find({ cliente: req.session.user.id });
    const commerceId = req.session.carrito[0].commerceId;
    const commerce = await Commerce.findById(commerceId);

    const config = await Config.findOne() || { itbis: 18 };
    const itbis = config.itbis;

    const subtotal = req.session.carrito.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const total = subtotal + (subtotal * itbis / 100);

    res.render('client/order-address', {
      title: 'Confirmar Pedido - AppCenar',
      layout: 'layouts/layout',
      addresses,
      commerce,
      carrito: req.session.carrito,
      subtotal: subtotal.toFixed(2),
      itbis: itbis.toFixed(2),
      total: total.toFixed(2),
      user: req.session.user
    });
  } catch (error) {
    console.error('Error en dirección de pedido:', error);
    req.flash('error_msg', 'Error al cargar direcciones');
    res.redirect('/client/home');
  }
});

// ===== CREAR PEDIDO =====
router.post('/order/create', requireClient, [
  body('addressId').notEmpty().withMessage('Selecciona una dirección')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { addressId } = req.body;
    
    if (!req.session.carrito || req.session.carrito.length === 0) {
      return res.status(400).json({ success: false, error: 'Carrito vacío' });
    }

    const config = await Config.findOne() || { itbis: 18 };
    const itbisPercent = config.itbis;

    const ordersByCommerce = {};

    req.session.carrito.forEach(item => {
      const commerceId = item.commerceId;
      if (!ordersByCommerce[commerceId]) {
        ordersByCommerce[commerceId] = [];
      }
      ordersByCommerce[commerceId].push({
        producto: item.productId,
        cantidad: item.quantity,
        price: item.price
      });
    });

    const orderPromises = Object.keys(ordersByCommerce).map(async (commerceId) => {
      const products = ordersByCommerce[commerceId];

      const subtotal = products.reduce((sum, p) => sum + (p.price * p.cantidad), 0);
      const itbisAmount = (subtotal * itbisPercent) / 100;
      const total = subtotal + itbisAmount;

      const cleanProducts = products.map(p => ({
        producto: p.producto,
        cantidad: p.cantidad
      }));

      const newOrder = new Order({
        cliente:   req.session.user.id,
        comercio:  commerceId,
        direccion: addressId,
        productos: cleanProducts,
        subtotal: subtotal,
        itbis: itbisPercent,
        total: total,
        estado: 'pendiente'
      });

      return newOrder.save();
    });

    await Promise.all(orderPromises);

    req.session.carrito = [];
    
    req.flash('success_msg', '¡Pedidos realizados exitosamente!');
    
    res.json({ 
      success: true, 
      message: 'Pedidos creados exitosamente',
      redirect: '/client/orders' 
    });

  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ success: false, error: 'Error al crear pedido' });
  }
});

// ===== MI PERFIL =====
router.get('/profile', requireClient, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('client/profile', {
      title: 'Mi Perfil - AppCenar',
      layout: 'layouts/layout',
      user,
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  } catch (error) {
    console.error('Error en mi perfil:', error);
    req.flash('error_msg', 'Error al cargar perfil');
    res.redirect('/client/home');
  }
});

// ===== ACTUALIZAR PERFIL (ORDEN CORREGIDO) =====
// ¡IMPORTANTE! upload.single va PRIMERO para procesar el multipart form
router.post('/profile', requireClient, upload.single('fotoPerfil'), [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('apellido').notEmpty().withMessage('Apellido requerido'),
  body('telefono').notEmpty().withMessage('Teléfono requerido')
], async (req, res) => {
  try {
    // 1. Validar errores (ahora sí funcionará porque multer ya parseó el body)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/client/profile');
    }

    const { nombre, apellido, telefono } = req.body;
    
    // 2. Preparar datos
    const updateData = { nombre, apellido, telefono };
    if (req.file) {
      updateData.fotoPerfil = `/uploads/users/${req.file.filename}`;
    }

    // 3. Actualizar en Base de Datos
    await User.findByIdAndUpdate(req.session.user.id, updateData);

    // 4. RECUPERAR EL USUARIO FRESCO (Para actualizar sesión)
    const freshUser = await User.findById(req.session.user.id);

    // 5. SOBRESCRIBIR LA SESIÓN
    req.session.user = {
      id: freshUser._id,
      username: freshUser.username,
      rol: freshUser.rol,
      nombre: freshUser.nombre,
      apellido: freshUser.apellido,
      fotoPerfil: freshUser.fotoPerfil // Foto nueva garantizada
    };

    // 6. Guardar sesión y redirigir
    req.session.save((err) => {
      if(err) console.error('Error guardando sesión:', err);
      req.flash('success_msg', 'Perfil actualizado correctamente');
      res.redirect('/client/profile');
    });

  } catch (error) {
    console.error('Error actualizando perfil:', error);
    req.flash('error_msg', 'Error al actualizar perfil');
    res.redirect('/client/profile');
  }
});

// ===== MIS PEDIDOS =====
router.get('/orders', requireClient, async (req, res) => {
  try {
    const orders = await Order.find({ cliente: req.session.user.id })
      .populate('comercio', 'nombreComercio logoComercio')
      .populate('productos.producto', 'nombre foto precio')
      .sort({ creadoEn: -1 });

    res.render('client/orders', {
      title: 'Mis Pedidos - AppCenar',
      layout: 'layouts/layout',
      orders,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error en mis pedidos:', error);
    req.flash('error_msg', 'Error al cargar pedidos');
    res.redirect('/client/home');
  }
});

router.get('/orders/:orderId', requireClient, async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ 
      _id: orderId, 
      cliente: req.session.user.id 
    })
      .populate('cliente', 'nombre apellido')
      .populate('comercio', 'nombreComercio logoComercio')
      .populate('direccion', 'nombre descripcion')
      .populate('productos.producto', 'nombre foto precio')
      .populate('delivery', 'nombre apellido telefono');

    if (!order) {
      req.flash('error_msg', 'Pedido no encontrado');
      return res.redirect('/client/orders');
    }

    res.render('client/order-detail', {
      title: 'Detalle del Pedido - AppCenar',
      layout: 'layouts/layout',
      order,
      user: req.session.user
    });
  } catch (error) {
    console.error('Error en detalle de pedido:', error);
    req.flash('error_msg', 'Error al cargar detalle');
    res.redirect('/client/orders');
  }
});

// ===== MIS DIRECCIONES =====
router.get('/addresses', requireClient, async (req, res) => {
  try {
    const addresses = await Address.find({ cliente: req.session.user.id })
      .sort({ createdAt: -1 });

    res.render('client/addresses', {
      title: 'Mis Direcciones - AppCenar',
      layout: 'layouts/layout',
      addresses,
      user: req.session.user,
      error_msg: req.flash('error_msg'),
      success_msg: req.flash('success_msg')
    });
  } catch (error) {
    console.error('Error en mis direcciones:', error);
    req.flash('error_msg', 'Error al cargar direcciones');
    res.redirect('/client/home');
  }
});

router.get('/addresses/new', requireClient, (req, res) => {
  res.render('client/address-form', {
    title: 'Nueva Dirección - AppCenar',
    layout: 'layouts/layout',
    user: req.session.user,
    address: {},
    formAction: '/client/addresses',
    formMethod: 'POST',
    submitText: 'Crear dirección'
  });
});

router.post('/addresses', requireClient, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('descripcion').notEmpty().withMessage('Descripción requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/client/addresses/new');
    }

    const { nombre, descripcion } = req.body;
    await Address.create({
      cliente: req.session.user.id,
      nombre,
      descripcion
    });

    req.flash('success_msg', 'Dirección creada exitosamente');
    res.redirect('/client/addresses'); 
  } catch (error) {
    console.error('Error creando dirección:', error);
    req.flash('error_msg', 'Error al crear dirección');
    res.redirect('/client/addresses');
  }
});

router.get('/addresses/:id/edit', requireClient, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      cliente: req.session.user.id
    });

    if (!address) {
      req.flash('error_msg', 'Dirección no encontrada');
      return res.redirect('/client/addresses');
    }

    res.render('client/address-form', {
      title: 'Editar Dirección - AppCenar',
      layout: 'layouts/layout',
      user: req.session.user,
      address,
      formAction: `/client/addresses/${address._id}?_method=POST_EDIT`,
      formMethod: 'POST',
      submitText: 'Guardar cambios'
    });
  } catch (error) {
    req.flash('error_msg', 'Error al cargar dirección');
    res.redirect('/client/addresses');
  }
});

router.post('/addresses/:id', requireClient, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('descripcion').notEmpty().withMessage('Descripción requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect(`/client/addresses/${req.params.id}/edit`);
    }

    const { nombre, descripcion } = req.body;
    await Address.findOneAndUpdate(
      { _id: req.params.id, cliente: req.session.user.id },
      { nombre, descripcion },
      { new: true }
    );

    req.flash('success_msg', 'Dirección actualizada correctamente');
    res.redirect('/client/addresses');
  } catch (error) {
    req.flash('error_msg', 'Error al editar dirección');
    res.redirect('/client/addresses');
  }
});

router.get('/addresses/:id/delete', requireClient, async (req, res) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      cliente: req.session.user.id
    });

    if (!address) {
      req.flash('error_msg', 'Dirección no encontrada');
      return res.redirect('/client/addresses');
    }

    res.render('client/address-delete', {
      title: 'Eliminar Dirección - AppCenar',
      layout: 'layouts/layout',
      user: req.session.user,
      address
    });
  } catch (error) {
    req.flash('error_msg', 'Error al cargar dirección');
    res.redirect('/client/addresses');
  }
});

router.post('/addresses/:id/delete', requireClient, async (req, res) => {
  try {
    await Address.findOneAndDelete({
      _id: req.params.id,
      cliente: req.session.user.id
    });
    req.flash('success_msg', 'Dirección eliminada correctamente');
    res.redirect('/client/addresses');
  } catch (error) {
    req.flash('error_msg', 'Error al eliminar dirección');
    res.redirect('/client/addresses');
  }
});

// ===== MIS FAVORITOS =====
router.get('/favorites', requireClient, async (req, res) => {
  try {
    let favorites = await Favorite.find({ cliente: req.session.user.id })
      .populate('comercio', 'nombreComercio logoComercio telefono horaApertura horaCierre')
      .lean();

    favorites = favorites.filter(fav => fav.comercio != null);

    favorites = favorites.map(fav => ({
      ...fav,
      commerce: fav.comercio, 
    }));

    res.render('client/favorites', {
      title: 'Mis Favoritos - AppCenar',
      layout: 'layouts/layout',
      favorites,
      user: req.session.user
    });

  } catch (error) {
    console.error('Error en mis favoritos:', error);
    req.flash('error_msg', 'Error al cargar favoritos');
    res.redirect('/client/home');
  }
});

router.post('/favorites', requireClient, async (req, res) => {
  try {
    const { commerceId, action } = req.body;
    const clienteId = req.session.user?.id;

    if (!clienteId) return res.status(401).json({ success: false, message: "No autenticado" });
    if (!commerceId) return res.status(400).json({ success: false, message: "commerceId requerido" });

    if (action === "add") {
      const exists = await Favorite.findOne({ cliente: clienteId, comercio: commerceId });
      if (!exists) {
        await Favorite.create({ cliente: clienteId, comercio: commerceId });
      }
      return res.json({ success: true, action: "added" });
    }

    if (action === "remove") {
      await Favorite.findOneAndDelete({ cliente: clienteId, comercio: commerceId });
      return res.json({ success: true, action: "removed" });
    }

    return res.status(400).json({ success: false, message: "Acción no válida" });

  } catch (error) {
    console.error("Error al procesar favorito:", error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

module.exports = router;