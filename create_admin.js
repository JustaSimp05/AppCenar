const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); 

// Asegúrate que esta sea tu URL correcta del .env
const MONGO_URI = 'mongodb://localhost:27017/appcenar_dev'; 

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Conectado a la base de datos...');

    const adminData = {
      nombre: 'Luis',
      apellido: 'Urbaez',
      cedula: '402-1234567-8', 
      telefono: '809-555-5555',
      correo: 'rurbaezxdxdxd@gmail.com',
      username: 'admin3',
      password: '123456', 
      rol: 'admin',
      isActive: true
    };

    // Verificar si ya existe
    const exists = await User.findOne({ username: adminData.username });
    if (exists) {
      console.log('El usuario admin ya existe. Bórralo de la BD si quieres recrearlo.');
      process.exit();
    }

    const passwordHash = await bcrypt.hash(adminData.password, 10);

    await User.create({
      ...adminData,
      passwordHash
    });

    console.log('¡Usuario ADMIN creado con CÉDULA!');
    console.log(`Usuario: ${adminData.username}`);
    console.log(`Pass: ${adminData.password}`);
    
    process.exit();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdmin();