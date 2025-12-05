// routes/commerce.js
const express = require('express');
const router = express.Router();

const Commerce = require('../models/Commerce');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Order = require('../models/Order');
const CommerceType = require('../models/CommerceType');
const upload = require('../config/upload'); // mismo multer que usas en auth

// Middleware de protección para rol comercio
const requireCommerce = (req, res, next) => {
  if (!req.session.user || req.session.user.rol !== 'comercio') {
    req.flash('error_msg', 'Acceso no autorizado');
    return res.redirect('/auth/login');
  }
  next();
};

// Helper para obtener el comercio logueado
async function getCurrentCommerce(req) {
  // Se asume que en el login de comercio guardaste:
  // req.session.user = { id: commerce.id, username: commerce.nombreComercio, rol: 'comercio' }
  return await Commerce.findById(req.session.user.id).populate('tipoComercio');
}

/* =========================
   HOME COMERCIO
   ========================= */

router.get('/home', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    const orders = await Order.find({ comercio: commerce._id })
      .populate('cliente', 'nombre apellido telefono')
      .sort({ creadoEn: -1 });

    const totalOrders = orders.length;
    const pendientes  = orders.filter(o => o.estado === 'pendiente').length;
    const enProceso   = orders.filter(o => o.estado === 'en proceso').length;
    const completados = orders.filter(o => o.estado === 'completado').length;

    res.render('commerce/home', {
      title: 'Home del comercio',
      layout: 'layouts/layout',
      commerce,      // el objeto de Commerce
      orders,
      stats: {
        totalOrders,
        pending: pendientes,
        inProcess: enProceso,
        completed: completados
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando home del comercio');
    res.redirect('/auth/login');
  }
});


/* =========================
   PERFIL COMERCIO
   ========================= */

// GET perfil
router.get('/profile', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const tiposComercio = await CommerceType.find().sort({ nombre: 1 });

    res.render('commerce/profile', {
      title: 'Mi perfil comercio',
      layout: 'layouts/layout',
      commerce,
      tiposComercio
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando perfil');
    res.redirect('/commerce/home');
  }
});

// POST perfil
router.post(
  '/profile',
  requireCommerce,
  upload.single('logoComercio'),
  async (req, res) => {
    try {
      const commerce = await getCurrentCommerce(req);
      const { nombreComercio, telefono, correo, horaApertura, horaCierre, tipoComercio } = req.body;

      commerce.nombreComercio = nombreComercio;
      commerce.telefono = telefono;
      commerce.correo = correo;
      commerce.horaApertura = horaApertura;
      commerce.horaCierre = horaCierre;
      commerce.tipoComercio = tipoComercio;

      if (req.file) {
        commerce.logoComercio = `/uploads/${req.file.filename}`;
      }

      await commerce.save();
      req.flash('success_msg', 'Perfil de comercio actualizado');
      res.redirect('/commerce/profile');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error actualizando perfil');
      res.redirect('/commerce/profile');
    }
  }
);

/* =========================
   CATEGORÍAS
   ========================= */

// GET categorías
router.get('/categories', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const categories = await Category.find({ comercio: commerce._id }).sort({ nombre: 1 });

    res.render('commerce/categories', {
      title: 'Categorías',
      layout: 'layouts/layout',
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando categorías');
    res.redirect('/commerce/home');
  }
});

// POST crear categoría
router.post('/categories', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const { nombre, descripcion } = req.body;

    await Category.create({
      nombre,
      descripcion,
      comercio: commerce._id   // <- importantísimo
    });

    req.flash('success_msg', 'Categoría creada');
    res.redirect('/commerce/categories');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error creando categoría');
    res.redirect('/commerce/categories');
  }
});

// GET editar categoría
router.get('/categories/:id/edit', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const category = await Category.findOne({
      _id: req.params.id,
      comercio: commerce._id
    });

    if (!category) {
      req.flash('error_msg', 'Categoría no encontrada');
      return res.redirect('/commerce/categories');
    }

    res.render('commerce/category_edit', {
      title: 'Editar categoría',
      layout: 'layouts/layout',
      category
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando categoría');
    res.redirect('/commerce/categories');
  }
});

// POST editar categoría
router.post('/categories/:id/edit', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const { nombre, descripcion } = req.body;

    await Category.findOneAndUpdate(
      { _id: req.params.id, comercio: commerce._id },
      { nombre, descripcion }
    );

    req.flash('success_msg', 'Categoría actualizada');
    res.redirect('/commerce/categories');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error actualizando categoría');
    res.redirect('/commerce/categories');
  }
});

// GET confirmar eliminación categoría
router.get('/categories/:id/delete', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);
    const category = await Category.findOne({
      _id: req.params.id,
      comercio: commerce._id
    });

    if (!category) {
      req.flash('error_msg', 'Categoría no encontrada');
      return res.redirect('/commerce/categories');
    }

    res.render('commerce/category_delete', {
      title: 'Eliminar categoría',
      layout: 'layouts/layout',
      category
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando categoría');
    res.redirect('/commerce/categories');
  }
});

// POST eliminar categoría
router.post('/categories/:id/delete', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    await Category.findOneAndDelete({
      _id: req.params.id,
      comercio: commerce._id
    });

    req.flash('success_msg', 'Categoría eliminada');
    res.redirect('/commerce/categories');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error eliminando categoría');
    res.redirect('/commerce/categories');
  }
});

/* =========================
   PRODUCTOS
   ========================= */

