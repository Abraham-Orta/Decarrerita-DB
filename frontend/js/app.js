// URL base de la API
const API_URL = 'http://localhost:3001/api';

// Estado global de la aplicación
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('user')) || null;

// =====================================================================
// HELPER: Notificaciones Flotantes Premium (Toasts)
// =====================================================================
function showToast(message, type = 'success') {
    // Eliminar previos
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'info') icon = 'fa-circle-info';
    
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
    
    // Inyectar estilos básicos de toast dinámicamente al final de la hoja si no existen
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.innerHTML = `
            .toast-notification {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                background: #18181b;
                border: 1px solid rgba(255,255,255,0.08);
                color: #f4f4f5;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 0.75rem;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                z-index: 1000;
                transform: translateY(100px);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: 'Outfit', sans-serif;
                font-weight: 500;
            }
            .toast-notification.show {
                transform: translateY(0);
                opacity: 1;
            }
            .toast-success i { color: #10b981; }
            .toast-error i { color: #f43f5e; }
            .toast-info i { color: #6366f1; }
            .toast-success { border-color: rgba(16,185,129,0.2); }
            .toast-error { border-color: rgba(244,63,94,0.2); }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 50);
    
    // Auto-remove
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Helper para peticiones HTTP autorizadas
async function apiRequest(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    try {
        const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Ocurrió un error en la solicitud.');
        }
        return data;
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error.message);
        throw error;
    }
}

// =====================================================================
// NAVEGACIÓN Y CONTROL DE VISTAS (SPA)
// =====================================================================
function showView(viewName) {
    // Ocultar todas las vistas principales
    document.getElementById('view-auth').classList.add('hidden');
    document.getElementById('view-cliente').classList.add('hidden');
    document.getElementById('view-chofer').classList.add('hidden');
    document.getElementById('view-admin').classList.add('hidden');
    
    // Ocultar cabecera por defecto si estamos en auth
    if (viewName === 'auth') {
        document.getElementById('app-header').classList.add('hidden');
    } else {
        document.getElementById('app-header').classList.remove('hidden');
        
        // Actualizar datos del usuario en la barra superior
        document.getElementById('nav-user-name').textContent = `${currentUser.nombre} ${currentUser.apellido}`;
        document.getElementById('nav-user-role').textContent = currentUser.tipo_usuario.replace('_', ' ');
    }

    // Mostrar la vista objetivo
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');
}

// Inicialización de la sesión activa al cargar la página
async function initSession() {
    if (token && currentUser) {
        try {
            // Validar token y refrescar datos haciendo GET /me
            const data = await apiRequest('/auth/me');
            currentUser = data;
            localStorage.setItem('user', JSON.stringify(currentUser));
            
            // Redirigir según el tipo de usuario
            if (currentUser.tipo_usuario === 'cliente') {
                showView('cliente');
                initClienteDashboard();
            } else if (currentUser.tipo_usuario === 'chofer') {
                showView('chofer');
                initChoferDashboard();
            } else if (['personal_administrativo', 'administrador'].includes(currentUser.tipo_usuario)) {
                showView('admin');
                initAdminDashboard();
            }
        } catch (error) {
            // Limpiar datos corruptos/expirados
            logout();
        }
    } else {
        showView('auth');
        loadPublicBancos();
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showView('auth');
    showToast('Sesión cerrada correctamente.', 'info');
    loadPublicBancos();
}

// Cargar la lista pública de bancos para el registro
async function loadPublicBancos() {
    try {
        const bancos = await apiRequest('/auth/bancos');
        const selectRegBanco = document.getElementById('reg-banco');
        selectRegBanco.innerHTML = '<option value="">-- Selecciona un Banco --</option>';
        bancos.forEach(b => {
            selectRegBanco.innerHTML += `<option value="${b.id_banco}">${b.nombre}</option>`;
        });
        
        // Cargar en modal de recargas del cliente también
        const selectRecargaBanco = document.getElementById('recarga-banco');
        if (selectRecargaBanco) {
            selectRecargaBanco.innerHTML = '<option value="">-- Selecciona tu Banco --</option>';
            bancos.forEach(b => {
                selectRecargaBanco.innerHTML += `<option value="${b.id_banco}">${b.nombre}</option>`;
            });
        }
    } catch (err) {
        console.error('No se pudieron precargar los bancos base.');
    }
}

// =====================================================================
// AUTENTICACIÓN (LOGIN & REGISTRO) - EVENTOS
// =====================================================================

// Intercambio de pestañas Login/Registro
document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('form-login').classList.remove('hidden');
    document.getElementById('form-register').classList.add('hidden');
});

document.getElementById('tab-register').addEventListener('click', () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('form-register').classList.remove('hidden');
    document.getElementById('form-login').classList.add('hidden');
});

// Mostrar campos de chofer si selecciona chofer
document.getElementById('reg-rol').addEventListener('change', (e) => {
    const choferFields = document.getElementById('chofer-fields');
    if (e.target.value === 'chofer') {
        choferFields.classList.remove('hidden');
        // Hacer campos requeridos
        document.getElementById('reg-banco').required = true;
        document.getElementById('reg-cuenta').required = true;
        document.getElementById('reg-c1-nombre').required = true;
        document.getElementById('reg-c1-telefono').required = true;
        document.getElementById('reg-c1-relacion').required = true;
        document.getElementById('reg-c2-nombre').required = true;
        document.getElementById('reg-c2-telefono').required = true;
        document.getElementById('reg-c2-relacion').required = true;
    } else {
        choferFields.classList.add('hidden');
        // Quitar requeridos
        document.getElementById('reg-banco').required = false;
        document.getElementById('reg-cuenta').required = false;
        document.getElementById('reg-c1-nombre').required = false;
        document.getElementById('reg-c1-telefono').required = false;
        document.getElementById('reg-c1-relacion').required = false;
        document.getElementById('reg-c2-nombre').required = false;
        document.getElementById('reg-c2-telefono').required = false;
        document.getElementById('reg-c2-relacion').required = false;
    }
});

// Manejo del Login
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        token = response.token;
        currentUser = response.user;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        showToast('¡Bienvenido de vuelta!', 'success');
        
        // Redirigir según el tipo
        initSession();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Manejo del Registro
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const nombre = document.getElementById('reg-nombre').value;
    const apellido = document.getElementById('reg-apellido').value;
    const cedula = document.getElementById('reg-cedula').value;
    const telefono = document.getElementById('reg-telefono').value;
    const tipo_usuario = document.getElementById('reg-rol').value;

    let payload = { email, password, nombre, apellido, cedula, telefono, tipo_usuario };

    if (tipo_usuario === 'chofer') {
        payload.id_banco = document.getElementById('reg-banco').value;
        payload.nro_cuenta = document.getElementById('reg-cuenta').value;
        
        payload.contactos_emergencia = [
            {
                nombre: document.getElementById('reg-c1-nombre').value,
                telefono: document.getElementById('reg-c1-telefono').value,
                relacion: document.getElementById('reg-c1-relacion').value
            },
            {
                nombre: document.getElementById('reg-c2-nombre').value,
                telefono: document.getElementById('reg-c2-telefono').value,
                relacion: document.getElementById('reg-c2-relacion').value
            }
        ];
    }

    try {
        await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        showToast('Registro exitoso. Inicia sesión ahora.', 'success');
        
        // Volver al formulario de login
        document.getElementById('tab-login').click();
        document.getElementById('form-login').reset();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// =====================================================================
// PANEL DE CLIENTE (LÓGICA & EVENTOS)
// =====================================================================
function initClienteDashboard() {
    loadClienteSaldo();
    loadClienteRecargas();
    loadClienteViajes();
    loadPublicBancos(); // Asegura bancos en el modal de recargas
}

async function loadClienteSaldo() {
    try {
        const data = await apiRequest('/auth/me');
        document.getElementById('cliente-saldo-val').textContent = parseFloat(data.saldo).toFixed(2);
    } catch (err) {
        console.error(err);
    }
}

// Historial de Recargas
async function loadClienteRecargas() {
    try {
        const recargas = await apiRequest('/clientes/recargas');
        const tbody = document.getElementById('table-cliente-recargas-body');
        tbody.innerHTML = '';
        
        if (recargas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">No has registrado recargas de saldo aún.</td></tr>';
            return;
        }

        recargas.forEach(r => {
            const fecha = new Date(r.fecha).toLocaleDateString('es-VE', { hour: '2-digit', minute: '2-digit' });
            tbody.innerHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td><code>${r.nro_referencia}</code></td>
                    <td>${r.banco_origen}</td>
                    <td class="color-green font-bold">+$${parseFloat(r.monto).toFixed(2)}</td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error al cargar recargas.', 'error');
    }
}

// Historial de Traslados del Cliente
async function loadClienteViajes() {
    try {
        const viajes = await apiRequest('/clientes/traslados');
        const tbody = document.getElementById('table-cliente-viajes-body');
        tbody.innerHTML = '';

        if (viajes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No has solicitado traslados aún.</td></tr>';
            return;
        }

        viajes.forEach(v => {
            const fecha = new Date(v.fecha).toLocaleDateString('es-VE', { hour: '2-digit', minute: '2-digit' });
            const estadoBadge = v.estado === 'completado' 
                ? '<span class="status-badge badge-success">Completado</span>'
                : '<span class="status-badge badge-danger">Cancelado</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td>
                        <div class="table-route-cell">
                            <span class="route-pt route-a"><i class="fa-solid fa-location-dot"></i> ${v.origen}</span>
                            <span class="route-pt route-b"><i class="fa-solid fa-flag-checkered"></i> ${v.destino}</span>
                        </div>
                    </td>
                    <td>${v.distancia_km} Km</td>
                    <td class="font-bold">$${parseFloat(v.costo_total).toFixed(2)}</td>
                    <td>
                        <div>${v.chofer_nombre} ${v.chofer_apellido}</div>
                        <small class="text-secondary">${v.chofer_telefono}</small>
                    </td>
                    <td>
                        <div>${v.vehiculo_marca} ${v.vehiculo_modelo}</div>
                        <span class="plate-badge">${v.vehiculo_placa}</span>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error al cargar viajes.', 'error');
    }
}

// Control de Tabs en Panel de Cliente
document.getElementById('tab-historial-viajes').addEventListener('click', (e) => {
    document.getElementById('tab-historial-viajes').classList.add('active');
    document.getElementById('tab-historial-recargas').classList.remove('active');
    document.getElementById('panel-historial-viajes').classList.remove('hidden');
    document.getElementById('panel-historial-recargas').classList.add('hidden');
});

document.getElementById('tab-historial-recargas').addEventListener('click', (e) => {
    document.getElementById('tab-historial-recargas').classList.add('active');
    document.getElementById('tab-historial-viajes').classList.remove('active');
    document.getElementById('panel-historial-recargas').classList.remove('hidden');
    document.getElementById('panel-historial-viajes').classList.add('hidden');
});

// Modales del Cliente (Carga Saldo)
document.getElementById('btn-open-recarga').addEventListener('click', () => {
    document.getElementById('modal-recarga').classList.remove('hidden');
});

// Calcular costo del traslado en tiempo real en base a distancia
document.getElementById('ride-distancia').addEventListener('input', (e) => {
    const dist = parseFloat(e.target.value);
    if (!isNaN(dist) && dist > 0) {
        const costo = 2.50 + (dist * 1.20);
        document.getElementById('ride-fare-est').textContent = costo.toFixed(2);
    } else {
        document.getElementById('ride-fare-est').textContent = '2.50';
    }
});

// Formulario: Solicitar Traslado
document.getElementById('form-request-ride').addEventListener('submit', async (e) => {
    e.preventDefault();
    const origen = document.getElementById('ride-origen').value;
    const destino = document.getElementById('ride-destino').value;
    const distancia_km = document.getElementById('ride-distancia').value;

    try {
        const res = await apiRequest('/clientes/traslados', {
            method: 'POST',
            body: JSON.stringify({ origen, destino, distancia_km })
        });

        // Llenar datos de éxito en el modal
        document.getElementById('assigned-driver-name').textContent = `${res.chofer.nombre} ${res.chofer.apellido}`;
        document.getElementById('assigned-driver-phone').textContent = res.chofer.telefono;
        document.getElementById('assigned-veh-model').textContent = `${res.vehiculo.marca} ${res.vehiculo.modelo}`;
        document.getElementById('assigned-veh-plate').textContent = res.vehiculo.placa;
        document.getElementById('assigned-veh-color').textContent = res.vehiculo.color;
        document.getElementById('assigned-ride-cost').textContent = parseFloat(res.costo_total).toFixed(2);

        // Mostrar modal de éxito
        document.getElementById('modal-ride-success').classList.remove('hidden');
        
        // Resetear formulario
        document.getElementById('form-request-ride').reset();
        document.getElementById('ride-fare-est').textContent = '2.50';
        
        // Recargar interfaz del cliente
        loadClienteSaldo();
        loadClienteViajes();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Cerrar modal de asignación exitosa
document.querySelector('.btn-close-success').addEventListener('click', () => {
    document.getElementById('modal-ride-success').classList.add('hidden');
});

// Formulario: Registrar Recarga
document.getElementById('form-recarga').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id_banco = document.getElementById('recarga-banco').value;
    const nro_referencia = document.getElementById('recarga-referencia').value;
    const monto = document.getElementById('recarga-monto').value;

    try {
        const data = await apiRequest('/clientes/recargas', {
            method: 'POST',
            body: JSON.stringify({ id_banco, nro_referencia, monto })
        });

        showToast(data.message, 'success');
        document.getElementById('modal-recarga').classList.add('hidden');
        document.getElementById('form-recarga').reset();
        
        // Actualizar el DOM instantáneamente con la respuesta del backend
        if (data.nuevo_saldo !== undefined) {
            document.getElementById('cliente-saldo-val').textContent = parseFloat(data.nuevo_saldo).toFixed(2);
        } else {
            loadClienteSaldo();
        }
        
        loadClienteRecargas();
    } catch (err) {
        showToast(err.message, 'error');
    }
});


// =====================================================================
// PANEL DE CHOFER (LÓGICA & EVENTOS)
// =====================================================================
let currentChoferTab = 'todos';

function initChoferDashboard() {
    loadChoferBalance();
    loadChoferVehiculos();
    loadChoferViajes();
}

async function loadChoferBalance() {
    try {
        const bal = await apiRequest('/choferes/balance');
        document.getElementById('chofer-saldo-pendiente').textContent = parseFloat(bal.saldo_pendiente).toFixed(2);
        document.getElementById('chofer-saldo-pagado').textContent = parseFloat(bal.saldo_pagado).toFixed(2);
    } catch (err) {
        console.error(err);
    }
}

async function loadChoferVehiculos() {
    try {
        const vehiculos = await apiRequest('/choferes/vehiculos');
        const container = document.getElementById('chofer-vehiculos-list');
        document.getElementById('chofer-vehiculos-count').textContent = vehiculos.length;
        container.innerHTML = '';

        if (vehiculos.length === 0) {
            container.innerHTML = '<p class="text-secondary text-center py-3">No tienes vehículos registrados.</p>';
            return;
        }

        vehiculos.forEach(v => {
            let statusHTML = '';
            if (v.ultima_revision_fecha === null) {
                statusHTML = '<span class="status-badge badge-warning">Sin Revisión</span>';
            } else if (v.revision_aprobada) {
                statusHTML = '<span class="status-badge badge-success">Apto (Vigente)</span>';
            } else {
                statusHTML = '<span class="status-badge badge-danger">No Apto</span>';
            }

            container.innerHTML += `
                <div class="vehicle-item">
                    <div class="veh-info">
                        <h4>${v.marca} ${v.modelo}</h4>
                        <p>Placa: <span class="plate-badge">${v.placa}</span> | Color: ${v.color} | Año: ${v.anio}</p>
                        ${v.ultima_revision_fecha ? `<small class="text-secondary">Rev. técnica: ${new Date(v.ultima_revision_fecha).toLocaleDateString()}</small>` : ''}
                    </div>
                    <div>
                        ${statusHTML}
                    </div>
                </div>
            `;
        });
    } catch (err) {
        showToast('Error al cargar vehículos.', 'error');
    }
}

async function loadChoferViajes(filters = {}) {
    let endpoint = '/choferes/traslados';
    if (currentChoferTab === 'pagados') endpoint = '/choferes/traslados/pagados';
    if (currentChoferTab === 'pendientes') endpoint = '/choferes/traslados/pendientes';

    // Construir query string de fechas si aplica
    const params = new URLSearchParams();
    if (filters.fecha_inicio) params.append('fecha_inicio', filters.fecha_inicio);
    if (filters.fecha_fin) params.append('fecha_fin', filters.fecha_fin);
    
    const queryString = params.toString();
    const finalEndpoint = queryString ? `${endpoint}?${queryString}` : endpoint;

    try {
        const viajes = await apiRequest(finalEndpoint);
        const tbody = document.getElementById('table-chofer-viajes-body');
        tbody.innerHTML = '';

        if (viajes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron traslados en esta categoría.</td></tr>';
            return;
        }

        viajes.forEach(v => {
            const fecha = new Date(v.fecha).toLocaleDateString('es-VE', { hour: '2-digit', minute: '2-digit' });
            
            // Condicional de visualización para liquidación
            let liquidacionHTML = '';
            if (v.pagado_a_chofer || currentChoferTab === 'pagados') {
                liquidacionHTML = `<span class="status-badge badge-success">Pagado</span> <br> <small class="text-secondary">${v.pago_referencia || 'Transferencia'}</small>`;
            } else {
                liquidacionHTML = '<span class="status-badge badge-warning">Pendiente por Pagar</span>';
            }

            const estadoBadge = v.estado === 'completado' 
                ? '<span class="status-badge badge-success">Completado</span>'
                : '<span class="status-badge badge-danger">Cancelado</span>';

            tbody.innerHTML += `
                <tr>
                    <td>${fecha}</td>
                    <td>
                        <div class="table-route-cell">
                            <span class="route-pt route-a"><i class="fa-solid fa-location-dot"></i> ${v.origen}</span>
                            <span class="route-pt route-b"><i class="fa-solid fa-flag-checkered"></i> ${v.destino}</span>
                        </div>
                    </td>
                    <td>${v.cliente_nombre || 'Pasajero'} ${v.cliente_apellido || ''}</td>
                    <td>$${parseFloat(v.costo_total).toFixed(2)}</td>
                    <td class="font-bold text-green">$${parseFloat(v.monto_chofer).toFixed(2)}</td>
                    <td>${estadoBadge}</td>
                    <td>${liquidacionHTML}</td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error al obtener traslados.', 'error');
    }
}

