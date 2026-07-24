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
    if (target) {
        target.classList.remove('hidden');
        if (viewName === 'cliente') {
            setTimeout(() => {
                if (typeof initRideMap === 'function') initRideMap();
            }, 150); // Dar tiempo a que el DOM se muestre antes de inicializar el mapa
        }
    }
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
        if (error.message.includes('Usuario inactivo')) {
            showToast('Tu cuenta no está verificada. Por favor ingresa el código enviado a tu correo.', 'info');
            document.getElementById('otp-email').value = email;
            document.getElementById('modal-otp-verify').classList.remove('hidden');
            document.getElementById('otp-code').focus();
        } else {
            showToast(error.message, 'error');
        }
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
        
        // Show OTP modal and populate email
        document.getElementById('otp-email').value = email;
        document.getElementById('modal-otp-verify').classList.remove('hidden');
        document.getElementById('otp-code').focus();
        showToast('Código enviado a tu correo. Por favor verifícalo.', 'info');
        
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// =====================================================================
// OTP VERIFICATION LOGIC
// =====================================================================

document.getElementById('form-otp-verify').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('otp-email').value;
    const code = document.getElementById('otp-code').value;
    
    try {
        await apiRequest('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email, code })
        });
        
        document.getElementById('modal-otp-verify').classList.add('hidden');
        showToast('Cuenta verificada exitosamente. Ya puedes iniciar sesión.', 'success');
        
        document.getElementById('tab-login').click();
        document.getElementById('form-login').reset();
        document.getElementById('form-register').reset();
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

document.getElementById('btn-resend-otp').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('otp-email').value;
    
    try {
        await apiRequest('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        showToast('Nuevo código enviado. Revisa tu correo.', 'info');
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// =====================================================================
// FORGOT PASSWORD LOGIC
// =====================================================================

document.getElementById('btn-forgot-password').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('forgot-step-1').classList.remove('hidden');
    document.getElementById('forgot-step-2').classList.add('hidden');
    document.getElementById('form-forgot-email').reset();
    document.getElementById('form-reset-password').reset();
    document.getElementById('modal-forgot-password').classList.remove('hidden');
});

