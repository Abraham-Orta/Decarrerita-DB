-- =====================================================================
-- Decarrerita-DB - Datos Semilla (Seeds) para Pruebas
-- Asignatura: Sistemas de Base de Datos I
-- =====================================================================

USE decarrerita_db;

-- 1. Insertar Bancos
INSERT INTO bancos (nombre) VALUES
('Banco de Venezuela'),
('Banesco Banco Universal'),
('Banco Mercantil'),
('BBVA Provincial'),
('Bancamiga');

-- 2. Insertar Usuarios
-- Contraseña encriptada para todos: '123456' (Bcrypt hash: $2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya)
INSERT INTO usuarios (email, password, nombre, apellido, telefono, cedula, tipo_usuario) VALUES
('admin@decarrerita.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Alejandro', 'Mendoza', '0414-1234567', 'V-11222333', 'administrador'),
('pedro.admin@decarrerita.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Pedro', 'Gómez', '0424-9876543', 'V-22333444', 'personal_administrativo'),
('maria.admin@decarrerita.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'María', 'Herrera', '0416-5554433', 'V-14555666', 'personal_administrativo'),
('juan.chofer@gmail.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Juan', 'Pérez', '0412-1112233', 'V-15888999', 'chofer'),
('carlos.chofer@gmail.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Carlos', 'Rodríguez', '0424-2223344', 'V-17999000', 'chofer'),
('luis.chofer@gmail.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Luis', 'Sánchez', '0414-3334455', 'V-19111222', 'chofer'),
('ana.cliente@gmail.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'Ana', 'Silva', '0412-4445566', 'V-20333444', 'cliente'),
('jose.cliente@gmail.com', '$2a$10$FqwhZ.8sQs.mQztMkhkBl.kzA0lcPB08gcAxubx7WsaFA7qTWnVya', 'José', 'Díaz', '0416-6667788', 'V-25666777', 'cliente');

-- 3. Especializar Clientes (id_usuario 7 y 8)
INSERT INTO clientes (id_usuario, saldo) VALUES
(7, 0.00), -- Ana iniciará con $0.00 y los triggers simularán la recarga real a $150.00 más abajo
(8, 0.00);    -- José inicia en $0.00

-- 4. Especializar Choferes (id_usuario 4, 5 y 6)
INSERT INTO choferes (id_usuario, id_banco, nro_cuenta) VALUES
(4, 1, '0102-0000-11-2233445566'), -- Juan en Banco de Venezuela
(5, 2, '0134-1111-22-3344556677'), -- Carlos en Banesco
(6, 3, '0105-2222-33-4455667788'); -- Luis en Mercantil

-- 5. Insertar Contactos de Emergencia (mínimo 2 por chofer)
INSERT INTO contactos_emergencia (id_chofer, nombre, telefono, relacion) VALUES
(4, 'Carmen Pérez', '0412-8889900', 'Madre'),
(4, 'Sofía Pérez', '0412-9990011', 'Hermana'),
(5, 'Gladys Rodríguez', '0424-7778899', 'Esposa'),
(5, 'Carlos Rodríguez Jr.', '0424-6665544', 'Hijo'),
(6, 'Elena Sánchez', '0414-4443322', 'Esposa'),
(6, 'Roberto Sánchez', '0414-2221100', 'Hermano');

-- 6. Insertar Evaluaciones Psicológicas de Choferes
-- Evaluador: Pedro Gómez (id 2) o María Herrera (id 3)
INSERT INTO evaluaciones_choferes (id_chofer, nota, fecha_evaluacion, id_admin) VALUES
(4, 85, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), 2), -- Aprobado (Juan)
(5, 78, DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH), 3), -- Aprobado (Carlos)
(6, 70, DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY), 2);   -- Reprobado (Luis, nota < 73)

