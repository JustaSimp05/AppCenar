const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const dotenv = require('dotenv');
const hbs = require('hbs');

dotenv.config();

const app = express();

// Configuración de puerto
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Sesiones
app.use(session({
  secret: process.env.SESSION_SECRET || 'appcenar-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 // 24 horas
  }
}));

app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.errors = req.flash('errors');
  res.locals.user = req.session.user || null;
  next();
});

// Motor de plantillas Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Carpeta de parciales (si algún día los usas)
hbs.registerPartials(path.join(__dirname, 'views', 'layouts'));

// Helpers para Handlebars
hbs.registerHelper('ifEquals', function (a, b, opts) {
  if (a && b && a.toString() === b.toString()) {
    return opts.fn(this);
  }
  return opts.inverse(this);
});

hbs.registerHelper('eq', function (a, b) {
  return a === b;
});

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/appcenar_dev')
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Error MongoDB:', err));

// Ruta principal
app.get('/', (req, res) => {
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

// Importar rutas
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/client');
const commerceRoutes = require('./routes/commerce');
const deliveryRoutes = require('./routes/delivery');
const adminRoutes = require('./routes/admin');

app.use('/auth', authRoutes);
app.use('/client', clientRoutes);
app.use('/commerce', commerceRoutes);
app.use('/delivery', deliveryRoutes);
app.use('/admin', adminRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Página no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 AppCenar corriendo en http://localhost:${PORT}`);
  console.log(`📱 Entorno: ${process.env.NODE_ENV || 'development'}`);
});