document.getElementById('form-forgot-email').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    
    try {
        await apiRequest('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        document.getElementById('forgot-step-1').classList.add('hidden');
        document.getElementById('forgot-step-2').classList.remove('hidden');
        showToast('Código de recuperación enviado.', 'info');
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

document.getElementById('form-reset-password').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const code = document.getElementById('reset-code').value;
    const newPassword = document.getElementById('reset-new-password').value;
    
    try {
        await apiRequest('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, code, newPassword })
        });
        
        document.getElementById('modal-forgot-password').classList.add('hidden');
        showToast('Contraseña actualizada correctamente. Inicia sesión.', 'success');
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

// =====================================================================
// PANEL DE CLIENTE (LÓGICA & EVENTOS)
// =====================================================================
let rideMap, routingControl, routeGlowLayer, routeLine;
let isSettingOrigin = true;
let markerA, markerB;

const zonasGuayana = [
    {name: 'Alta Vista', lat: 8.304, lng: -62.714, r: 0.008},
    {name: 'Los Olivos', lat: 8.291, lng: -62.710, r: 0.006},
    {name: 'Villa Africana', lat: 8.280, lng: -62.718, r: 0.007},
    {name: 'Villa Granada', lat: 8.312, lng: -62.720, r: 0.006},
    {name: 'Villa Asia', lat: 8.286, lng: -62.702, r: 0.007},
    {name: 'Unare I', lat: 8.290, lng: -62.730, r: 0.006},
    {name: 'Unare II', lat: 8.283, lng: -62.738, r: 0.007},
    {name: 'Castillito', lat: 8.296, lng: -62.745, r: 0.008},
    {name: 'Centro Comercial Orinokia', lat: 8.300, lng: -62.700, r: 0.004},
    {name: 'Parque Cachamay', lat: 8.306, lng: -62.706, r: 0.005},
    {name: 'Parque La Navidad', lat: 8.302, lng: -62.708, r: 0.004},
    {name: 'Central Santo Tome', lat: 8.297, lng: -62.694, r: 0.005},
    {name: 'Puerto Ordaz Centro', lat: 8.295, lng: -62.715, r: 0.010},
    {name: 'Villa Brasil', lat: 8.273, lng: -62.715, r: 0.006},
    {name: 'Villa Colombia', lat: 8.277, lng: -62.726, r: 0.006},
    {name: 'Chilemex', lat: 8.268, lng: -62.735, r: 0.007},
    {name: 'Manoa', lat: 8.310, lng: -62.730, r: 0.007},
    {name: 'Ferrominera', lat: 8.320, lng: -62.710, r: 0.008},
    {name: 'Villa Antillana', lat: 8.270, lng: -62.705, r: 0.006},
    {name: 'San Felix', lat: 8.355, lng: -62.650, r: 0.015},
    {name: 'Vista al Sol', lat: 8.340, lng: -62.665, r: 0.007},
    {name: 'Dalla Costa', lat: 8.325, lng: -62.680, r: 0.008},
    {name: 'Core 8', lat: 8.275, lng: -62.760, r: 0.008},
    {name: 'Cambalache', lat: 8.320, lng: -62.740, r: 0.008},
    {name: 'Villa Alianza', lat: 8.260, lng: -62.720, r: 0.006}
];

function localGeocode(lat, lng) {
    let closest = null;
    let minDist = Infinity;
    for (const zona of zonasGuayana) {
        const d = Math.sqrt(Math.pow(lat - zona.lat, 2) + Math.pow(lng - zona.lng, 2));
        if (d < zona.r && d < minDist) {
            minDist = d;
            closest = zona.name;
        }
    }
    return closest ? `${closest}, Ciudad Guayana` : `Puerto Ordaz (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function initRideMap() {
    if (rideMap) {
        rideMap.invalidateSize();
        return;
    }
    
    rideMap = L.map('ride-map', {zoomControl: false}).setView([8.295, -62.715], 14);
    
    L.control.zoom({position: 'bottomright'}).addTo(rideMap);

    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxZoom: 20
    }).addTo(rideMap);

    const iconOrigen = L.divIcon({
        className: 'custom-map-marker',
        html: '<div style="position:relative;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;background:#10b981;border-radius:50%;box-shadow:0 0 12px 4px rgba(16,185,129,0.5);border:3px solid #fff;"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    const iconDestino = L.divIcon({
        className: 'custom-map-marker',
        html: '<div style="position:relative;"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;background:#f43f5e;border-radius:50%;box-shadow:0 0 12px 4px rgba(244,63,94,0.5);border:3px solid #fff;"></div></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const posA = L.latLng(8.298, -62.715);
    const posB = L.latLng(8.280, -62.725);

    markerA = L.marker(posA, {draggable: true, icon: iconOrigen}).addTo(rideMap);
    markerB = L.marker(posB, {draggable: true, icon: iconDestino}).addTo(rideMap);

    const reverseGeocode = async (lat, lng, inputId) => {
        try {
            document.getElementById(inputId).value = 'Ubicando...';
            const localName = localGeocode(lat, lng);
            const isKnownZone = !localName.includes('('); // Si no tiene paréntesis, es una zona conocida

            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=es`);
            if (!res.ok) throw new Error('err');
            const data = await res.json();
            
            let address = '';
            if (data.address) {
                const a = data.address;
                let street = (a.road && a.road.length < 50) ? a.road : '';
                
                if (isKnownZone) {
                    // Usar siempre nuestra base de datos local para la zona (evita "Colombia" en vez de "Villa Colombia")
                    address = street ? `${street}, ${localName}` : localName;
                } else {
                    // Fallback a Nominatim si estamos en una zona no mapeada
                    const parts = [];
                    if (street) parts.push(street);
                    if (a.neighbourhood) parts.push(a.neighbourhood);
                    else if (a.suburb) parts.push(a.suburb);
                    if (!parts.length && a.residential) parts.push(a.residential);
                    if (a.city || a.town || a.village) parts.push(a.city || a.town || a.village);
                    address = parts.slice(0, 2).join(', ');
                }
            }
            document.getElementById(inputId).value = address || localName;
        } catch (e) {
            document.getElementById(inputId).value = localGeocode(lat, lng);
        }
    };

    const buildCurve = (a, b) => {
        const midLat = (a.lat + b.lat) / 2;
        const midLng = (a.lng + b.lng) / 2;
        const dx = b.lng - a.lng;
        const dy = b.lat - a.lat;
        const offset = Math.sqrt(dx*dx + dy*dy) * 0.15;
        const cpLat = midLat + dx * offset * 8;
        const cpLng = midLng - dy * offset * 8;
        const points = [];
        for (let t = 0; t <= 1; t += 0.03) {
            const lat = (1-t)*(1-t)*a.lat + 2*(1-t)*t*cpLat + t*t*b.lat;
            const lng = (1-t)*(1-t)*a.lng + 2*(1-t)*t*cpLng + t*t*b.lng;
            points.push([lat, lng]);
        }
        return points;
    };

    const updateStraightLine = () => {
        const a = markerA.getLatLng();
        const b = markerB.getLatLng();
        if (routeLine) rideMap.removeLayer(routeLine);
        if (routeGlowLayer) rideMap.removeLayer(routeGlowLayer);

        const curvePoints = buildCurve(a, b);
        routeGlowLayer = L.polyline(curvePoints, {
            color: 'rgba(99,102,241,0.2)', weight: 14, lineCap: 'round'
        }).addTo(rideMap);
        routeLine = L.polyline(curvePoints, {
            color: '#6366f1', weight: 4, opacity: 1, lineCap: 'round'
        }).addTo(rideMap);

        const distKm = haversineDistance(a.lat, a.lng, b.lat, b.lng);
        const roadDist = distKm * 1.35;
        const finalDist = roadDist < 0.1 ? 0.1 : roadDist;

        const inputDist = document.getElementById('ride-distancia');
        inputDist.value = finalDist.toFixed(1);
        inputDist.dispatchEvent(new Event('input'));

        reverseGeocode(a.lat, a.lng, 'ride-origen');
        reverseGeocode(b.lat, b.lng, 'ride-destino');
    };

    const useOnlineRouting = navigator.onLine;

    if (useOnlineRouting) {
        routingControl = L.Routing.control({
            waypoints: [posA, posB],
            router: new L.Routing.OSRMv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'driving'
            }),
            routeWhileDragging: true,
            show: false,
            addWaypoints: false,
            fitSelectedRoutes: false,
            lineOptions: {
                styles: [
                    {color: 'rgba(99,102,241,0.25)', weight: 12},
                    {color: '#6366f1', opacity: 1, weight: 4}
                ]
            },
            createMarker: function() { return null; }
        }).addTo(rideMap);

        routingControl.on('routesfound', function(e) {
            const summary = e.routes[0].summary;
            const distKm = summary.totalDistance / 1000;
            const finalDist = distKm < 0.1 ? 0.1 : distKm;
            const inputDist = document.getElementById('ride-distancia');
            inputDist.value = finalDist.toFixed(1);
            inputDist.dispatchEvent(new Event('input'));
            const wps = routingControl.getWaypoints();
            if (wps[0].latLng) reverseGeocode(wps[0].latLng.lat, wps[0].latLng.lng, 'ride-origen');
            if (wps[1].latLng) reverseGeocode(wps[1].latLng.lat, wps[1].latLng.lng, 'ride-destino');
        });

        routingControl.on('routingerror', function() {
            updateStraightLine();
        });

        const syncRoutingFromMarkers = () => {
            routingControl.setWaypoints([markerA.getLatLng(), markerB.getLatLng()]);
        };

        markerA.on('dragend', syncRoutingFromMarkers);
        markerB.on('dragend', syncRoutingFromMarkers);
    } else {
        updateStraightLine();
        markerA.on('dragend', updateStraightLine);
        markerB.on('dragend', updateStraightLine);
    }

    const inputOrigen = document.getElementById('ride-origen');
    const inputDestino = document.getElementById('ride-destino');

    const activateOrigen = () => {
        isSettingOrigin = true;
        inputOrigen.style.border = '2px solid #10b981';
        inputOrigen.style.boxShadow = '0 0 8px rgba(16,185,129,0.3)';
        inputDestino.style.border = '1px solid rgba(255,255,255,0.1)';
        inputDestino.style.boxShadow = 'none';
    };
    const activateDestino = () => {
        isSettingOrigin = false;
        inputDestino.style.border = '2px solid #f43f5e';
        inputDestino.style.boxShadow = '0 0 8px rgba(244,63,94,0.3)';
        inputOrigen.style.border = '1px solid rgba(255,255,255,0.1)';
        inputOrigen.style.boxShadow = 'none';
    };

    inputOrigen.style.cursor = 'pointer';
    inputDestino.style.cursor = 'pointer';
    activateOrigen();
    inputOrigen.addEventListener('click', activateOrigen);
    inputDestino.addEventListener('click', activateDestino);

    rideMap.on('click', function(e) {
        if (isSettingOrigin) {
            markerA.setLatLng(e.latlng);
            activateDestino();
        } else {
            markerB.setLatLng(e.latlng);
        }
        if (useOnlineRouting && routingControl) {
            routingControl.setWaypoints([markerA.getLatLng(), markerB.getLatLng()]);
        } else {
            updateStraightLine();
        }
    });

    if (useOnlineRouting) {
        reverseGeocode(posA.lat, posA.lng, 'ride-origen');
        reverseGeocode(posB.lat, posB.lng, 'ride-destino');
    } else {
        updateStraightLine();
    }

    if (navigator.onLine) {
        prefetchTilesForCiudadGuayana();
    }
}

