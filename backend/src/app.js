const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());

// Importar Enrutadores
const authRoutes = require('./routes/auth');
const clienteRoutes = require('./routes/clientes');
const choferRoutes = require('./routes/choferes');
const adminRoutes = require('./routes/admin');

// Enlazar Rutas
app.use('/api/auth', authRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/choferes', choferRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de estado general (Health Check)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date(),
    service: 'Decarrerita API Server'
  });
});

// Middleware para rutas no encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

// Middleware de manejo de errores globales
app.use((err, req, res, next) => {
  console.error('💥 Error no controlado:', err.stack);
  res.status(500).json({ error: 'Ocurrió un error interno en el servidor.' });
});

// Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
});