// Cambiar Tabs Chofer
document.getElementById('tab-chofer-viajes-todos').addEventListener('click', () => {
    currentChoferTab = 'todos';
    setActiveChoferTab('tab-chofer-viajes-todos');
    document.getElementById('chofer-filter-box').classList.remove('hidden');
    loadChoferViajes();
});

document.getElementById('tab-chofer-viajes-pendientes').addEventListener('click', () => {
    currentChoferTab = 'pendientes';
    setActiveChoferTab('tab-chofer-viajes-pendientes');
    document.getElementById('chofer-filter-box').classList.add('hidden');
    loadChoferViajes();
});

document.getElementById('tab-chofer-viajes-pagados').addEventListener('click', () => {
    currentChoferTab = 'pagados';
    setActiveChoferTab('tab-chofer-viajes-pagados');
    document.getElementById('chofer-filter-box').classList.add('hidden');
    loadChoferViajes();
});

function setActiveChoferTab(id) {
    ['tab-chofer-viajes-todos', 'tab-chofer-viajes-pendientes', 'tab-chofer-viajes-pagados'].forEach(tab => {
        document.getElementById(tab).classList.remove('active');
    });
    document.getElementById(id).classList.add('active');
}

// Filtrar viajes por fecha
document.getElementById('btn-chofer-filter').addEventListener('click', () => {
    const fecha_inicio = document.getElementById('chofer-filter-desde').value;
    const fecha_fin = document.getElementById('chofer-filter-hasta').value;
    loadChoferViajes({ fecha_inicio, fecha_fin });
});