function prefetchTilesForCiudadGuayana() {
    const bounds = {latMin: 8.24, latMax: 8.36, lngMin: -62.78, lngMax: -62.62};
    const zooms = [13, 14, 15];

    zooms.forEach(z => {
        const xMin = Math.floor((bounds.lngMin + 180) / 360 * Math.pow(2, z));
        const xMax = Math.floor((bounds.lngMax + 180) / 360 * Math.pow(2, z));
        const yMin = Math.floor((1 - Math.log(Math.tan(bounds.latMax * Math.PI / 180) + 1 / Math.cos(bounds.latMax * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
        const yMax = Math.floor((1 - Math.log(Math.tan(bounds.latMin * Math.PI / 180) + 1 / Math.cos(bounds.latMin * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));

        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                const img = new Image();
                img.src = `https://mt1.google.com/vt/lyrs=m&x=${x}&y=${y}&z=${z}`;
            }
        }
    });
}


function initClienteDashboard() {
    loadClienteSaldo();
    loadClienteRecargas();
    loadClienteViajes();
    loadPublicBancos(); // Asegura bancos en el modal de recargas
    if (document.getElementById('view-cliente').classList.contains('hidden') === false) {
        initRideMap();
    }
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
                
            const rowData = encodeURIComponent(JSON.stringify({
                fecha,
                chofer_nombre: `${v.chofer_nombre} ${v.chofer_apellido}`,
                vehiculo_modelo: `${v.vehiculo_marca} ${v.vehiculo_modelo}`,
                vehiculo_placa: v.vehiculo_placa,
                costo_total: parseFloat(v.costo_total).toFixed(2)
            }));

            tbody.innerHTML += `
                <tr style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'" onclick="showReceiptFromHistory('${rowData}')">
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

// Función global para mostrar el recibo desde el historial
window.showReceiptFromHistory = function(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    document.getElementById('receipt-date').textContent = data.fecha;
    document.getElementById('receipt-driver-name').textContent = data.chofer_nombre;
    document.getElementById('receipt-veh-model').textContent = data.vehiculo_modelo;
    document.getElementById('receipt-veh-plate').textContent = data.vehiculo_placa;
    document.getElementById('receipt-total').textContent = data.costo_total;
    
    document.getElementById('modal-receipt').classList.remove('hidden');
};

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

    const loadingOverlay = document.getElementById('payment-loading-overlay');
    try {
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        const res = await apiRequest('/clientes/traslados', {
            method: 'POST',
            body: JSON.stringify({ origen, destino, distancia_km })
        });

        // 1. Mostrar carrito saltando por 2 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));
        if (loadingOverlay) loadingOverlay.classList.add('hidden');

        // Llenar datos ocultos del modal-receipt para usarlo al final (Factura digital)
        document.getElementById('receipt-date').textContent = new Date().toLocaleDateString('es-VE');
        document.getElementById('receipt-driver-name').textContent = `${res.chofer.nombre} ${res.chofer.apellido}`;
        document.getElementById('receipt-veh-model').textContent = `${res.vehiculo.marca} ${res.vehiculo.modelo}`;
        document.getElementById('receipt-veh-plate').textContent = res.vehiculo.placa;
        document.getElementById('receipt-total').textContent = parseFloat(res.costo_total).toFixed(2);

        // 2. Ocultar el formulario y mostrar el panel de viaje activo
        document.getElementById('request-ride-card').classList.add('hidden');
        const activeTripCard = document.getElementById('active-trip-card');
        activeTripCard.classList.remove('hidden');
        
        // Resetear tracker a "Buscando"
        const steps = ['buscando', 'asignado', 'camino', 'llegada'];
        steps.forEach(s => {
            document.getElementById(`icon-${s}`).style.background = 'rgba(255,255,255,0.1)';
            document.getElementById(`text-${s}`).style.color = 'var(--text-secondary)';
        });
        document.getElementById('icon-buscando').style.background = 'var(--primary)';
        document.getElementById('text-buscando').style.color = 'var(--primary)';
        
        document.getElementById('active-trip-info-box').classList.add('hidden');
        document.getElementById('btn-finish-trip').classList.add('hidden');
        document.getElementById('rating-container').classList.add('hidden');
        
        // Reset stars
        document.querySelectorAll('.star-btn').forEach(s => s.style.color = '#555');
        
        const msgBox = document.getElementById('active-trip-message');
        msgBox.textContent = 'Buscando el mejor conductor para ti...';

        // Secuencia de animación de estados
        setTimeout(() => {
            // Paso 2: Asignado
            document.getElementById('icon-asignado').style.background = 'var(--primary)';
            document.getElementById('text-asignado').style.color = 'var(--primary)';
            
            // Mostrar info del chofer
            document.getElementById('active-driver-name').textContent = `${res.chofer.nombre} ${res.chofer.apellido}`;
            document.getElementById('active-driver-phone').textContent = res.chofer.telefono;
            document.getElementById('active-veh-model').textContent = `${res.vehiculo.marca} ${res.vehiculo.modelo}`;
            document.getElementById('active-veh-plate').textContent = res.vehiculo.placa;
            document.getElementById('active-veh-color').textContent = res.vehiculo.color;
            document.getElementById('active-trip-info-box').classList.remove('hidden');
            msgBox.textContent = '¡Conductor encontrado!';
            
            setTimeout(() => {
                // Paso 3: En camino / Viaje
                document.getElementById('icon-camino').style.background = 'var(--primary)';
                document.getElementById('text-camino').style.color = 'var(--primary)';
                msgBox.textContent = 'El conductor va en camino hacia tu destino...';
                
                setTimeout(() => {
                    // Paso 4: Llegada
                    document.getElementById('icon-llegada').style.background = 'var(--accent-green)';
                    document.getElementById('text-llegada').style.color = 'var(--accent-green)';
                    document.getElementById('icon-llegada').style.borderColor = 'var(--accent-green)';
                    msgBox.textContent = `¡Has llegado! Total debitado: $${parseFloat(res.costo_total).toFixed(2)}`;
                    
                    document.getElementById('rating-container').classList.remove('hidden');
                    document.getElementById('btn-finish-trip').classList.remove('hidden');
                    
                    // Recargar tablas en el fondo
                    loadClienteSaldo();
                    loadClienteViajes();
                }, 4000);
            }, 3000);
        }, 2000);
        
    } catch (err) {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        showToast(err.message, 'error');
    }
});

// Interactividad de las estrellas
let selectedRating = 0;
document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('mouseover', (e) => {
        const val = parseInt(e.target.dataset.value);
        document.querySelectorAll('.star-btn').forEach(s => {
            s.style.color = parseInt(s.dataset.value) <= val ? '#fbbf24' : '#555';
        });
    });
    star.addEventListener('mouseout', () => {
        document.querySelectorAll('.star-btn').forEach(s => {
            s.style.color = parseInt(s.dataset.value) <= selectedRating ? '#fbbf24' : '#555';
        });
    });
    star.addEventListener('click', (e) => {
        selectedRating = parseInt(e.target.dataset.value);
        document.querySelectorAll('.star-btn').forEach(s => {
            s.style.color = parseInt(s.dataset.value) <= selectedRating ? '#fbbf24' : '#555';
        });
    });
});

// Botón para finalizar el viaje y mostrar recibo
document.getElementById('btn-finish-trip').addEventListener('click', () => {
    if (selectedRating === 0) {
        showToast('Por favor califica a tu conductor primero.', 'warning');
        return;
    }
    // Mostrar modal de Factura (Recibo tipo ticket)
    document.getElementById('modal-receipt').classList.remove('hidden');
    selectedRating = 0; // Reset para el próximo
});

// Cerrar modal de recibo exitoso y volver al mapa
document.querySelector('.btn-close-receipt').addEventListener('click', () => {
    document.getElementById('modal-receipt').classList.add('hidden');
    
    // Si la tarjeta de viaje activo está visible, significa que acabamos de terminar un viaje nuevo
    if (!document.getElementById('active-trip-card').classList.contains('hidden')) {
        // Restaurar UI
        document.getElementById('active-trip-card').classList.add('hidden');
        document.getElementById('request-ride-card').classList.remove('hidden');
        document.getElementById('form-request-ride').reset();
        document.getElementById('ride-fare-est').textContent = '2.50';
        showToast('¡Factura guardada! Gracias por viajar con DeCarrerita.', 'success');
    }
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
        
        // Recargar datos
        loadClienteSaldo();
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
    loadAdminUsuarios();
    loadAdminVehiculos();
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
    document.getElementById('tab-admin-gestion').classList.remove('active');
    document.getElementById('panel-admin-pagos').classList.remove('hidden');
    document.getElementById('panel-admin-reportes').classList.add('hidden');
    document.getElementById('panel-admin-gestion').classList.add('hidden');
});

document.getElementById('tab-admin-reportes').addEventListener('click', () => {
    document.getElementById('tab-admin-reportes').classList.add('active');
    document.getElementById('tab-admin-pagos').classList.remove('active');
    document.getElementById('tab-admin-gestion').classList.remove('active');
    document.getElementById('panel-admin-reportes').classList.remove('hidden');
    document.getElementById('panel-admin-pagos').classList.add('hidden');
    document.getElementById('panel-admin-gestion').classList.add('hidden');
    loadChoferesYVehiculos(); // Precargar listas de selects para reportes
});

document.getElementById('tab-admin-gestion').addEventListener('click', () => {
    document.getElementById('tab-admin-gestion').classList.add('active');
    document.getElementById('tab-admin-pagos').classList.remove('active');
    document.getElementById('tab-admin-reportes').classList.remove('active');
    document.getElementById('panel-admin-gestion').classList.remove('hidden');
    document.getElementById('panel-admin-pagos').classList.add('hidden');
    document.getElementById('panel-admin-reportes').classList.add('hidden');
    loadAdminUsuarios();
    loadAdminVehiculos();
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

    const loadingOverlay = document.getElementById('liquidation-loading-overlay');
    try {
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
        const res = await apiRequest('/admin/pagos', {
            method: 'POST',
            body: JSON.stringify({ id_chofer, fecha_pago, nro_referencia })
        });

        // Retraso para ver la animacion
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        showToast(res.message, 'success');
        document.getElementById('modal-pagar-chofer').classList.add('hidden');
        document.getElementById('form-pagar-chofer').reset();
        
        // Recargar datos administrativos
        loadAdminPendientesPago();
    } catch (err) {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
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
// PANEL DE GESTIÓN DE PERSONAL Y VEHÍCULOS (ADMIN)
// =====================================================================

async function loadAdminUsuarios() {
    try {
        const usuarios = await apiRequest('/admin/reportes/listas/choferes');
        const tbody = document.getElementById('table-admin-usuarios-body');
        tbody.innerHTML = '';
        
        if (usuarios.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No hay usuarios activos.</td></tr>';
            return;
        }

        usuarios.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.nombre} ${u.apellido}</strong></td>
                    <td>${u.cedula}</td>
                    <td>Chofer</td>
                    <td><span class="status-badge badge-success">Activo</span></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="window.confirmToggle(${u.id_usuario}, true, '${u.nombre} ${u.apellido}', 'usuario')">
                            Desactivar
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error al cargar usuarios.', 'error');
    }
}

window.confirmToggle = function(id, currentState, name, type) {
    document.getElementById('confirm-toggle-id').value = id;
    document.getElementById('confirm-toggle-state').value = currentState;
    document.getElementById('confirm-toggle-message').textContent = currentState 
        ? '¿Estás seguro que deseas DESACTIVAR a este ' + type + '?' 
        : '¿Estás seguro que deseas REACTIVAR a este ' + type + '?';
    document.getElementById('confirm-toggle-name').textContent = name;
    
    // Store type in a dataset for the confirm button
    document.getElementById('btn-confirm-toggle').dataset.type = type;
    
    document.getElementById('modal-confirm-toggle').classList.remove('hidden');
};

document.getElementById('btn-confirm-toggle').addEventListener('click', async () => {
    const id = document.getElementById('confirm-toggle-id').value;
    const currentState = document.getElementById('confirm-toggle-state').value === 'true';
    const type = document.getElementById('btn-confirm-toggle').dataset.type;
    
    try {
        const endpoint = type === 'usuario' 
            ? `/admin/usuarios/${id}/estado` 
            : `/admin/vehiculos/${id}/estado`;
            
        const res = await apiRequest(endpoint, {
            method: 'PUT',
            body: JSON.stringify({ activo: !currentState })
        });
        
        showToast(res.message || 'Estado actualizado', 'success');
        document.getElementById('modal-confirm-toggle').classList.add('hidden');
        
        if (type === 'usuario') loadAdminUsuarios();
        else loadAdminVehiculos();
        
    } catch (err) {
        showToast(err.message, 'error');
    }
});

async function loadAdminVehiculos() {
    try {
        const vehiculos = await apiRequest('/admin/reportes/listas/vehiculos');
        const tbody = document.getElementById('table-admin-vehiculos-body');
        tbody.innerHTML = '';
        
        if (vehiculos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No hay vehículos activos.</td></tr>';
            return;
        }

        vehiculos.forEach(v => {
            tbody.innerHTML += `
                <tr>
                    <td><span class="plate-badge">${v.placa}</span></td>
                    <td>${v.marca} ${v.modelo}</td>
                    <td>${v.chofer_nombre}</td>
                    <td><span class="status-badge badge-success">Activo</span></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="window.confirmToggle(${v.id_vehiculo}, true, '${v.placa} (${v.marca})', 'vehiculo')">
                            Desactivar
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (err) {
        showToast('Error al cargar vehículos.', 'error');
    }
}

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
