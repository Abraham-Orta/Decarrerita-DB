const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Todas las rutas aquí requieren autenticación y rol de CHOFER
router.use(authenticateToken, authorizeRoles('chofer'));

// 1. Registrar un Vehículo
router.post('/vehiculos', async (req, res) => {
  const { placa, marca, modelo, anio, color } = req.body;
  const id_chofer = req.user.id_usuario;

  if (!placa || !marca || !modelo || !anio || !color) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para registrar el vehículo.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO vehiculos (id_chofer, placa, marca, modelo, anio, color, activo) 
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [id_chofer, placa, marca, modelo, anio, color]
    );

    res.status(201).json({
      message: 'Vehículo registrado exitosamente.',
      id_vehiculo: result.insertId
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'La placa ya está registrada en el sistema.' });
    }
    res.status(500).json({ error: 'Error al registrar el vehículo.' });
  }
});

// 2. Obtener Vehículos Registrados por el Chofer
router.get('/vehiculos', async (req, res) => {
  const id_chofer = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      `SELECT v.id_vehiculo, v.placa, v.marca, v.modelo, v.anio, v.color, v.activo,
              ev.nota AS ultima_revision_nota, ev.fecha_evaluacion AS ultima_revision_fecha, ev.aprobado AS revision_aprobada
       FROM vehiculos v
       LEFT JOIN (
           -- Obtener la última evaluación de cada vehículo
           SELECT id_vehiculo, nota, fecha_evaluacion, aprobado
           FROM evaluaciones_vehiculos ev1
           WHERE id_evaluacion_veh = (
               SELECT MAX(id_evaluacion_veh) 
               FROM evaluaciones_vehiculos ev2 
               WHERE ev2.id_vehiculo = ev1.id_vehiculo
           )
       ) ev ON v.id_vehiculo = ev.id_vehiculo
       WHERE v.id_chofer = ?`,
      [id_chofer]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los vehículos del chofer.' });
  }
});

// 3. Obtener Balance Financiero del Chofer (Pendiente vs Pagado)
router.get('/balance', async (req, res) => {
  const id_chofer = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      'SELECT saldo_pendiente, saldo_pagado FROM vista_saldos_choferes WHERE id_chofer = ?',
      [id_chofer]
    );
    
    if (rows.length === 0) {
      return res.json({ saldo_pendiente: 0.00, saldo_pagado: 0.00 });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el balance financiero.' });
  }
});

// 4. Obtener todos los Traslados Realizados (con filtro opcional de fechas)
router.get('/traslados', async (req, res) => {
  const id_chofer = req.user.id_usuario;
  const { fecha_inicio, fecha_fin } = req.query;

  let query = `
    SELECT t.id_traslado, t.origen, t.destino, t.distancia_km, t.costo_total, t.monto_chofer, t.fecha, t.estado, t.pagado_a_chofer,
           u.nombre AS cliente_nombre, u.apellido AS cliente_apellido,
           v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa
    FROM traslados t
    JOIN usuarios u ON t.id_cliente = u.id_usuario
    JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
    WHERE t.id_chofer = ?
  `;
  const queryParams = [id_chofer];

  if (fecha_inicio) {
    query += ' AND t.fecha >= ?';
    queryParams.push(`${fecha_inicio} 00:00:00`);
  }
  if (fecha_fin) {
    query += ' AND t.fecha <= ?';
    queryParams.push(`${fecha_fin} 23:59:59`);
  }

  query += ' ORDER BY t.fecha DESC';

  try {
    const [rows] = await pool.query(query, queryParams);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los traslados.' });
  }
});

// 5. Traslados Pagados (Cancelados por la Empresa)
router.get('/traslados/pagados', async (req, res) => {
  const id_chofer = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      `SELECT t.id_traslado, t.origen, t.destino, t.distancia_km, t.monto_chofer, t.fecha,
              p.fecha_pago, p.nro_referencia AS pago_referencia
       FROM traslados t
       LEFT JOIN pagos_choferes p ON t.id_pago = p.id_pago
       WHERE t.id_chofer = ? AND t.pagado_a_chofer = TRUE AND t.estado = 'completado'
       ORDER BY t.fecha DESC`,
      [id_chofer]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener traslados pagados.' });
  }
});

// 6. Traslados Pendientes por Pagar (Pendientes por Cancelar)
router.get('/traslados/pendientes', async (req, res) => {
  const id_chofer = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      `SELECT id_traslado, origen, destino, distancia_km, monto_chofer, fecha
       FROM traslados
       WHERE id_chofer = ? AND pagado_a_chofer = FALSE AND estado = 'completado'
       ORDER BY fecha DESC`,
      [id_chofer]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener traslados pendientes.' });
  }
});

module.exports = router;
