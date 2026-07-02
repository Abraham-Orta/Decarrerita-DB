const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken } = require('../middlewares/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'decarrerita_secreto_super_seguro_123';

// 0. Obtener Bancos (Público, para registro y recargas)
router.get('/bancos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_banco, nombre FROM bancos ORDER BY nombre ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la lista de bancos.' });
  }
});

// 1. Registro de Usuarios
router.post('/register', async (req, res) => {
  const { 
    email, password, nombre, apellido, telefono, cedula, tipo_usuario,
    id_banco, nro_cuenta, contactos_emergencia 
  } = req.body;

  // Validaciones básicas
  if (!email || !password || !nombre || !apellido || !telefono || !cedula || !tipo_usuario) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
  }

  const connection = await pool.getConnection();
  try {
    // Iniciar transacción para garantizar consistencia
    await connection.beginTransaction();

    // Encriptar contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insertar en la tabla base de usuarios
    const [userResult] = await connection.query(
      `INSERT INTO usuarios (email, password, nombre, apellido, telefono, cedula, tipo_usuario) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, nombre, apellido, telefono, cedula, tipo_usuario]
    );

    const id_usuario = userResult.insertId;

    // Especializar según el tipo de usuario
    if (tipo_usuario === 'cliente') {
      await connection.query(
        'INSERT INTO clientes (id_usuario, saldo) VALUES (?, 0.00)',
        [id_usuario]
      );
    } else if (tipo_usuario === 'chofer') {
      // Validar datos de chofer
      if (!id_banco || !nro_cuenta) {
        throw new Error('Los choferes deben indicar banco y número de cuenta.');
      }
      if (!contactos_emergencia || !Array.isArray(contactos_emergencia) || contactos_emergencia.length < 2) {
        throw new Error('Debe registrar al menos dos contactos de emergencia.');
      }

      // Insertar en la tabla choferes
      await connection.query(
        'INSERT INTO choferes (id_usuario, id_banco, nro_cuenta) VALUES (?, ?, ?)',
        [id_usuario, id_banco, nro_cuenta]
      );

      // Insertar contactos de emergencia
      for (const contacto of contactos_emergencia) {
        if (!contacto.nombre || !contacto.telefono || !contacto.relacion) {
          throw new Error('Todos los campos del contacto de emergencia son obligatorios.');
        }
        await connection.query(
          `INSERT INTO contactos_emergencia (id_chofer, nombre, telefono, relacion) 
           VALUES (?, ?, ?, ?)`,
          [id_usuario, contacto.nombre, contacto.telefono, contacto.relacion]
        );
      }
    }

    // Confirmar transacción
    await connection.commit();
    res.status(201).json({ message: 'Usuario registrado exitosamente.', id_usuario });
  } catch (error) {
    // Revertir cambios en caso de error
    await connection.rollback();
    res.status(400).json({ error: error.message || 'Error al registrar el usuario.' });
  } finally {
    connection.release();
  }
});

// 2. Inicio de Sesión
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Debe ingresar email y contraseña.' });
  }

  try {
    // Buscar usuario en la base de datos
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ? AND activo = TRUE', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas o usuario inactivo.' });
    }

    const user = rows[0];

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    // Generar Token JWT
    const token = jwt.sign(
      { id_usuario: user.id_usuario, email: user.email, tipo_usuario: user.tipo_usuario },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        tipo_usuario: user.tipo_usuario
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor durante el inicio de sesión.' });
  }
});

// 3. Obtener Datos del Perfil (Me)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { id_usuario, tipo_usuario } = req.user;

    let query = `
      SELECT id_usuario, email, nombre, apellido, telefono, cedula, tipo_usuario, fecha_registro 
      FROM usuarios 
      WHERE id_usuario = ?
    `;
    
    const [userRows] = await pool.query(query, [id_usuario]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const userData = userRows[0];

    // Si es cliente, obtener su saldo
    if (tipo_usuario === 'cliente') {
      const [clienteRows] = await pool.query('SELECT saldo FROM clientes WHERE id_usuario = ?', [id_usuario]);
      userData.saldo = clienteRows.length > 0 ? clienteRows[0].saldo : 0.00;
    }
    
    // Si es chofer, obtener su banco, número de cuenta y contactos
    if (tipo_usuario === 'chofer') {
      const [choferRows] = await pool.query(
        `SELECT c.nro_cuenta, b.nombre AS banco 
         FROM choferes c 
         JOIN bancos b ON c.id_banco = b.id_banco 
         WHERE c.id_usuario = ?`,
        [id_usuario]
      );
      
      if (choferRows.length > 0) {
        userData.nro_cuenta = choferRows[0].nro_cuenta;
        userData.banco = choferRows[0].banco;
      }

      // Obtener contactos de emergencia
      const [contactos] = await pool.query(
        'SELECT nombre, telefono, relacion FROM contactos_emergencia WHERE id_chofer = ?',
        [id_usuario]
      );
      userData.contactos_emergencia = contactos;
    }

    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los datos del perfil.' });
  }
});

module.exports = router;
