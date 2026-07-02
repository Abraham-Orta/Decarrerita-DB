const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Requiere rol de personal_administrativo o administrador
router.use(authenticateToken, authorizeRoles('personal_administrativo', 'administrador'));

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

// 6. Cancelar (Pagar) Traslados a un Chofer
router.post('/pagos', async (req, res) => {
  const { id_chofer, fecha_pago, nro_referencia } = req.body;
  const id_admin = req.user.id_usuario;

  if (!id_chofer || !fecha_pago || !nro_referencia) {
    return res.status(400).json({ error: 'Faltan campos requeridos (id_chofer, fecha_pago, nro_referencia).' });
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

  if (!fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Debe especificar fecha_inicio y fecha_fin.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(monto_empresa), 0) AS ganancias_totales,
              COUNT(id_traslado) AS total_viajes
       FROM traslados
       WHERE estado = 'completado' AND fecha >= ? AND fecha <= ?`,
      [`${fecha_inicio} 00:00:00`, `${fecha_fin} 23:59:59`]
    );

    res.json({
      fecha_inicio,
      fecha_fin,
      ganancias_totales: parseFloat(rows[0].ganancias_totales).toFixed(2),
      total_viajes: rows[0].total_viajes
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar el reporte de ganancias.' });
  }
});

// 8. Reporte: Monto Cancelado (Pagado) a un Chofer específico en un período
router.get('/reportes/pagos-chofer', async (req, res) => {
  const { id_chofer, fecha_inicio, fecha_fin } = req.query;

  if (!id_chofer || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ error: 'Faltan parámetros de consulta (id_chofer, fecha_inicio, fecha_fin).' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT COALESCE(SUM(monto_pagado), 0) AS total_cancelado
       FROM pagos_choferes
       WHERE id_chofer = ? AND fecha_pago >= ? AND fecha_pago <= ?`,
      [id_chofer, fecha_inicio, fecha_fin]
    );

    const [detalles] = await pool.query(
      `SELECT id_pago, fecha_pago, nro_referencia, monto_pagado
       FROM pagos_choferes
       WHERE id_chofer = ? AND fecha_pago >= ? AND fecha_pago <= ?
       ORDER BY fecha_pago DESC`,
      [id_chofer, fecha_inicio, fecha_fin]
    );

    res.json({
      id_chofer,
      fecha_inicio,
      fecha_fin,
      total_cancelado: parseFloat(rows[0].total_cancelado).toFixed(2),
      historial_pagos: detalles
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

module.exports = router;
