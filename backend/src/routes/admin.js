const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');
const { sendAccountStatusEmail } = require('../services/mailService');

// Requiere rol de personal_administrativo o administrador
router.use(authenticateToken, authorizeRoles('personal_administrativo', 'administrador'));

// 0. Crear usuarios administrativos (Solo para el administrador principal)
router.post('/usuarios', async (req, res) => {
  // Verificación extra de seguridad: Solo un Administrador puede crear personal interno
  if (req.user.tipo_usuario !== 'administrador') {
    return res.status(403).json({ error: 'Solo los administradores pueden crear personal interno.' });
  }

  const { email, password, nombre, apellido, telefono, cedula, tipo_usuario } = req.body;

  if (!email || !password || !nombre || !apellido || !telefono || !cedula || !tipo_usuario) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  if (tipo_usuario !== 'administrador' && tipo_usuario !== 'personal_administrativo') {
    return res.status(400).json({ error: 'Este endpoint es exclusivo para crear personal administrativo.' });
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      `INSERT INTO usuarios (email, password, nombre, apellido, telefono, cedula, tipo_usuario) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, nombre, apellido, telefono, cedula, tipo_usuario]
    );

    res.status(201).json({ 
      message: 'Usuario administrativo creado exitosamente.', 
      id_usuario: result.insertId 
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email o la cédula ya están registrados.' });
    }
    res.status(500).json({ error: 'Error al registrar el usuario administrativo.' });
  }
});

// 1. Agregar un Banco
router.post('/bancos', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'Debe ingresar el nombre del banco.' });
  }

  try {
    const [result] = await pool.query('INSERT INTO bancos (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ message: 'Banco registrado exitosamente.', id_banco: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Este banco ya se encuentra registrado.' });
    }
    res.status(500).json({ error: 'Error al registrar el banco.' });
  }
});

// 2. Listar Bancos (Ruta compartida)
router.get('/bancos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id_banco, nombre FROM bancos ORDER BY nombre ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la lista de bancos.' });
  }
});

// 3. Registrar Calificación de Prueba Psicológica (Chofer)
router.post('/evaluaciones/choferes', async (req, res) => {
  const { id_chofer, nota, fecha_evaluacion } = req.body;
  const id_admin = req.user.id_usuario;

  if (!id_chofer || nota === undefined || !fecha_evaluacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para la evaluación.' });
  }

  const n = parseInt(nota);
  if (isNaN(n) || n < 0 || n > 100) {
    return res.status(400).json({ error: 'La nota debe estar entre 0 y 100.' });
  }

  try {
    // Validar que el usuario sea chofer
    const [choferRows] = await pool.query('SELECT 1 FROM choferes WHERE id_usuario = ?', [id_chofer]);
    if (choferRows.length === 0) {
      return res.status(404).json({ error: 'El chofer especificado no existe.' });
    }

    const [result] = await pool.query(
      `INSERT INTO evaluaciones_choferes (id_chofer, nota, fecha_evaluacion, id_admin) 
       VALUES (?, ?, ?, ?)`,
      [id_chofer, n, fecha_evaluacion, id_admin]
    );

    res.status(201).json({
      message: 'Evaluación de chofer registrada exitosamente.',
      id_evaluacion: result.insertId,
      aprobado: n >= 73
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar la evaluación.' });
  }
});

// 4. Registrar Calificación de Revisión Vehicular
router.post('/evaluaciones/vehiculos', async (req, res) => {
  const { id_vehiculo, nota, fecha_evaluacion } = req.body;
  const id_admin = req.user.id_usuario;

  if (!id_vehiculo || nota === undefined || !fecha_evaluacion) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para la revisión vehicular.' });
  }

  const n = parseInt(nota);
  if (isNaN(n) || n < 0 || n > 100) {
    return res.status(400).json({ error: 'La nota debe estar entre 0 y 100.' });
  }

  try {
    // Validar que el vehículo exista
    const [vehRows] = await pool.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ?', [id_vehiculo]);
    if (vehRows.length === 0) {
      return res.status(404).json({ error: 'El vehículo especificado no existe.' });
    }

    const [result] = await pool.query(
      `INSERT INTO evaluaciones_vehiculos (id_vehiculo, nota, fecha_evaluacion, id_admin) 
       VALUES (?, ?, ?, ?)`,
      [id_vehiculo, n, fecha_evaluacion, id_admin]
    );

    res.status(201).json({
      message: 'Revisión vehicular registrada exitosamente.',
      id_evaluacion_veh: result.insertId,
      aprobado: n >= 65
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar la revisión del vehículo.' });
  }
});

router.get('/evaluaciones/choferes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ec.id_evaluacion, ec.nota, ec.fecha_evaluacion, ec.aprobado,
              u.nombre AS chofer_nombre, u.apellido AS chofer_apellido, u.cedula,
              adm.nombre AS admin_nombre, adm.apellido AS admin_apellido
       FROM evaluaciones_choferes ec
       JOIN choferes c ON ec.id_chofer = c.id_usuario
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       JOIN usuarios adm ON ec.id_admin = adm.id_usuario
       ORDER BY ec.fecha_evaluacion DESC, ec.id_evaluacion DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de evaluaciones psicológicas.' });
  }
});

router.get('/evaluaciones/vehiculos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ev.id_evaluacion_veh, ev.nota, ev.fecha_evaluacion, ev.aprobado,
              v.placa, v.marca, v.modelo,
              u.nombre AS chofer_nombre, u.apellido AS chofer_apellido,
              adm.nombre AS admin_nombre, adm.apellido AS admin_apellido
       FROM evaluaciones_vehiculos ev
       JOIN vehiculos v ON ev.id_vehiculo = v.id_vehiculo
       JOIN choferes c ON v.id_chofer = c.id_usuario
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       JOIN usuarios adm ON ev.id_admin = adm.id_usuario
       ORDER BY ev.fecha_evaluacion DESC, ev.id_evaluacion_veh DESC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de revisiones vehiculares.' });
  }
});

router.get('/recargas', async (req, res) => {
  try {
    const { estado } = req.query;
    let query = `SELECT r.id_recarga, r.fecha, r.nro_referencia, r.monto, r.estado,
                        b.nombre AS banco_origen, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido
                 FROM recargas_saldo r
                 JOIN bancos b ON r.id_banco = b.id_banco
                 JOIN usuarios u ON r.id_cliente = u.id_usuario`;
    const params = [];
    if (estado && estado !== 'todos') {
      query += ` WHERE r.estado = ?`;
      params.push(estado);
    }
    query += ` ORDER BY FIELD(r.estado, 'pendiente', 'aprobada', 'rechazada'), r.fecha DESC`;
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recargas.' });
  }
});

router.get('/recargas/pendientes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id_recarga, r.fecha, r.nro_referencia, r.monto, r.estado,
              b.nombre AS banco_origen, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido
       FROM recargas_saldo r
       JOIN bancos b ON r.id_banco = b.id_banco
       JOIN usuarios u ON r.id_cliente = u.id_usuario
       WHERE r.estado = 'pendiente'
       ORDER BY r.fecha ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recargas pendientes.' });
  }
});

router.put('/recargas/:id_recarga/estado', async (req, res) => {
  const { id_recarga } = req.params;
  const { estado } = req.body;

  if (!estado || !['aprobada', 'rechazada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido. Debe ser aprobada o rechazada.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener datos de la recarga antes de actualizar
    const [recargaRows] = await connection.query(
      `SELECT id_cliente, monto, estado FROM recargas_saldo WHERE id_recarga = ? FOR UPDATE`,
      [id_recarga]
    );

    if (recargaRows.length === 0 || recargaRows[0].estado !== 'pendiente') {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: 'Recarga no encontrada o ya procesada.' });
    }

    const recarga = recargaRows[0];

    // 2. Actualizar estado en recargas_saldo
    await connection.query(
      `UPDATE recargas_saldo SET estado = ?, id_admin = ? WHERE id_recarga = ?`,
      [estado, req.user.id_usuario, id_recarga]
    );

    // 3. Si se aprueba, sumar al saldo del cliente explícitamente en la capa de aplicación
    if (estado === 'aprobada') {
      await connection.query(
        `UPDATE clientes SET saldo = saldo + ? WHERE id_usuario = ?`,
        [recarga.monto, recarga.id_cliente]
      );
    }

    await connection.commit();
    connection.release();

    res.json({ message: `Recarga ${estado} exitosamente.` });
  } catch (error) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: 'Error al actualizar el estado de la recarga.' });
  }
});

// 5. Obtener Choferes con Saldos Pendientes (Para pagarles)
router.get('/choferes/pendientes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id_chofer, nombre, apellido, saldo_pendiente 
       FROM vista_saldos_choferes 
       WHERE saldo_pendiente > 0`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener choferes con saldos pendientes.' });
  }
});