// Modales Chofer (Registrar auto)
document.getElementById('btn-open-add-vehiculo').addEventListener('click', () => {
    document.getElementById('modal-vehiculo').classList.remove('hidden');
});

document.getElementById('form-vehiculo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const marca = document.getElementById('veh-marca').value;
    const modelo = document.getElementById('veh-modelo').value;
    const placa = document.getElementById('veh-placa').value;
    const color = document.getElementById('veh-color').value;
    const anio = document.getElementById('veh-anio').value;

    try {
        await apiRequest('/choferes/vehiculos', {
            method: 'POST',
            body: JSON.stringify({ marca, modelo, placa, color, anio })
        });
        showToast('Vehículo registrado correctamente.', 'success');
        document.getElementById('modal-vehiculo').classList.add('hidden');
        document.getElementById('form-vehiculo').reset();
        
        loadChoferVehiculos();
    } catch (err) {
        showToast(err.message, 'error');
    }
});


// =====================================================================
// PANEL DE ADMINISTRACIÓN (LÓGICA & EVENTOS)
// =====================================================================
function initAdminDashboard() {
    loadAdminSelects();
    loadAdminPendientesPago();
    loadPublicBancos();
}

// Cargar conductores y vehículos en los selects de calificación y reportes
async function loadAdminSelects() {
    try {
        // En una app real, tenemos una API de lista global. Aquí podemos traer los choferes y vehículos del API.
        // Simulamos o solicitamos de bases de datos. 
        // Haremos una consulta rápida de choferes y vehículos mediante llamadas.
        // Dado que somos administradores, podemos consultar endpoints. Crearemos selectores limpios.
        
        // Obtener Choferes
        // Nota: para Sistemas de BD I, usaremos consultas directas. Vamos a obtener choferes registrados.
        // Haremos una llamada a un endpoint improvisado o podemos crear un api general en /admin/usuarios
        // Para simplificar, añadimos la lista en el frontend solicitando /auth/me o similar. Pero como requerimos evaluar:
        // Solicitamos a un pequeño endpoint en backend que creamos para listar conductores y vehículos.
        // Como no tenemos /api/admin/choferes explícito para listar todos, agregaremos esa consulta aquí.
        
        // Vamos a hacer una llamada a /api/admin/bancos (que ya tenemos) y crearemos en el backend consultas de soporte si es necesario.
        // En realidad, para evitar errores, hagamos endpoints de soporte en admin.js o traigamos a través de promesas.
        // Creemos endpoints en admin.js para listar choferes y vehículos, lo cual es muy importante para los formularios.
        // ¡Perfecto! Crearemos esos endpoints mediante replace_file_content en `backend/src/routes/admin.js` para que el admin pueda cargarlos en la UI.
    } catch (err) {
        console.error(err);
    }
}

