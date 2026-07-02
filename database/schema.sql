-- =====================================================================
-- Decarrerita-DB - Esquema de Base de Datos (MySQL / MariaDB)
-- Asignatura: Sistemas de Base de Datos I
-- =====================================================================

CREATE DATABASE IF NOT EXISTS decarrerita_db;
USE decarrerita_db;

-- Limpieza previa de tablas (en orden inverso de dependencias)
DROP TABLE IF EXISTS traslados;
DROP TABLE IF EXISTS pagos_choferes;
DROP TABLE IF EXISTS recargas_saldo;
DROP TABLE IF EXISTS evaluaciones_vehiculos;
DROP TABLE IF EXISTS vehiculos;
DROP TABLE IF EXISTS evaluaciones_choferes;
DROP TABLE IF EXISTS contactos_emergencia;
DROP TABLE IF EXISTS choferes;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS bancos;

-- 1. Tabla de Bancos
CREATE TABLE bancos (
    id_banco INT AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    CONSTRAINT pk_bancos PRIMARY KEY (id_banco),
    CONSTRAINT uq_banco_nombre UNIQUE (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Tabla de Usuarios
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    cedula VARCHAR(20) NOT NULL,
    tipo_usuario ENUM('administrador', 'chofer', 'cliente', 'personal_administrativo') NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_usuarios PRIMARY KEY (id_usuario),
    CONSTRAINT uq_usuario_email UNIQUE (email),
    CONSTRAINT uq_usuario_cedula UNIQUE (cedula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tabla de Clientes (Relación 1:1 con Usuarios - Especialización)
CREATE TABLE clientes (
    id_usuario INT,
    saldo DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT pk_clientes PRIMARY KEY (id_usuario),
    CONSTRAINT fk_clientes_usuarios FOREIGN KEY (id_usuario) 
        REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
    CONSTRAINT chk_cliente_saldo CHECK (saldo >= 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Tabla de Choferes (Relación 1:1 con Usuarios - Especialización)
CREATE TABLE choferes (
    id_usuario INT,
    id_banco INT NOT NULL,
    nro_cuenta VARCHAR(30) NOT NULL,
    CONSTRAINT pk_choferes PRIMARY KEY (id_usuario),
    CONSTRAINT fk_choferes_usuarios FOREIGN KEY (id_usuario) 
        REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_choferes_bancos FOREIGN KEY (id_banco) 
        REFERENCES bancos (id_banco)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Contactos de Emergencia (Choferes deben tener al menos dos, controlado en frontend/backend)
CREATE TABLE contactos_emergencia (
    id_contacto INT AUTO_INCREMENT,
    id_chofer INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    relacion VARCHAR(50) NOT NULL,
    CONSTRAINT pk_contactos PRIMARY KEY (id_contacto),
    CONSTRAINT fk_contactos_choferes FOREIGN KEY (id_chofer) 
        REFERENCES choferes (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Evaluaciones Psicológicas de Choferes (Vigencia anual)
CREATE TABLE evaluaciones_choferes (
    id_evaluacion INT AUTO_INCREMENT,
    id_chofer INT NOT NULL,
    nota INT NOT NULL,
    fecha_evaluacion DATE NOT NULL,
    aprobado BOOLEAN GENERATED ALWAYS AS (nota >= 73) STORED,
    id_admin INT NOT NULL,
    CONSTRAINT pk_eval_chofer PRIMARY KEY (id_evaluacion),
    CONSTRAINT fk_eval_chofer_chofer FOREIGN KEY (id_chofer) 
        REFERENCES choferes (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_eval_chofer_admin FOREIGN KEY (id_admin) 
        REFERENCES usuarios (id_usuario),
    CONSTRAINT chk_eval_chofer_nota CHECK (nota BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Vehículos (Pertenecen a los Choferes. Un chofer puede tener varios)
CREATE TABLE vehiculos (
    id_vehiculo INT AUTO_INCREMENT,
    id_chofer INT NOT NULL,
    placa VARCHAR(15) NOT NULL,
    marca VARCHAR(50) NOT NULL,
    modelo VARCHAR(50) NOT NULL,
    anio INT NOT NULL,
    color VARCHAR(30) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_vehiculos PRIMARY KEY (id_vehiculo),
    CONSTRAINT uq_vehiculo_placa UNIQUE (placa),
    CONSTRAINT fk_vehiculos_choferes FOREIGN KEY (id_chofer) 
        REFERENCES choferes (id_usuario) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Evaluaciones / Revisiones de Vehículos (Vigencia anual)
CREATE TABLE evaluaciones_vehiculos (
    id_evaluacion_veh INT AUTO_INCREMENT,
    id_vehiculo INT NOT NULL,
    nota INT NOT NULL,
    fecha_evaluacion DATE NOT NULL,
    aprobado BOOLEAN GENERATED ALWAYS AS (nota >= 65) STORED,
    id_admin INT NOT NULL,
    CONSTRAINT pk_eval_veh PRIMARY KEY (id_evaluacion_veh),
    CONSTRAINT fk_eval_veh_vehiculo FOREIGN KEY (id_vehiculo) 
        REFERENCES vehiculos (id_vehiculo) ON DELETE CASCADE,
    CONSTRAINT fk_eval_veh_admin FOREIGN KEY (id_admin) 
        REFERENCES usuarios (id_usuario),
    CONSTRAINT chk_eval_veh_nota CHECK (nota BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Recargas de Saldo por parte de Clientes
CREATE TABLE recargas_saldo (
    id_recarga INT AUTO_INCREMENT,
    id_cliente INT NOT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nro_referencia VARCHAR(50) NOT NULL,
    id_banco INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    CONSTRAINT pk_recargas PRIMARY KEY (id_recarga),
    CONSTRAINT fk_recargas_clientes FOREIGN KEY (id_cliente) 
        REFERENCES clientes (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_recargas_bancos FOREIGN KEY (id_banco) 
        REFERENCES bancos (id_banco),
    CONSTRAINT chk_recarga_monto CHECK (monto > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Pagos a Choferes por parte del Personal Administrativo
CREATE TABLE pagos_choferes (
    id_pago INT AUTO_INCREMENT,
    id_chofer INT NOT NULL,
    fecha_pago DATE NOT NULL,
    nro_referencia VARCHAR(50) NOT NULL,
    monto_pagado DECIMAL(10, 2) NOT NULL,
    id_admin INT NOT NULL,
    CONSTRAINT pk_pagos_choferes PRIMARY KEY (id_pago),
    CONSTRAINT fk_pagos_choferes_chofer FOREIGN KEY (id_chofer) 
        REFERENCES choferes (id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_pagos_choferes_admin FOREIGN KEY (id_admin) 
        REFERENCES usuarios (id_usuario),
    CONSTRAINT chk_pago_monto CHECK (monto_pagado > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Traslados
CREATE TABLE traslados (
    id_traslado INT AUTO_INCREMENT,
    id_cliente INT NOT NULL,
    id_chofer INT NOT NULL,
    id_vehiculo INT NOT NULL,
    origen VARCHAR(255) NOT NULL,
    destino VARCHAR(255) NOT NULL,
    distancia_km DECIMAL(5, 2) NOT NULL,
    costo_total DECIMAL(10, 2) NOT NULL,
    monto_chofer DECIMAL(10, 2) GENERATED ALWAYS AS (costo_total * 0.70) STORED,
    monto_empresa DECIMAL(10, 2) GENERATED ALWAYS AS (costo_total * 0.30) STORED,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('pendiente', 'completado', 'cancelado_empresa') NOT NULL DEFAULT 'completado',
    pagado_a_chofer BOOLEAN NOT NULL DEFAULT FALSE,
    id_pago INT NULL,
    CONSTRAINT pk_traslados PRIMARY KEY (id_traslado),
    CONSTRAINT fk_traslados_clientes FOREIGN KEY (id_cliente) 
        REFERENCES clientes (id_usuario),
    CONSTRAINT fk_traslados_choferes FOREIGN KEY (id_chofer) 
        REFERENCES choferes (id_usuario),
    CONSTRAINT fk_traslados_vehiculos FOREIGN KEY (id_vehiculo) 
        REFERENCES vehiculos (id_vehiculo),
    CONSTRAINT fk_traslados_pagos FOREIGN KEY (id_pago) 
        REFERENCES pagos_choferes (id_pago) ON DELETE SET NULL,
    CONSTRAINT chk_traslado_costo CHECK (costo_total > 0.00),
    CONSTRAINT chk_traslado_distancia CHECK (distancia_km > 0.00)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================================
-- DISPARADORES (TRIGGERS) PARA LA LÓGICA DE NEGOCIO
-- =====================================================================

DELIMITER $$

-- Trigger 1: Aumentar saldo del cliente tras una recarga exitosa
CREATE TRIGGER trg_after_insert_recarga
AFTER INSERT ON recargas_saldo
FOR EACH ROW
BEGIN
    UPDATE clientes
    SET saldo = saldo + NEW.monto
    WHERE id_usuario = NEW.id_cliente;
END$$

-- Trigger 2: Validar y descontar saldo del cliente al solicitar un traslado
CREATE TRIGGER trg_before_insert_traslado
BEFORE INSERT ON traslados
FOR EACH ROW
BEGIN
    DECLARE v_saldo_cliente DECIMAL(10, 2);
    
    -- Obtener el saldo actual del cliente
    SELECT saldo INTO v_saldo_cliente
    FROM clientes
    WHERE id_usuario = NEW.id_cliente;
    
    -- Validar saldo suficiente
    IF v_saldo_cliente < NEW.costo_total THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Saldo insuficiente para realizar el traslado.';
    ELSE
        -- Descontar el saldo del cliente
        UPDATE clientes
        SET saldo = saldo - NEW.costo_total
        WHERE id_usuario = NEW.id_cliente;
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- VISTAS ÚTILES PARA REPORTES Y FILTROS
-- =====================================================================

-- Vista de Choferes Aptos (Con evaluación psicológica aprobada y vigente, y al menos un vehículo aprobado y vigente)
CREATE OR REPLACE VIEW vista_choferes_aptos AS
SELECT 
    c.id_usuario AS id_chofer,
    u.nombre AS chofer_nombre,
    u.apellido AS chofer_apellido,
    u.telefono AS chofer_telefono,
    v.id_vehiculo,
    v.placa,
    v.marca,
    v.modelo,
    v.color
FROM choferes c
JOIN usuarios u ON c.id_usuario = u.id_usuario
JOIN vehiculos v ON c.id_usuario = v.id_chofer
-- Evaluación de chofer vigente y aprobada (menos de 365 días)
JOIN (
    SELECT id_chofer, MAX(fecha_evaluacion) as ultima_fecha
    FROM evaluaciones_choferes
    WHERE aprobado = TRUE
    GROUP BY id_chofer
) ec_max ON c.id_usuario = ec_max.id_chofer
JOIN evaluaciones_choferes ec ON ec.id_chofer = ec_max.id_chofer 
    AND ec.fecha_evaluacion = ec_max.ultima_fecha
-- Evaluación del vehículo vigente y aprobada (menos de 365 días)
JOIN (
    SELECT id_vehiculo, MAX(fecha_evaluacion) as ultima_fecha
    FROM evaluaciones_vehiculos
    WHERE aprobado = TRUE
    GROUP BY id_vehiculo
) ev_max ON v.id_vehiculo = ev_max.id_vehiculo
JOIN evaluaciones_vehiculos ev ON ev.id_vehiculo = ev_max.id_vehiculo 
    AND ev.fecha_evaluacion = ev_max.ultima_fecha
WHERE 
    u.activo = TRUE 
    AND v.activo = TRUE
    AND DATEDIFF(CURRENT_DATE(), ec.fecha_evaluacion) <= 365
    AND DATEDIFF(CURRENT_DATE(), ev.fecha_evaluacion) <= 365;

-- Vista de Resumen de Saldos de Choferes
CREATE OR REPLACE VIEW vista_saldos_choferes AS
SELECT 
    c.id_usuario AS id_chofer,
    u.nombre,
    u.apellido,
    -- Saldo total acumulado por traslados que aún no se le han pagado
    COALESCE(SUM(CASE WHEN t.pagado_a_chofer = FALSE AND t.estado = 'completado' THEN t.monto_chofer ELSE 0 END), 0) AS saldo_pendiente,
    -- Saldo total ya pagado al chofer
    COALESCE(SUM(CASE WHEN t.pagado_a_chofer = TRUE AND t.estado = 'completado' THEN t.monto_chofer ELSE 0 END), 0) AS saldo_pagado
FROM choferes c
JOIN usuarios u ON c.id_usuario = u.id_usuario
LEFT JOIN traslados t ON c.id_usuario = t.id_chofer
GROUP BY c.id_usuario, u.nombre, u.apellido;
