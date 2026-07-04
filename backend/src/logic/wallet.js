/**
 * wallet.js
 * Lógica de negocio para la gestión de la Billetera Virtual desde el Backend.
 * Diseñado bajo responsabilidad de Samuel.
 */

/**
 * Valida si un cliente tiene saldo suficiente para solicitar un traslado.
 * Aunque la BD tiene un Trigger de seguridad (trg_before_insert_traslado),
 * esta función permite al backend rechazar la petición antes de golpear la base de datos,
 * ahorrando recursos y dando una respuesta rápida al cliente.
 * 
 * @param {number} currentBalance - Saldo actual del cliente.
 * @param {number} tripCost - Costo total del traslado calculado.
 * @returns {Object} { canProceed: boolean, reason: string | null }
 */
function checkSufficientBalance(currentBalance, tripCost) {
  if (currentBalance < 0) {
    return { canProceed: false, reason: "El saldo de la billetera no puede ser negativo." };
  }
  
  if (currentBalance < tripCost) {
    return { 
      canProceed: false, 
      reason: `Saldo insuficiente. Tu saldo es $${currentBalance} y el viaje cuesta $${tripCost}.` 
    };
  }
  
  return { canProceed: true, reason: null };
}

module.exports = {
  checkSufficientBalance
};