-- 7. Insertar Vehículos de Choferes
INSERT INTO vehiculos (id_chofer, placa, marca, modelo, anio, color, activo) VALUES
(4, 'AA123BB', 'Toyota', 'Corolla', 2015, 'Gris', TRUE),      -- De Juan
(4, 'BB456CC', 'Chevrolet', 'Spark', 2012, 'Rojo', TRUE),      -- De Juan (segundo auto)
(5, 'CC789DD', 'Hyundai', 'Elantra', 2018, 'Blanco', TRUE),    -- De Carlos
(6, 'DD012EE', 'Ford', 'Fiesta', 2014, 'Azul', TRUE);          -- De Luis

-- 8. Insertar Evaluaciones de Vehículos
-- Evaluador: Pedro Gómez (id 2) o María Herrera (id 3)
INSERT INTO evaluaciones_vehiculos (id_vehiculo, nota, fecha_evaluacion, id_admin) VALUES
(1, 90, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), 2), -- Aprobado (Corolla de Juan)
(2, 60, DATE_SUB(CURRENT_DATE(), INTERVAL 10 DAY), 2), -- Reprobado (Spark de Juan, nota < 65)
(3, 82, DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH), 3), -- Aprobado (Elantra de Carlos)
(4, 75, DATE_SUB(CURRENT_DATE(), INTERVAL 5 DAY), 2);   -- Aprobado (Fiesta de Luis, pero Luis no está apto por psicología)

-- Nota: 
-- Choferes Aptos resultantes:
-- Juan (id 4) - Apto (Psicología 85 y Corolla aprobado)
-- Carlos (id 5) - Apto (Psicología 78 y Elantra aprobado)
-- Luis (id 6) - NO APTO (Psicología reprobada 70, aunque auto esté aprobado)

-- 9. Insertar Recargas de Saldo
-- Esto simula el registro de recargas e incrementa el saldo de los clientes mediante el Trigger
INSERT INTO recargas_saldo (id_cliente, nro_referencia, id_banco, monto, fecha) VALUES
(7, 'REF-998811', 2, 100.00, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 15 DAY)), -- Ana recarga $100
(7, 'REF-998822', 1, 50.00, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 DAY)),  -- Ana recarga $50
(8, 'REF-112233', 3, 40.00, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 DAY));   -- José recarga $40

-- 10. Insertar Traslados de Prueba
-- Nota: La inserción automática de traslados restará el dinero del cliente por el Trigger trg_before_insert_traslado
-- Traslado 1: Ana viaja con Juan
INSERT INTO traslados (id_cliente, id_chofer, id_vehiculo, origen, destino, distancia_km, costo_total, fecha, estado, pagado_a_chofer) VALUES
(7, 4, 1, 'Alta Vista, C.C. Orinokia', 'Unare II, Av. Principal', 5.50, 9.10, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 DAY), 'completado', TRUE);
-- Traslado 2: Ana viaja con Carlos
INSERT INTO traslados (id_cliente, id_chofer, id_vehiculo, origen, destino, distancia_km, costo_total, fecha, estado, pagado_a_chofer) VALUES
(7, 5, 3, 'Los Olivos', 'Villa Asia', 3.20, 6.34, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 4 DAY), 'completado', FALSE);
-- Traslado 3: José viaja con Juan
INSERT INTO traslados (id_cliente, id_chofer, id_vehiculo, origen, destino, distancia_km, costo_total, fecha, estado, pagado_a_chofer) VALUES
(8, 4, 1, 'San Félix, Plaza Bolívar', 'Puerto Ordaz, C.C. Macro Centro', 12.00, 16.90, DATE_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY), 'completado', FALSE);

-- 11. Insertar Pagos a Choferes (Liquidaciones por parte de administración)
-- Se registra que Pedro Gómez (id 2) le pagó a Juan (id 4) el Traslado 1 ($9.10 * 0.70 = $6.37)
INSERT INTO pagos_choferes (id_chofer, fecha_pago, nro_referencia, monto_pagado, id_admin) VALUES
(4, DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY), 'PAGO-REF-887711', 6.37, 2);

-- Actualizamos el traslado 1 para asociarlo al pago insertado
UPDATE traslados SET id_pago = 1 WHERE id_traslado = 1;
