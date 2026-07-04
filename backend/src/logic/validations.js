/**
 * validations.js
 * Lógica de negocio para las validaciones estrictas de seguridad (choferes y vehículos).
 * Diseñado bajo responsabilidad de Samuel.
 */

const MIN_PSYCHOLOGICAL_SCORE = 73;
const MIN_VEHICLE_SCORE = 65;
const MAX_SCORE = 100;
const VALIDITY_PERIOD_DAYS = 365;

/**
 * Verifica si han pasado más de 'VALIDITY_PERIOD_DAYS' días desde la fecha dada.
 * @param {Date|string} testDate - Fecha en la que se realizó la prueba/revisión.
 * @returns {boolean} true si la prueba está vencida, false si es válida.
 */
function isTestExpired(testDate) {
  const currentDate = new Date();
  const dateOfTest = new Date(testDate);
  
  // Diferencia en tiempo (milisegundos) y luego en días
  const diffTime = Math.abs(currentDate - dateOfTest);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return diffDays > VALIDITY_PERIOD_DAYS;
}

/**
 * Valida si un chofer cumple con los requisitos psicológicos para prestar servicio.
 * @param {number} score - Puntuación obtenida (0 - 100).
 * @param {Date|string} testDate - Fecha de realización de la prueba.
 * @returns {Object} { isValid: boolean, reason: string | null }
 */
function validateDriver(score, testDate) {
  if (score < 0 || score > MAX_SCORE) {
    return { isValid: false, reason: "La puntuación psicológica está fuera de rango (0-100)." };
  }
  if (isTestExpired(testDate)) {
    return { isValid: false, reason: "Prueba psicológica vencida. Debe renovarse anualmente." };
  }
  if (score < MIN_PSYCHOLOGICAL_SCORE) {
    return { isValid: false, reason: `Puntuación insuficiente. El mínimo aprobatorio es ${MIN_PSYCHOLOGICAL_SCORE}.` };
  }
  
  return { isValid: true, reason: null };
}

/**
 * Valida si un vehículo cumple con los requisitos mecánicos y técnicos.
 * @param {number} score - Puntuación obtenida (0 - 100).
 * @param {Date|string} testDate - Fecha de realización de la revisión.
 * @returns {Object} { isValid: boolean, reason: string | null }
 */
function validateVehicle(score, testDate) {
  if (score < 0 || score > MAX_SCORE) {
    return { isValid: false, reason: "La puntuación técnica está fuera de rango (0-100)." };
  }
  if (isTestExpired(testDate)) {
    return { isValid: false, reason: "Revisión técnica vencida. Debe renovarse anualmente." };
  }
  if (score < MIN_VEHICLE_SCORE) {
    return { isValid: false, reason: `Puntuación insuficiente. El vehículo requiere mínimo ${MIN_VEHICLE_SCORE} puntos.` };
  }
  
  return { isValid: true, reason: null };
}

module.exports = {
  validateDriver,
  validateVehicle,
  isTestExpired,
  MIN_PSYCHOLOGICAL_SCORE,
  MIN_VEHICLE_SCORE,
  MAX_SCORE,
  VALIDITY_PERIOD_DAYS
};
