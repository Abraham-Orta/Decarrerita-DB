const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middlewares/auth');

// Todas las rutas aquí requieren autenticación y rol de CLIENTE
router.use(authenticateToken, authorizeRoles('cliente'));

// 1. Registrar Recarga de Saldo
router.post('/recargas', async (req, res) => {
  const { nro_referencia, id_banco, monto } = req.body;
  const id_cliente = req.user.id_usuario;

  if (!nro_referencia || !id_banco || !monto) {
    return res.status(400).json({ error: 'Faltan campos para registrar la recarga.' });
  }

  if (parseFloat(monto) <= 0) {
    return res.status(400).json({ error: 'El monto de la recarga debe ser mayor a cero.' });
  }

  try {
    // Insertar recarga (el trigger trg_after_insert_recarga actualizará el saldo en clientes)
    const [result] = await pool.query(
      `INSERT INTO recargas_saldo (id_cliente, nro_referencia, id_banco, monto) 
       VALUES (?, ?, ?, ?)`,
      [id_cliente, nro_referencia, id_banco, monto]
    );

    res.status(201).json({
      message: 'Recarga registrada y en espera de aprobación administrativa.',
      id_recarga: result.insertId,
      estado: 'pendiente'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar la recarga de saldo.' });
  }
});

// 2. Obtener Historial de Recargas de Saldo
router.get('/recargas', async (req, res) => {
  const id_cliente = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      `SELECT r.id_recarga, r.fecha, r.nro_referencia, r.monto, b.nombre AS banco_origen
       FROM recargas_saldo r
       JOIN bancos b ON r.id_banco = b.id_banco
       WHERE r.id_cliente = ?
       ORDER BY r.fecha DESC`,
      [id_cliente]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de recargas.' });
  }
});

// 3. Obtener Historial de Traslados
router.get('/traslados', async (req, res) => {
  const id_cliente = req.user.id_usuario;

  try {
    const [rows] = await pool.query(
      `SELECT t.id_traslado, t.origen, t.destino, t.distancia_km, t.costo_total, t.fecha, t.estado,
              u.nombre AS chofer_nombre, u.apellido AS chofer_apellido, u.telefono AS chofer_telefono,
              v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.placa AS vehiculo_placa, v.color AS vehiculo_color
       FROM traslados t
       JOIN usuarios u ON t.id_chofer = u.id_usuario
       JOIN vehiculos v ON t.id_vehiculo = v.id_vehiculo
       WHERE t.id_cliente = ?
       ORDER BY t.fecha DESC`,
      [id_cliente]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el historial de traslados.' });
  }
});

// 4. Solicitar Traslado (Algoritmo de Costo + Selección Aleatoria de Chofer Apto)
router.post('/traslados', async (req, res) => {
  const { origen, destino, distancia_km } = req.body;
  const id_cliente = req.user.id_usuario;

  if (!origen || !destino || !distancia_km) {
    return res.status(400).json({ error: 'Debe ingresar origen, destino y distancia en kilómetros.' });
  }

  const dist = parseFloat(distancia_km);
  if (isNaN(dist) || dist <= 0) {
    return res.status(400).json({ error: 'La distancia debe ser un número mayor a cero.' });
  }

  // ALGORITMO DE COSTO: Tarifa Base $2.50 + $1.20 por Kilómetro
  const TARIFA_BASE = 2.50;
  const COSTO_POR_KM = 1.20;
  const costo_total = TARIFA_BASE + (dist * COSTO_POR_KM);

  try {
    // 1. Verificar si el cliente tiene saldo suficiente antes de cualquier consulta compleja
    const [clienteRows] = await pool.query('SELECT saldo FROM clientes WHERE id_usuario = ?', [id_cliente]);
    if (clienteRows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }
    const saldo_cliente = parseFloat(clienteRows[0].saldo);
    if (saldo_cliente < costo_total) {
      return res.status(400).json({ 
        error: `Saldo insuficiente. El costo del traslado es $${costo_total.toFixed(2)} pero tu saldo actual es $${saldo_cliente.toFixed(2)}.` 
      });
    }

    // 2. Obtener choferes y vehículos aptos desde la vista sql
    const [choferesAptos] = await pool.query('SELECT * FROM vista_choferes_aptos');

    if (choferesAptos.length === 0) {
      return res.status(400).json({ 
        error: 'En este momento no hay choferes disponibles que cumplan con la evaluación psicológica y revisión vehicular vigente.' 
      });
    }

    // 3. Selección Aleatoria de un chofer/vehículo apto
    const randomIndex = Math.floor(Math.random() * choferesAptos.length);
    const choferAsignado = choferesAptos[randomIndex];

    // 4. Insertar el traslado
    // El trigger trg_before_insert_traslado se encargará de restar automáticamente el saldo del cliente
    const [result] = await pool.query(
      `INSERT INTO traslados (id_cliente, id_chofer, id_vehiculo, origen, destino, distancia_km, costo_total, estado, pagado_a_chofer)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completado', FALSE)`,
      [
        id_cliente, 
        choferAsignado.id_chofer, 
        choferAsignado.id_vehiculo, 
        origen, 
        destino, 
        dist, 
        costo_total
      ]
    );

    res.status(201).json({
      message: 'Traslado solicitado y asignado exitosamente.',
      id_traslado: result.insertId,
      costo_total: costo_total.toFixed(2),
      chofer: {
        nombre: choferAsignado.chofer_nombre,
        apellido: choferAsignado.chofer_apellido,
        telefono: choferAsignado.chofer_telefono
      },
      vehiculo: {
        marca: choferAsignado.marca,
        modelo: choferAsignado.modelo,
        color: choferAsignado.color,
        placa: choferAsignado.placa
      }
    });

  } catch (error) {
    // Si ocurre un error en el trigger u otra parte, MySQL devolverá el error
    res.status(500).json({ error: error.message || 'Error al procesar la solicitud de traslado.' });
  }
});

module.exports = router;
