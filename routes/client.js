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
// Configuración de multer para subida de fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/users/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  }
});

// ===== HOME DEL CLIENTE - Listado de tipos de comercios =====
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

    // Buscar comercios del tipo seleccionado
    const commerces = await Commerce.find({ 
      tipoComercio: tipoId, 
      isActive: true 
    }).populate('tipoComercio', 'nombre icono');

    // Buscar favoritos del usuario actual
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
    console.error('Error en búsqueda de comercios:', error);
    res.status(500).json({ error: 'Error en la búsqueda' });
  }
});

// ===== CATÁLOGO DE PRODUCTOS DE UN COMERCIO =====
router.get('/catalog/:commerceId', requireClient, async (req, res) => {
  try {
    const commerceId = req.params.commerceId;
    const commerce = await Commerce.findById(commerceId).populate('tipoComercio');
    
    if (!commerce || !commerce.isActive) {
      req.flash('error_msg', 'Comercio no encontrado o inactivo');
      return res.redirect('/client/home');
    }

    // Obtener categorías del comercio
    const categories = await Category.find({ comercio: commerceId });
    
    // Obtener productos organizados por categorías
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

    // Productos sin categoría
    const productsWithoutCategory = await Product.find({ 
      comercio: commerceId, 
      categoria: null 
    });

    // Carrito de sesión
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

    // === AGREGAR ===
    if (action === 'add') {
      if (index !== -1) {
        carrito[index].quantity += 1;
      } else {
        const product = await Product.findById(productId).populate('categoria', 'nombre');

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

    // === INCREMENTAR ===
    if (action === 'increment') {
      if (index !== -1) carrito[index].quantity += 1;
    }

    // === DECREMENTAR ===
    if (action === 'decrement') {
      if (index !== -1) {
        carrito[index].quantity -= 1;

        if (carrito[index].quantity <= 0) {
          carrito.splice(index, 1);
        }
      }
    }

    // === ELIMINAR COMPLETO ===
    if (action === 'remove') {
      carrito = carrito.filter(p => p.productId !== productId);
    }

    // === CALCULAR SUBTOTAL ===
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

    // Configuración ITBIS
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
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { addressId } = req.body;
    
    if (!req.session.carrito || req.session.carrito.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Carrito vacío' 
      });
    }

    const config = await Config.findOne() || { itbis: 18 };
    const itbis = config.itbis;
    const subtotal = req.session.carrito.reduce((sum, p) => sum + (p.price * p.quantity), 0);
    const total = subtotal + (subtotal * itbis / 100);

    // Crear productos del pedido
    const orderProducts = req.session.carrito.map(item => ({
      producto:  item.productId,
      cantidad:  item.quantity
    }));

    const newOrder = new Order({
      cliente:   req.session.user.id,
      comercio:  req.session.carrito[0].commerceId,
      direccion: addressId,
      productos: orderProducts,          // ojo: producto / cantidad
      subtotal,
      itbis,
      total,
      estado: 'pendiente'                // debe ser uno de tu enum
    });

    await newOrder.save();

    // Limpiar carrito
    req.session.carrito = [];
    
    req.flash('success_msg', '¡Pedido creado exitosamente! Será procesado pronto.');
    
    res.json({ 
      success: true, 
      message: 'Pedido creado exitosamente',
      redirect: '/client/home' 
    });
  } catch (error) {
    console.error('Error creando pedido:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al crear pedido' 
    });
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

// Actualizar perfil
router.post('/profile', requireClient, [
  body('nombre').notEmpty().withMessage('Nombre requerido'),
  body('apellido').notEmpty().withMessage('Apellido requerido'),
  body('telefono').notEmpty().withMessage('Teléfono requerido')
], upload.single('fotoPerfil'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/client/profile');
    }

    const { nombre, apellido, telefono } = req.body;
    const fotoPerfil = req.file ? `/uploads/users/${req.file.filename}` : undefined;

    const user = await User.findByIdAndUpdate(
      req.session.user.id,
      { 
        nombre, 
        apellido, 
        telefono,
        fotoPerfil 
      },
      { new: true }
    );

    // Actualizar sesión
    req.session.user.nombre = nombre;
    req.session.user.apellido = apellido;
    req.session.user.telefono = telefono;

    req.flash('success_msg', 'Perfil actualizado correctamente');
    res.redirect('/client/profile');
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

// Detalle del pedido
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

// FORMULARIO NUEVA DIRECCIÓN
router.get('/addresses/new', requireClient, (req, res) => {
  res.render('client/address-form', {
    title: 'Nueva Dirección - AppCenar',
    layout: 'layouts/layout',
    user: req.session.user,
    address: {},        // vacío para creación
    formAction: '/client/addresses',
    formMethod: 'POST',
    submitText: 'Crear dirección'
  });
});

// CREAR DIRECCIÓN (POST, ya lo tienes pero redirigiendo al listado)
router.post('/addresses', requireClient, [
  body('nombre').notEmpty().withMessage('Nombre de dirección requerido'),
  body('descripcion').notEmpty().withMessage('Descripción requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect('/client/addresses/new');
    }

    const { nombre, descripcion } = req.body;
    
    const newAddress = new Address({
      cliente: req.session.user.id,
      nombre,
      descripcion
    });

    await newAddress.save();
    req.flash('success_msg', 'Dirección creada exitosamente');
    res.redirect('/client/addresses'); // vuelve al listado
  } catch (error) {
    console.error('Error creando dirección:', error);
    req.flash('error_msg', 'Error al crear dirección');
    res.redirect('/client/addresses');
  }
});


// FORMULARIO EDICIÓN
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
    console.error('Error cargando dirección para editar:', error);
    req.flash('error_msg', 'Error al cargar dirección');
    res.redirect('/client/addresses');
  }
});

