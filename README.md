# Decarrerita - Sistema de Gestión de Traslados Urbano

Este proyecto es una solución integral de desarrollo para **Decarrerita**, una empresa de transporte urbano que utiliza flota liviana propiedad de los conductores. La solución incluye el diseño detallado de la Base de Datos en MySQL, una API REST robusta en Node.js y Express, y una interfaz de usuario web interactiva (Single Page Application - SPA) con un diseño premium en tema oscuro y Glassmorphism.

---

## 🛠️ Tecnologías Utilizadas

1.  **Base de Datos:** MySQL / MariaDB (Triggers, Vistas, Restricciones, Integridad Referencial).
2.  **Backend:** Node.js, Express, `mysql2/promise` (soporte `async/await`), JWT (`jsonwebtoken` para autenticación por roles), `bcryptjs` (cifrado de contraseñas).
3.  **Frontend:** HTML5 Semántico, CSS3 Vanilla (Glassmorphism, variables personalizadas, animaciones fluidas) y JavaScript Vanilla (SPA dinámico con llamadas Fetch).

---

## 📂 Estructura del Proyecto

```text
Decarrerita-DB/
├── docs/
│   └── diseno_db.md        # MER (Mermaid), Modelo Relacional, Reglas de negocio y Diccionario de datos.
├── database/
│   ├── schema.sql          # DDL: Creación de tablas, llaves, restricciones, vistas y triggers.
│   └── seed.sql            # DML: Datos iniciales y usuarios de prueba.
├── backend/
│   ├── src/
│   │   ├── config/db.js    # Configuración y Pool de conexiones de MySQL.
│   │   ├── middlewares/    # Middleware de autenticación y validación de roles por JWT.
│   │   ├── routes/         # Endpoints modulares (auth, clientes, choferes, admin).
│   │   └── app.js          # Punto de entrada del servidor Express.
│   ├── .env.example        # Plantilla de variables de entorno.
│   ├── .env                # Configuración local (ignorado en git).
│   └── package.json        # Dependencias de Node.js.
├── frontend/
│   ├── css/
│   │   └── style.css       # Estilos visuales de gama alta (Frosted glass y Dark mode).
│   ├── js/
│   │   └── app.js          # Controlador interactivo, manejo de vistas, modales y fetch.
│   └── index.html          # Interfaz web de usuario única (SPA).
└── README.md               # Instrucciones de ejecución.
```

---

## 🚀 Guía de Instalación y Ejecución

### 1. Configuración de la Base de Datos (MySQL)

1.  Asegúrate de tener un servidor MySQL / MariaDB en ejecución (ej: XAMPP, WampServer o MySQL Server nativo).
2.  Inicia sesión en tu terminal MySQL o gestor visual (phpMyAdmin, DBeaver, etc.) y ejecuta los scripts en orden:
    *   **Paso 1:** Ejecuta el archivo [database/schema.sql](file:///home/abraham/programacion/Decarrerita-DB/database/schema.sql) para crear la base de datos `decarrerita_db` y su estructura.
    *   **Paso 2:** Ejecuta el archivo [database/seed.sql](file:///home/abraham/programacion/Decarrerita-DB/database/seed.sql) para poblar el sistema con datos de prueba realistas.

### 2. Configuración y Ejecución del Backend (Node.js)

1.  Abre una terminal en la carpeta `backend/` del proyecto.
2.  Instala las dependencias de Node:
    ```bash
    npm install
    ```
3.  Copia el archivo de configuración de entorno (ya configurado para conectarse a `localhost` sin contraseña por defecto):
    ```bash
    cp .env.example .env
    ```
    *(Edita el archivo `.env` si tu servidor local de MySQL tiene un usuario o contraseña diferente, o si corre en otro puerto).*
4.  Inicia el servidor en modo desarrollo:
    ```bash
    npm run dev
    ```
    El servidor levantará en `http://localhost:3000`.

### 3. Ejecución del Frontend (SPA)

Dado que la aplicación web es estática y se comunica mediante API REST con el backend, puedes abrirla de dos formas:
*   **Opción A (Recomendada):** Usa la extensión **Live Server** en tu editor de código (como VS Code) para levantar el archivo [frontend/index.html](file:///home/abraham/programacion/Decarrerita-DB/frontend/index.html) en un servidor local (por ejemplo `http://127.0.0.1:5500`).
*   **Opción B:** Haz doble clic directamente en [frontend/index.html](file:///home/abraham/programacion/Decarrerita-DB/frontend/index.html) para abrirlo localmente en cualquier navegador web.

---

## 👥 Usuarios de Prueba Precargados

Todos los usuarios tienen la contraseña: **`123456`**

| Rol / Tipo de Usuario | Correo Electrónico (Login) | Notas / Estado inicial en la BD |
| :--- | :--- | :--- |
| **Administrador** | `admin@decarrerita.com` | Control total global. |
| **Personal Administrativo** | `pedro.admin@decarrerita.com` | Evaluaciones, pagos a choferes, reportes. |
| **Personal Administrativo** | `maria.admin@decarrerita.com` | Evaluaciones, pagos a choferes, reportes. |
| **Chofer (Apto - Juan)** | `juan.chofer@gmail.com` | **Apto.** Psicológica aprobada (85). Vehículo Toyota Corolla aprobado (90). |
| **Chofer (Apto - Carlos)** | `carlos.chofer@gmail.com` | **Apto.** Psicológica aprobada (78). Vehículo Hyundai Elantra aprobado (82). |
| **Chofer (No Apto - Luis)** | `luis.chofer@gmail.com` | **No Apto.** Reprobó psicología con 70 (mínima 73). No aparecerá en las asignaciones de traslados. |
| **Cliente (Ana)** | `ana.cliente@gmail.com` | Saldo inicial: **$150.00** para solicitar viajes inmediatamente. |
| **Cliente (José)** | `jose.cliente@gmail.com` | Saldo inicial: **$0.00**. Debe registrar una recarga de saldo antes de solicitar viajes. |

---

## 📈 Lógica Financiera e Integridad de Datos

1.  **Fórmula de Tarifa:** $Costo = 2.50 + (Distancia \times 1.20)$ (en USD).
2.  **Distribución de Ingresos:** Al completarse un viaje, el $100\%$ se descuenta del cliente. De forma autocalculada en la base de datos (columnas persistidas `monto_chofer` y `monto_empresa`), la empresa retiene el $30\%$ de comisión y el chofer acumula el $70\%$ restante.
3.  **Triggers de Integridad Financiera:**
    *   `trg_after_insert_recarga`: Incrementa el balance del cliente de forma síncrona al registrar un depósito.
    *   `trg_before_insert_traslado`: Verifica que el saldo del cliente sea mayor o igual al costo total del viaje. Si no, **aborta la transacción** en MySQL e impide saldos negativos. En caso de éxito, realiza el descuento.
4.  **Asignación de Traslados:** Al pedir un viaje, la API consulta la vista `vista_choferes_aptos` (que filtra automáticamente a choferes y vehículos con revisiones psicológicas/técnicas anuales aprobadas y vigentes). Luego, selecciona uno de manera **aleatoria** para garantizar la distribución equitativa de las solicitudes.