// GET productos
router.get('/products', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    // Traer categorías del comercio actual
    const categories = await Category.find({ comercio: commerce._id }).sort({ nombre: 1 });

    // Traer productos del comercio actual
    const products = await Product.find({ comercio: commerce._id })
      .populate('categoria')
      .sort({ nombre: 1 });

    res.render('commerce/products', {
      title: 'Productos',
      layout: 'layouts/layout',
      categories,   // <- clave para el select
      products
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando productos');
    res.redirect('/commerce/home');
  }
});


// POST crear producto
router.post(
  '/products',
  requireCommerce,
  upload.single('foto'),
  async (req, res) => {
    try {
      const commerce = await getCurrentCommerce(req);
      const { nombre, descripcion, precio, categoria } = req.body;

      const product = new Product({
        nombre,
        descripcion,
        precio,
        categoria,
        comercio: commerce._id
      });

      if (req.file) {
        product.foto = `/uploads/${req.file.filename}`;
      }

      await product.save();
      req.flash('success_msg', 'Producto creado');
      res.redirect('/commerce/products');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error creando producto');
      res.redirect('/commerce/products');
    }
  }
);

// GET editar producto
router.get('/products/:id/edit', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    const product = await Product.findOne({
      _id: req.params.id,
      comercio: commerce._id
    });

    if (!product) {
      req.flash('error_msg', 'Producto no encontrado');
      return res.redirect('/commerce/products');
    }

    const categories = await Category.find({ comercio: commerce._id }).sort({ nombre: 1 });

    res.render('commerce/product_edit', {
      title: 'Editar producto',
      layout: 'layouts/layout',
      product,
      categories
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando producto');
    res.redirect('/commerce/products');
  }
});

// POST editar producto
router.post(
  '/products/:id/edit',
  requireCommerce,
  upload.single('foto'),
  async (req, res) => {
    try {
      const commerce = await getCurrentCommerce(req);
      const { nombre, descripcion, precio, categoria } = req.body;

      const update = { nombre, descripcion, precio, categoria };

      if (req.file) {
        update.foto = `/uploads/${req.file.filename}`;
      }

      await Product.findOneAndUpdate(
        { _id: req.params.id, comercio: commerce._id },
        update
      );

      req.flash('success_msg', 'Producto actualizado');
      res.redirect('/commerce/products');
    } catch (err) {
      console.error(err);
      req.flash('error_msg', 'Error actualizando producto');
      res.redirect('/commerce/products');
    }
  }
);

// GET confirmar eliminación producto
router.get('/products/:id/delete', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    const product = await Product.findOne({
      _id: req.params.id,
      comercio: commerce._id
    }).populate('categoria');

    if (!product) {
      req.flash('error_msg', 'Producto no encontrado');
      return res.redirect('/commerce/products');
    }

    res.render('commerce/product_delete', {
      title: 'Eliminar producto',
      layout: 'layouts/layout',
      product
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando producto');
    res.redirect('/commerce/products');
  }
});

// POST eliminar producto
router.post('/products/:id/delete', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    await Product.findOneAndDelete({
      _id: req.params.id,
      comercio: commerce._id
    });

    req.flash('success_msg', 'Producto eliminado');
    res.redirect('/commerce/products');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error eliminando producto');
    res.redirect('/commerce/products');
  }
});

/* =========================
   PEDIDOS
   ========================= */

// GET pedidos
router.get('/orders', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    const orders = await Order.find({ comercio: commerce._id })
      .populate('cliente', 'nombre apellido telefono')
      .populate('direccion', 'nombre descripcion')
      .sort({ creadoEn: -1 });

    const pendientes = orders.filter(o => o.estado === 'pendiente').length;
    const enProceso = orders.filter(o => o.estado === 'en proceso').length;
    const completados = orders.filter(o => o.estado === 'completado').length;

    res.render('commerce/orders', {
      title: 'Pedidos',
      layout: 'layouts/layout',
      orders,
      stats: { pendientes, enProceso, completados }
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando pedidos');
    res.redirect('/commerce/home');
  }
});


// GET detalle pedido
router.get('/orders/:id', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    const order = await Order.findOne({
      _id: req.params.id,
      comercio: commerce._id
    })
      .populate('cliente', 'nombre apellido telefono correo')
      .populate('direccion', 'nombre descripcion')
      .populate('productos.producto', 'nombre descripcion precio foto')
      .populate('delivery', 'nombre apellido telefono');

    if (!order) {
      req.flash('error_msg', 'Pedido no encontrado');
      return res.redirect('/commerce/orders');
    }

    res.render('commerce/order_detail', {
      title: 'Detalle pedido',
      layout: 'layouts/layout',
      order
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error cargando pedido');
    res.redirect('/commerce/orders');
  }
});


// Marcar pedido en proceso
router.post('/orders/:id/process', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    await Order.findOneAndUpdate(
      { _id: req.params.id, comercio: commerce._id },
      { estado: 'en proceso' }
    );

    res.redirect('/commerce/orders');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error actualizando pedido');
    res.redirect('/commerce/orders');
  }
});

// Marcar pedido completado
router.post('/orders/:id/complete', requireCommerce, async (req, res) => {
  try {
    const commerce = await getCurrentCommerce(req);

    await Order.findOneAndUpdate(
      { _id: req.params.id, comercio: commerce._id },
      { estado: 'completado' }
    );

    res.redirect('/commerce/orders');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error actualizando pedido');
    res.redirect('/commerce/orders');
  }
});

module.exports = router;