// Cargaremos los choferes y vehículos en el panel administrativo consultando la BD
async function loadChoferesYVehiculos() {
    try {
        // Obtener choferes
        const choferes = await apiRequest('/admin/reportes/listas/choferes');
        
        // Select de Prueba Psicológica
        const selPsico = document.getElementById('eval-chofer-id');
        selPsico.innerHTML = '<option value="">-- Seleccionar --</option>';
        choferes.forEach(c => {
            selPsico.innerHTML += `<option value="${c.id_usuario}">${c.nombre} ${c.apellido} (${c.cedula})</option>`;
        });

        // Select de Reportes por Chofer
        const selRepChofer = document.getElementById('rep-chofer-id');
        selRepChofer.innerHTML = '<option value="">-- Seleccionar --</option>';
        choferes.forEach(c => {
            selRepChofer.innerHTML += `<option value="${c.id_usuario}">${c.nombre} ${c.apellido} (${c.cedula})</option>`;
        });

        // Obtener vehículos
        const vehiculos = await apiRequest('/admin/reportes/listas/vehiculos');
        const selVeh = document.getElementById('eval-veh-id');
        selVeh.innerHTML = '<option value="">-- Seleccionar --</option>';
        vehiculos.forEach(v => {
            selVeh.innerHTML += `<option value="${v.id_vehiculo}">${v.placa} - ${v.marca} ${v.modelo} (${v.chofer_nombre})</option>`;
        });

    } catch (err) {
        console.error('Error al precargar choferes y vehículos:', err.message);
    }
}