// ACTUALIZAR DIRECCIÓN usando POST + query para no complicarte con PUT
router.post('/addresses/:id', requireClient, [
  body('nombre').notEmpty().withMessage('Nombre de dirección requerido'),
  body('descripcion').notEmpty().withMessage('Descripción requerida')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash('error_msg', errors.array().map(e => e.msg).join(', '));
      return res.redirect(`/client/addresses/${req.params.id}/edit`);
    }

    const { nombre, descripcion } = req.body;

    const address = await Address.findOneAndUpdate(
      { _id: req.params.id, cliente: req.session.user.id },
      { nombre, descripcion },
      { new: true }
    );

    if (!address) {
      req.flash('error_msg', 'Dirección no encontrada');
      return res.redirect('/client/addresses');
    }

    req.flash('success_msg', 'Dirección actualizada correctamente');
    res.redirect('/client/addresses');
  } catch (error) {
    console.error('Error editando dirección:', error);
    req.flash('error_msg', 'Error al editar dirección');
    res.redirect('/client/addresses');
  }
});


// PANTALLA DE CONFIRMACIÓN DE ELIMINAR
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
    console.error('Error cargando dirección para eliminar:', error);
    req.flash('error_msg', 'Error al cargar dirección');
    res.redirect('/client/addresses');
  }
});

// ELIMINAR DIRECCIÓN (POST sencillo)
router.post('/addresses/:id/delete', requireClient, async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      cliente: req.session.user.id
    });

    if (!address) {
      req.flash('error_msg', 'Dirección no encontrada');
      return res.redirect('/client/addresses');
    }

    req.flash('success_msg', 'Dirección eliminada correctamente');
    res.redirect('/client/addresses');
  } catch (error) {
    console.error('Error eliminando dirección:', error);
    req.flash('error_msg', 'Error al eliminar dirección');
    res.redirect('/client/addresses');
  }
});


// ===== MIS FAVORITOS =====
router.get('/favorites', requireClient, async (req, res) => {
  try {
    // Buscar favoritos del usuario
    let favorites = await Favorite.find({ cliente: req.session.user.id })
      .populate('comercio', 'nombreComercio logoComercio telefono horaApertura horaCierre')
      .lean(); // <-- NECESARIO para poder mapear el resultado

    // Convertir "comercio" -> "commerce" (alias)
    favorites = favorites.map(fav => ({
      ...fav,
      commerce: fav.comercio, // alias correcto
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


// Toggle favorito (agregar/remover)
router.post('/favorites', requireClient, async (req, res) => {
  try {
    const { commerceId, action } = req.body;
    const clienteId = req.session.user?.id;

    if (!clienteId) {
      return res.status(401).json({ success: false, message: "No autenticado" });
    }
    if (!commerceId) {
      return res.status(400).json({ success: false, message: "commerceId requerido" });
    }

    // --- AGREGAR FAVORITO ---
    if (action === "add") {
      const exists = await Favorite.findOne({ cliente: clienteId, comercio: commerceId });

      if (!exists) {
        await Favorite.create({
          cliente: clienteId,
          comercio: commerceId
        });
      }

      return res.json({ success: true, action: "added" });
    }

    // --- REMOVER FAVORITO ---
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
