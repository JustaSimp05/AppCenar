//Para ejecutar la seed solo poner lo sig en la terminal: node seed-data.js


const mongoose = require('mongoose');
const CommerceType = require('./models/CommerceType');
const Config = require('./models/Config');

mongoose.connect('mongodb://localhost:27017/appcenar_dev')
  .then(async () => {
    console.log('Conectado a MongoDB para seed');

    // Limpiar datos existentes
    await CommerceType.deleteMany({});
    await Config.deleteMany({});

    // Tipos de comercios
    const tiposComercios = [
      {
        nombre: 'Restaurantes',
        descripcion: 'Comida rápida, tradicional y gourmet',
        icono: 'uploads/iconos/restaurante.png'
      },
      {
        nombre: 'Supermercados',
        descripcion: 'Productos de supermercado y abarrotes',
        icono: 'uploads/iconos/supermercado.png'
      },
      {
        nombre: 'Farmacias',
        descripcion: 'Medicamentos y productos farmacéuticos',
        icono: 'uploads/iconos/farmacia.png'
      },
      {
        nombre: 'Librerías',
        descripcion: 'Libros, papelería y artículos de oficina',
        icono: 'uploads/iconos/libreria.png'
      }
    ];

    await CommerceType.insertMany(tiposComercios);
    console.log('Tipos de comercios creados');

    // Configuración inicial
    await Config.create({
      itbis: 18,
      tiempoEntrega: 30,
      costoEntrega: 150
    });

    console.log('Configuración inicial creada');
    console.log('Seed completado. Desconectando...');
    mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error en seed:', err);
    mongoose.disconnect();
  });
