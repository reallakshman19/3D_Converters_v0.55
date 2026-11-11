import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateLegacyGreEquivalentPressure } from '../converters/engineering-calculations/flange/legacy-gre-equivalent-pressure.js';

const rows = JSON.parse(readFileSync(
  new URL('./fixtures/flange-gre-equivalent-pressure-workbook-rows.json', import.meta.url),
  'utf8',
));

function close(actual, expected, tolerance = 1e-12) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

const categories = Object.freeze([
  ['design', 'DESIGN_LONG_TERM', 0.6944, 'systemDesignPressureBar'],
  ['sustained', 'SUSTAINED_LONG_TERM', 0.56, 'systemDesignPressureBar'],
  ['hydro', 'HYDROTEST_SHORT_TERM', 0.7448, 'systemTestPressureBar'],
]);

for (const row of rows) {
  test(`workbook row ${row.row} reproduces all three equivalent-pressure load categories`, () => {
    for (const [key, loadCategory, partFactor, pressureKey] of categories) {
      const fixture = row[key];
      const result = calculateLegacyGreEquivalentPressure({
        id: `ROW${row.row}-${key.toUpperCase()}`,
        loadCategory,
        systemPressurePa: row[pressureKey] * 1e5,
        qualifiedPressurePa: row.qualifiedPressureBar * 1e5,
        partFactor,
        meanGasketDiameterM: row.meanGasketDiameterMm / 1000,
        axialForceN: fixture.axialForceN,
        bendingMomentNm: fixture.bendingMomentNm,
      });
      close(result.equivalentPressurePa / 1e5, fixture.equivalentPressureBar);
      assert.equal(result.passesRecoveredWorkbookCheck, true);
    }
  });
}
