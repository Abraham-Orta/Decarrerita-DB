const mysql = require('mysql2/promise');
require('dotenv').config();

// Crear un pool de conexiones a la base de datos
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'decarrerita_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Función de prueba de conexión rápida
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión exitosa a la base de datos MySQL.');
    connection.release();
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos MySQL:', error.message);
  }
}

testConnection();

module.exports = pool;