// Rellenar tabla de choferes con saldos pendientes por liquidar
async function loadAdminPendientesPago() {
    try {
        const pendientes = await apiRequest('/admin/choferes/pendientes');
        const tbody = document.getElementById('table-admin-pendientes-body');
        tbody.innerHTML = '';

        if (pendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay choferes con saldos pendientes de pago.</td></tr>';
            return;
        }

        pendientes.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${p.nombre} ${p.apellido}</strong></td>
                    <td class="font-bold text-green">$${parseFloat(p.saldo_pendiente).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-primary btn-sm btn-pagar-row" 
                                data-id="${p.id_chofer}" 
                                data-nombre="${p.nombre} ${p.apellido}" 
                                data-monto="${p.saldo_pendiente}">
                            <i class="fa-solid fa-money-bill-transfer"></i> Pagar
                        </button>
                    </td>
                </tr>
            `;
        });

        // Asignar eventos de click a botones de pago
        document.querySelectorAll('.btn-pagar-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = btn.getAttribute('data-id');
                const nombre = btn.getAttribute('data-nombre');
                const monto = btn.getAttribute('data-monto');

                document.getElementById('pago-chofer-id').value = id;
                document.getElementById('pago-chofer-nombre').textContent = nombre;
                document.getElementById('pago-chofer-monto').textContent = parseFloat(monto).toFixed(2);
                
                // Setear fecha actual por defecto
                document.getElementById('pago-fecha').value = new Date().toISOString().substring(0, 10);
                
                document.getElementById('modal-pagar-chofer').classList.remove('hidden');
            });
        });

    } catch (err) {
        showToast('Error al cargar pendientes de pago.', 'error');
    }
}

// Conmutar subformulario Evaluación
document.getElementById('mini-tab-psicologia').addEventListener('click', () => {
    document.getElementById('mini-tab-psicologia').classList.add('active');
    document.getElementById('mini-tab-vehiculo').classList.remove('active');
    document.getElementById('form-eval-psicologia').classList.remove('hidden');
    document.getElementById('form-eval-vehiculo').classList.add('hidden');
});

document.getElementById('mini-tab-vehiculo').addEventListener('click', () => {
    document.getElementById('mini-tab-vehiculo').classList.add('active');
    document.getElementById('mini-tab-psicologia').classList.remove('active');
    document.getElementById('form-eval-vehiculo').classList.remove('hidden');
    document.getElementById('form-eval-psicologia').classList.add('hidden');
});

// Tabs Panel Admin
document.getElementById('tab-admin-pagos').addEventListener('click', () => {
    document.getElementById('tab-admin-pagos').classList.add('active');
    document.getElementById('tab-admin-reportes').classList.remove('active');
    document.getElementById('panel-admin-pagos').classList.remove('hidden');
    document.getElementById('panel-admin-reportes').classList.add('hidden');
});

document.getElementById('tab-admin-reportes').addEventListener('click', () => {
    document.getElementById('tab-admin-reportes').classList.add('active');
    document.getElementById('tab-admin-pagos').classList.remove('active');
    document.getElementById('panel-admin-reportes').classList.remove('hidden');
    document.getElementById('panel-admin-pagos').classList.add('hidden');
    loadChoferesYVehiculos(); // Precargar listas de selects para reportes
});

// Formulario: Guardar Nota Psicológica
document.getElementById('form-eval-psicologia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id_chofer = document.getElementById('eval-chofer-id').value;
    const nota = document.getElementById('eval-chofer-nota').value;
    const fecha_evaluacion = document.getElementById('eval-chofer-fecha').value;

    try {
        const res = await apiRequest('/admin/evaluaciones/choferes', {
            method: 'POST',
            body: JSON.stringify({ id_chofer, nota, fecha_evaluacion })
        });
        showToast(res.message, res.aprobado ? 'success' : 'error');
        document.getElementById('form-eval-psicologia').reset();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Formulario: Guardar Nota Vehicular
document.getElementById('form-eval-vehiculo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id_vehiculo = document.getElementById('eval-veh-id').value;
    const nota = document.getElementById('eval-veh-nota').value;
    const fecha_evaluacion = document.getElementById('eval-veh-fecha').value;

    try {
        const res = await apiRequest('/admin/evaluaciones/vehiculos', {
            method: 'POST',
            body: JSON.stringify({ id_vehiculo, nota, fecha_evaluacion })
        });
        showToast(res.message, res.aprobado ? 'success' : 'error');
        document.getElementById('form-eval-vehiculo').reset();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Formulario: Registrar Banco
document.getElementById('form-add-banco').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('banco-nombre').value;

    try {
        const res = await apiRequest('/admin/bancos', {
            method: 'POST',
            body: JSON.stringify({ nombre })
        });
        showToast(res.message, 'success');
        document.getElementById('form-add-banco').reset();
        loadPublicBancos(); // Refrescar los selects de banco en el sistema
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Formulario: Confirmar y Procesar Pago (Liquidar traslados a un chofer)
document.getElementById('form-pagar-chofer').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id_chofer = document.getElementById('pago-chofer-id').value;
    const fecha_pago = document.getElementById('pago-fecha').value;
    const nro_referencia = document.getElementById('pago-referencia').value;

    try {
        const res = await apiRequest('/admin/pagos', {
            method: 'POST',
            body: JSON.stringify({ id_chofer, fecha_pago, nro_referencia })
        });

        showToast(res.message, 'success');
        document.getElementById('modal-pagar-chofer').classList.add('hidden');
        document.getElementById('form-pagar-chofer').reset();
        
        // Recargar datos administrativos
        loadAdminPendientesPago();
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Reporte 1: Ganancias de la Empresa
document.getElementById('btn-rep-ganancias').addEventListener('click', async () => {
    const fecha_inicio = document.getElementById('rep-ganancias-desde').value;
    const fecha_fin = document.getElementById('rep-ganancias-hasta').value;

    if (!fecha_inicio || !fecha_fin) {
        showToast('Debe ingresar ambas fechas.', 'error');
        return;
    }

    try {
        const res = await apiRequest(`/admin/reportes/ganancias?fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
        
        document.getElementById('val-rep-ganancias').textContent = `$${parseFloat(res.ganancias_totales).toFixed(2)}`;
        document.getElementById('val-rep-ganancias-viajes').textContent = res.total_viajes;
        
        document.getElementById('res-rep-ganancias').classList.remove('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// Reporte 2: Liquidaciones a un Chofer específico
document.getElementById('btn-rep-chofer').addEventListener('click', async () => {
    const id_chofer = document.getElementById('rep-chofer-id').value;
    const fecha_inicio = document.getElementById('rep-chofer-desde').value;
    const fecha_fin = document.getElementById('rep-chofer-hasta').value;

    if (!id_chofer || !fecha_inicio || !fecha_fin) {
        showToast('Faltan parámetros para generar el reporte.', 'error');
        return;
    }

    try {
        const res = await apiRequest(`/admin/reportes/pagos-chofer?id_chofer=${id_chofer}&fecha_inicio=${fecha_inicio}&fecha_fin=${fecha_fin}`);
        
        document.getElementById('val-rep-chofer').textContent = `$${parseFloat(res.total_cancelado).toFixed(2)}`;
        
        const listContainer = document.getElementById('list-rep-chofer-pagos');
        listContainer.innerHTML = '';
        
        if (res.historial_pagos.length === 0) {
            listContainer.innerHTML = '<li class="text-secondary text-center">No hay registros de liquidaciones en este rango de fechas.</li>';
        } else {
            res.historial_pagos.forEach(p => {
                listContainer.innerHTML += `
                    <li>
                        <span>Ref: <code>${p.nro_referencia}</code> - ${new Date(p.fecha_pago).toLocaleDateString()}</span>
                        <strong class="text-green">$${parseFloat(p.monto_pagado).toFixed(2)}</strong>
                    </li>
                `;
            });
        }

        document.getElementById('res-rep-chofer').classList.remove('hidden');
    } catch (err) {
        showToast(err.message, 'error');
    }
});


// =====================================================================
// CONFIGURACIÓN GLOBAL DE MODALES (CERRAR EN CLIC DE BORDES O BOTÓN X)
// =====================================================================
document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.closest('.modal').classList.add('hidden');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});

// Manejo del botón Logout en la cabecera
document.getElementById('btn-logout').addEventListener('click', logout);

// =====================================================================
// INICIALIZACIÓN
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    initSession();
});