// Obtener lista de viajes pendientes por liquidar a un chofer específico con su desglose de montos
router.get('/choferes/:id_chofer/viajes-pendientes', async (req, res) => {
  const { id_chofer } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT t.id_traslado, t.fecha, t.origen, t.destino,
              t.costo_total, t.monto_chofer, t.monto_empresa
       FROM traslados t
       WHERE t.id_chofer = ? AND t.pagado_a_chofer = FALSE AND t.estado = 'completado'
       ORDER BY t.fecha ASC`,
      [id_chofer]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener viajes pendientes del chofer.' });
  }
});

// 6. Cancelar (Pagar) Traslados a un Chofer
router.post('/pagos', async (req, res) => {
  const { id_chofer, fecha_pago, nro_referencia, monto } = req.body;
  const id_admin = req.user.id_usuario;

  if (!id_chofer || !fecha_pago || !nro_referencia || monto === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos (id_chofer, fecha_pago, nro_referencia, monto).' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Obtener la suma acumulada de traslados pendientes para el chofer
    const [pendienteRows] = await connection.query(
      `SELECT COALESCE(SUM(monto_chofer), 0) AS total_pendiente
       FROM traslados
       WHERE id_chofer = ? AND pagado_a_chofer = FALSE AND estado = 'completado'`,
      [id_chofer]
    );

    const total_pendiente = parseFloat(pendienteRows[0].total_pendiente);

    if (total_pendiente <= 0) {
      throw new Error('El chofer no tiene traslados pendientes por pagar.');
    }

    if (Math.abs(parseFloat(monto) - total_pendiente) > 0.05) {
      throw new Error(`El monto especificado ($${parseFloat(monto).toFixed(2)}) no coincide con el saldo pendiente exacto a liquidar ($${total_pendiente.toFixed(2)}).`);
    }

    // 2. Insertar el registro de pago en pagos_choferes
    const [pagoResult] = await connection.query(
      `INSERT INTO pagos_choferes (id_chofer, fecha_pago, nro_referencia, monto_pagado, id_admin) 
       VALUES (?, ?, ?, ?, ?)`,
      [id_chofer, fecha_pago, nro_referencia, total_pendiente, id_admin]
    );

    const id_pago = pagoResult.insertId;

    // 3. Actualizar los traslados pendientes del chofer asociándolos al pago
    await connection.query(
      `UPDATE traslados
       SET pagado_a_chofer = TRUE, id_pago = ?
       WHERE id_chofer = ? AND pagado_a_chofer = FALSE AND estado = 'completado'`,
      [id_pago, id_chofer]
    );

    await connection.commit();

    res.status(201).json({
      message: 'Pago procesado exitosamente y traslados liquidados.',
      id_pago,
      monto_pagado: total_pendiente.toFixed(2)
    });

  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message || 'Error al procesar el pago del chofer.' });
  } finally {
    connection.release();
  }
});

// 7. Reporte: Ganancias Totales de la Empresa (30% de comisiones) en un período
router.get('/reportes/ganancias', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;

  try {
    let query = `SELECT COALESCE(SUM(monto_empresa), 0) AS ganancias_totales,
                        COUNT(id_traslado) AS total_viajes
                 FROM traslados
                 WHERE estado = 'completado'`;
    const params = [];

    if (fecha_inicio && fecha_fin) {
      query += ` AND fecha >= ? AND fecha <= ?`;
      params.push(`${fecha_inicio} 00:00:00`, `${fecha_fin} 23:59:59`);
    } else if (fecha_inicio) {
      query += ` AND fecha >= ?`;
      params.push(`${fecha_inicio} 00:00:00`);
    } else if (fecha_fin) {
      query += ` AND fecha <= ?`;
      params.push(`${fecha_fin} 23:59:59`);
    }

    const [rows] = await pool.query(query, params);

    res.json({
      fecha_inicio: fecha_inicio || 'Histórico',
      fecha_fin: fecha_fin || 'Actual',
      ganancias_totales: parseFloat(rows[0].ganancias_totales).toFixed(2),
      total_viajes: rows[0].total_viajes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte de ganancias.' });
  }
});

// 8. Reporte: Monto Cancelado (Pagado) a un Chofer o todos en un período
router.get('/reportes/pagos-chofer', async (req, res) => {
  const { id_chofer, fecha_inicio, fecha_fin } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (id_chofer && id_chofer !== 'todos' && id_chofer !== '') {
      whereClause += ' AND p.id_chofer = ?';
      params.push(id_chofer);
    }

    if (fecha_inicio && fecha_fin) {
      whereClause += ' AND p.fecha_pago >= ? AND p.fecha_pago <= ?';
      params.push(fecha_inicio, fecha_fin);
    } else if (fecha_inicio) {
      whereClause += ' AND p.fecha_pago >= ?';
      params.push(fecha_inicio);
    } else if (fecha_fin) {
      whereClause += ' AND p.fecha_pago <= ?';
      params.push(fecha_fin);
    }

    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(p.monto_pagado), 0) AS total_cancelado
       FROM pagos_choferes p
       ${whereClause}`,
      params
    );

    const [detalles] = await pool.query(
      `SELECT p.id_pago, p.fecha_pago, p.nro_referencia, p.monto_pagado,
              u.nombre, u.apellido
       FROM pagos_choferes p
       JOIN choferes c ON p.id_chofer = c.id_usuario
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       ${whereClause}
       ORDER BY p.fecha_pago DESC`,
      params
    );

    const detallesConViajes = await Promise.all(
      detalles.map(async (pago) => {
        const [viajes] = await pool.query(
          `SELECT id_traslado, fecha, origen, destino, costo_total, monto_chofer, monto_empresa
           FROM traslados
           WHERE id_pago = ?
           ORDER BY fecha ASC`,
          [pago.id_pago]
        );
        return {
          ...pago,
          viajes
        };
      })
    );

    res.json({
      id_chofer: id_chofer || 'todos',
      fecha_inicio: fecha_inicio || 'Histórico',
      fecha_fin: fecha_fin || 'Actual',
      total_cancelado: parseFloat(rows[0].total_cancelado).toFixed(2),
      historial_pagos: detallesConViajes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte de pagos al chofer.' });
  }
});

