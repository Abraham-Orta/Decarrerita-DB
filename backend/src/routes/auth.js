const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticateToken } = require('../middlewares/auth');
const { sendWelcomeEmail, sendLoginNotification, sendOtpEmail, sendPasswordResetEmail } = require('../services/mailService');

const JWT_SECRET = process.env.JWT_SECRET || 'decarrerita_secreto_super_seguro_123';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

  // Seguridad: El registro público solo permite clientes o choferes
  if (tipo_usuario !== 'cliente' && tipo_usuario !== 'chofer') {
    return res.status(403).json({ error: 'No tienes permisos para registrar este tipo de usuario.' });
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
      `INSERT INTO usuarios (email, password, nombre, apellido, telefono, cedula, tipo_usuario, activo) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, nombre, apellido, telefono, cedula, tipo_usuario, false]
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

    // Enviar correo de bienvenida (fire-and-forget)
    sendWelcomeEmail(email, nombre).catch((err) =>
      console.error('⚠️ Error al enviar correo de bienvenida:', err.message)
    );

    // Generar OTP y guardarlo
    const code = generateCode();
    await connection.query(
      `INSERT INTO codigos_verificacion (id_usuario, codigo, tipo, expira_en) 
       VALUES (?, ?, 'otp', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [id_usuario, code]
    );

    sendOtpEmail(email, nombre, code).catch((err) =>
      console.error('⚠️ Error al enviar correo OTP:', err.message)
    );

    res.status(201).json({ message: 'Usuario registrado. Verifica tu correo electrónico.', id_usuario, requiresVerification: true });
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
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = rows[0];

    if (!user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo.' });
    }

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

    // Enviar notificación de inicio de sesión (fire-and-forget)
    sendLoginNotification(user.email, user.nombre).catch((err) =>
      console.error('⚠️ Error al enviar correo de inicio de sesión:', err.message)
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

// 3. Verificar OTP
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  try {
    const [users] = await pool.query('SELECT id_usuario, activo FROM usuarios WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json({ error: 'Usuario no encontrado' });
    const user = users[0];

    const [codes] = await pool.query(
      `SELECT id FROM codigos_verificacion 
       WHERE id_usuario = ? AND tipo = 'otp' AND codigo = ? AND usado = FALSE AND expira_en > NOW()`,
      [user.id_usuario, code]
    );

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    await pool.query('UPDATE usuarios SET activo = TRUE WHERE id_usuario = ?', [user.id_usuario]);
    await pool.query('UPDATE codigos_verificacion SET usado = TRUE WHERE id = ?', [codes[0].id]);

    res.json({ message: 'Cuenta verificada exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 4. Reenviar OTP
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await pool.query('SELECT id_usuario, activo, nombre FROM usuarios WHERE email = ?', [email]);
    if (users.length === 0 || users[0].activo) {
      return res.status(400).json({ error: 'Usuario no válido o ya verificado' });
    }
    const user = users[0];
    const code = generateCode();
    await pool.query(
      `INSERT INTO codigos_verificacion (id_usuario, codigo, tipo, expira_en) 
       VALUES (?, ?, 'otp', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [user.id_usuario, code]
    );
    sendOtpEmail(email, user.nombre, code).catch(err => console.error('Error al enviar OTP:', err.message));
    res.json({ message: 'OTP reenviado' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 5. Olvidé mi contraseña
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await pool.query('SELECT id_usuario, nombre FROM usuarios WHERE email = ?', [email]);
    if (users.length > 0) {
      const code = generateCode();
      await pool.query(
        `INSERT INTO codigos_verificacion (id_usuario, codigo, tipo, expira_en) 
         VALUES (?, ?, 'reset', DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
        [users[0].id_usuario, code]
      );
      sendPasswordResetEmail(email, users[0].nombre, code).catch(err => console.error('Error reset email:', err.message));
    }
    res.json({ message: 'Si el correo existe, se ha enviado un código de recuperación.' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 6. Restablecer contraseña
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  try {
    const [users] = await pool.query('SELECT id_usuario FROM usuarios WHERE email = ?', [email]);
    if (users.length === 0) return res.status(400).json({ error: 'Datos inválidos' });
    const user = users[0];

    const [codes] = await pool.query(
      `SELECT id FROM codigos_verificacion 
       WHERE id_usuario = ? AND tipo = 'reset' AND codigo = ? AND usado = FALSE AND expira_en > NOW()`,
      [user.id_usuario, code]
    );

    if (codes.length === 0) {
      return res.status(400).json({ error: 'Código inválido o expirado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [hashedPassword, user.id_usuario]);
    await pool.query('UPDATE codigos_verificacion SET usado = TRUE WHERE id = ?', [codes[0].id]);

    res.json({ message: 'Contraseña restablecida exitosamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// 7. Obtener Datos del Perfil (Me)
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
        `SELECT c.id_banco, c.nro_cuenta, b.nombre AS banco 
         FROM choferes c 
         JOIN bancos b ON c.id_banco = b.id_banco 
         WHERE c.id_usuario = ?`,
        [id_usuario]
      );
      
      if (choferRows.length > 0) {
        userData.id_banco = choferRows[0].id_banco;
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

// 8. Actualizar Perfil de Usuario
router.put('/profile', authenticateToken, async (req, res) => {
  const { id_usuario, tipo_usuario } = req.user;
  const { nombre, apellido, telefono, id_banco, nro_cuenta } = req.body;

  if (!nombre || !apellido || !telefono) {
    return res.status(400).json({ error: 'Nombre, apellido y teléfono son obligatorios.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Actualizar datos básicos de usuario
    await connection.query(
      `UPDATE usuarios SET nombre = ?, apellido = ?, telefono = ? WHERE id_usuario = ?`,
      [nombre, apellido, telefono, id_usuario]
    );

    // Si es chofer, actualizar datos bancarios si fueron enviados
    if (tipo_usuario === 'chofer' && (id_banco || nro_cuenta)) {
      if (id_banco && nro_cuenta) {
        await connection.query(
          `UPDATE choferes SET id_banco = ?, nro_cuenta = ? WHERE id_usuario = ?`,
          [id_banco, nro_cuenta, id_usuario]
        );
      } else if (id_banco) {
        await connection.query(
          `UPDATE choferes SET id_banco = ? WHERE id_usuario = ?`,
          [id_banco, id_usuario]
        );
      } else if (nro_cuenta) {
        await connection.query(
          `UPDATE choferes SET nro_cuenta = ? WHERE id_usuario = ?`,
          [nro_cuenta, id_usuario]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Perfil actualizado exitosamente.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: 'Error al actualizar el perfil.' });
  } finally {
    connection.release();
  }
});

// 9. Cambiar Contraseña desde el Perfil
router.put('/change-password', authenticateToken, async (req, res) => {
  const { id_usuario } = req.user;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Debe ingresar la contraseña actual y la nueva contraseña.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'La nueva contraseña y su confirmación no coinciden.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    // Obtener contraseña cifrada actual
    const [rows] = await pool.query('SELECT password FROM usuarios WHERE id_usuario = ?', [id_usuario]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isMatch) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [hashedPassword, id_usuario]);

    res.json({ message: 'Contraseña actualizada exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
  }
});

module.exports = router;

