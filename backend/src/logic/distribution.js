/**
 * distribution.js
 * Lógica para la distribución del pago (30% empresa / 70% chofer).
 * Diseñado bajo responsabilidad de Samuel.
 */

const COMPANY_COMMISSION_PERCENTAGE = 0.30;
const DRIVER_PROFIT_PERCENTAGE = 0.70;

/**
 * Calcula la distribución de los fondos de un traslado tras descontarse del saldo del cliente.
 * @param {number} totalCost - Costo total del viaje cobrado al cliente.
 * @returns {Object} Objeto con la comisión de la empresa y la ganancia del chofer.
 */
function calculateDistribution(totalCost) {
  if (totalCost < 0) {
    throw new Error("El costo total no puede ser negativo.");
  }

  // Calculamos la comisión y forzamos precisión a 2 decimales
  const companyCommission = Number((totalCost * COMPANY_COMMISSION_PERCENTAGE).toFixed(2));
  
  // Restamos para calcular la ganancia del chofer, evitando errores de punto flotante de JS
  const driverProfit = Number((totalCost - companyCommission).toFixed(2));

  return {
    companyCommission,
    driverProfit
  };
}

module.exports = {
  calculateDistribution,
  COMPANY_COMMISSION_PERCENTAGE,
  DRIVER_PROFIT_PERCENTAGE
};
