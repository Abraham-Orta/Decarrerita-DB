const { test } = require('node:test');
const assert = require('node:assert');

const { calculateTripCost } = require('./rates');
const { calculateDistribution } = require('./distribution');
const { validateDriver, validateVehicle } = require('./validations');

test('Tarifas - Calcula costo minimo (por viaje muy corto)', () => {
  const cost = calculateTripCost(0.5); // Base 1.50 + (0.5 * 0.50) = 1.75 => Se cobra el minimo 2.00
  assert.strictEqual(cost, 2.00);
});

test('Tarifas - Calcula costo normal correctamente', () => {
  const cost = calculateTripCost(10); // Base 1.50 + (10 * 0.50) = 6.50
  assert.strictEqual(cost, 6.50);
});

test('Distribucion - Reparte 30/70 evitando perdida de centavos', () => {
  const { companyCommission, driverProfit } = calculateDistribution(10.33);
  // 10.33 * 0.30 = 3.099 => redondea a 3.10
  // 10.33 - 3.10 = 7.23
  assert.strictEqual(companyCommission, 3.10);
  assert.strictEqual(driverProfit, 7.23);
});

test('Validaciones - Rechaza prueba vencida (mas de 1 ano)', () => {
  const oldDate = new Date();
  oldDate.setFullYear(oldDate.getFullYear() - 2); // 2 años atrás
  const result = validateDriver(90, oldDate);
  assert.strictEqual(result.isValid, false);
  assert.match(result.reason, /vencida/);
});

test('Validaciones - Rechaza puntuacion menor a 73 para chofer', () => {
  const result = validateDriver(70, new Date());
  assert.strictEqual(result.isValid, false);
});

test('Validaciones - Aprueba vehiculo con puntuacion limite (65)', () => {
  const result = validateVehicle(65, new Date());
  assert.strictEqual(result.isValid, true);
  assert.strictEqual(result.reason, null);
});
