/**
 * rates.js
 * Lógica de negocio para el cálculo de las tarifas de los traslados.
 * Diseñado bajo responsabilidad de Samuel (Área Lógica y Documentación).
 */

const BASE_FARE = 1.50; // Tarifa base de arranque en $
const COST_PER_KM = 0.50; // Costo por cada kilómetro recorrido
const MINIMUM_FARE = 2.00; // Tarifa mínima del traslado

/**
 * Calcula el costo total del traslado basado en la distancia.
 * @param {number} distanceKm - Distancia del recorrido en kilómetros.
 * @returns {number} Costo total del traslado redondeado a 2 decimales.
 */
function calculateTripCost(distanceKm) {
  if (distanceKm < 0) {
    throw new Error("La distancia no puede ser negativa.");
  }
  
  const cost = BASE_FARE + (distanceKm * COST_PER_KM);
  const finalCost = Math.max(cost, MINIMUM_FARE);
  
  // Retornamos como Number para evitar problemas de tipos en el servidor de Abraham
  return Number(finalCost.toFixed(2));
}

module.exports = {
  calculateTripCost,
  BASE_FARE,
  COST_PER_KM,
  MINIMUM_FARE
};
