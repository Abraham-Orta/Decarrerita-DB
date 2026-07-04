/**
 * simulador.js
 * Script para probar la lógica de negocio de Decarrerita empíricamente.
 * Ejecutar con: node src/simulador.js
 */
const { calculateTripCost } = require('./logic/rates');
const { calculateDistribution } = require('./logic/distribution');
const { validateDriver, validateVehicle } = require('./logic/validations');

console.log("=========================================");
console.log("  SIMULADOR DE VIAJES DECARRERITA  ");
console.log("=========================================\n");

const distanceKm = 12.5; // Distancia de ejemplo a recorrer
const driverScore = 88;  // Puntuación ficticia del psicólogo
const testDate = new Date(); // La prueba fue hecha hoy

console.log(`[1] Evaluando idoneidad del chofer asignado (Puntuación: ${driverScore})...`);
const driverCheck = validateDriver(driverScore, testDate);
if (!driverCheck.isValid) {
  console.log(`❌ ERROR: Chofer bloqueado. Razón: ${driverCheck.reason}`);
  process.exit(1);
}
console.log("✅ Chofer validado exitosamente. Cumple los estándares.\n");

console.log(`[2] Calculando algoritmo de tarifa para un recorrido de ${distanceKm} Km...`);
const tripCost = calculateTripCost(distanceKm);
console.log(`💰 Costo total del traslado: $${tripCost}\n`);

console.log("[3] Procesando pagos desde Billetera Virtual (Retención 30%)...");
const { companyCommission, driverProfit } = calculateDistribution(tripCost);
console.log(`🏢 Comisión Decarrerita (30%): $${companyCommission}`);
console.log(`🚘 Saldo a favor del Chofer (70%): $${driverProfit}\n`);

console.log("=========================================");
console.log("  ✅ SIMULACIÓN EXITOSA ");
console.log("=========================================");