// Endpoints de soporte para listas en el frontend administrativo
router.get('/reportes/listas/choferes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.cedula 
       FROM usuarios u 
       JOIN choferes c ON u.id_usuario = c.id_usuario 
       WHERE u.activo = TRUE 
       ORDER BY u.nombre, u.apellido ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener lista de choferes.' });
  }
});

router.get('/reportes/listas/vehiculos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT v.id_vehiculo, v.placa, v.marca, v.modelo, u.nombre AS chofer_nombre, u.apellido AS chofer_apellido 
       FROM vehiculos v 
       JOIN usuarios u ON v.id_chofer = u.id_usuario 
       WHERE v.activo = TRUE 
       ORDER BY v.placa ASC`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener lista de vehículos.' });
  }
});
router.put('/usuarios/:id/estado', async (req, res) => {
  if (req.user.tipo_usuario !== 'administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede activar o desactivar usuarios.' });
  }
  const { id } = req.params;
  const { activo } = req.body;

  if (activo === undefined || typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Debe enviar el campo activo (true o false).' });
  }

  try {
    const [userRows] = await pool.query('SELECT tipo_usuario FROM usuarios WHERE id_usuario = ?', [id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const [result] = await pool.query('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo, id]);

    // Notificar al usuario por correo (fire-and-forget)
    const [userData] = await pool.query('SELECT email, nombre FROM usuarios WHERE id_usuario = ?', [id]);
    if (userData.length > 0) {
      sendAccountStatusEmail(userData[0].email, userData[0].nombre, activo).catch((err) =>
        console.error('⚠️ Error al enviar correo de estado de cuenta:', err.message)
      );
    }

    res.json({
      message: activo ? 'Usuario reactivado exitosamente.' : 'Usuario desactivado exitosamente.',
      id_usuario: parseInt(id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el estado del usuario.' });
  }
});

router.put('/vehiculos/:id/estado', async (req, res) => {
  if (req.user.tipo_usuario !== 'administrador') {
    return res.status(403).json({ error: 'Solo un administrador puede activar o desactivar vehículos.' });
  }
  const { id } = req.params;
  const { activo } = req.body;

  if (activo === undefined || typeof activo !== 'boolean') {
    return res.status(400).json({ error: 'Debe enviar el campo activo (true o false).' });
  }

  try {
    const [vehRows] = await pool.query('SELECT 1 FROM vehiculos WHERE id_vehiculo = ?', [id]);
    if (vehRows.length === 0) {
      return res.status(404).json({ error: 'Vehiculo no encontrado.' });
    }

    await pool.query('UPDATE vehiculos SET activo = ? WHERE id_vehiculo = ?', [activo, id]);

    res.json({
      message: activo ? 'Vehiculo reactivado exitosamente.' : 'Vehiculo desactivado exitosamente.',
      id_vehiculo: parseInt(id)
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar el estado del vehiculo.' });
  }
});

module.exports = router;
