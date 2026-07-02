const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'decarrerita_secreto_super_seguro_123';

// Middleware para verificar el token de sesión (JWT)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Puede venir como: "Bearer TOKEN"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id_usuario, email, tipo_usuario }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
}

// Middleware para validar roles autorizados
function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado.' });
    }

    if (!allowedRoles.includes(req.user.tipo_usuario)) {
      return res.status(403).json({ 
        error: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
