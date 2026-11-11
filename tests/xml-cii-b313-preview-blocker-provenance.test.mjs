import assert from 'node:assert/strict';
import {
  calculateAndSelectPreviewB313Wall,
  explainPreviewB313FactorAvailability,
  resolvePreviewB313FactorBasis,
  resolvePreviewB313MaterialIdentity,
} from '../converters/xml-cii2019-core/b313-preview-wall-update.js';

const a106Identity = resolvePreviewB313MaterialIdentity({
  material: 'ASTM A106-B',
  materialSource: 'process-linelist-material',
});
assert.equal(a106Identity.ok, true, JSON.stringify(a106Identity));
assert.equal(a106Identity.material.materialId, 'CS-A106-B');
assert.equal(a106Identity.materialSource, 'process-linelist-material');

const a106Availability = explainPreviewB313FactorAvailability({
  materialId: 'CS-A106-B',
  designTemperatureC: 0,
  manufacturingRoute: 'SEAMLESS',
});
for (const factor of ['S', 'E', 'W', 'Y']) {
  assert.equal(a106Availability.factors[factor].strictAvailable, false, factor);
  assert.equal(a106Availability.factors[factor].status, 'QUALIFICATION_STATUS_REJECTED', factor);
  assert(a106Availability.factors[factor].candidateStatuses.includes('BENCHMARK_ONLY'), factor);
}
assert.deepEqual(a106Availability.strictAcceptedStatuses.sort(), ['PROJECT_APPROVED', 'VERIFIED']);

const a106Strict = resolvePreviewB313FactorBasis({
  materialIdentity: a106Identity,
  designTemperatureC: 0,
  manufacturingRoute: 'SEAMLESS',
});
assert.equal(a106Strict.ok, false);
assert.equal(a106Strict.code, 'B313_PREVIEW_FACTOR_BASIS_UNAVAILABLE');
assert.equal(a106Strict.details.strictResult.code, 'B313_FACTOR_DATA_INCOMPLETE');
assert.deepEqual(a106Strict.details.strictResult.details.missing, ['S', 'E', 'W', 'Y']);
assert.equal(a106Strict.details.factorAvailability.factors.S.status, 'QUALIFICATION_STATUS_REJECTED');

const ssGeneric = resolvePreviewB313MaterialIdentity({
  material: 'SS',
  materialSource: 'process-linelist-material',
});
assert.equal(ssGeneric.ok, false);
assert.equal(ssGeneric.code, 'B313_PREVIEW_MATERIAL_AMBIGUOUS');

const tp304Identity = resolvePreviewB313MaterialIdentity({ material: 'ASTM A312-TP304' });
assert.equal(tp304Identity.ok, true);
const tp304NoRoute = explainPreviewB313FactorAvailability({
  materialId: tp304Identity.material.materialId,
  designTemperatureC: 20,
});
assert.equal(tp304NoRoute.factors.E.status, 'MANUFACTURING_ROUTE_REQUIRED');
assert(tp304NoRoute.factors.E.availableManufacturingRoutes.includes('SEAMLESS'));
assert.equal(tp304NoRoute.factors.E.strictAvailable, false);

const incompleteManual = resolvePreviewB313FactorBasis({
  materialIdentity: a106Identity,
  designTemperatureC: 0,
  manufacturingRoute: 'SEAMLESS',
  manualBasis: { allowableStress: 137.89514586336722, stressUnit: 'MPa', qualityFactorE: 1, weldStrengthReductionW: 1, coefficientY: 0.4 },
});
assert.equal(incompleteManual.ok, false);
assert(incompleteManual.details.manualMissing.includes('controlled source reference'));

const controlledManual = resolvePreviewB313FactorBasis({
  materialIdentity: a106Identity,
  designTemperatureC: 0,
  manufacturingRoute: 'SEAMLESS',
  manualBasis: {
    allowableStress: 20,
    stressUnit: 'ksi',
    qualityFactorE: 1,
    weldStrengthReductionW: 1,
    coefficientY: 0.4,
    sourceReference: 'controlled-test-basis',
  },
});
assert.equal(controlledManual.ok, true);
assert.equal(controlledManual.mode, 'MANUAL_EXPLICIT_FALLBACK');
assert.equal(controlledManual.designAuthority, false);
assert.equal(controlledManual.factorSources.S.authority, 'PREVIEW_MANUAL_FALLBACK');

const benchmarkArithmetic = calculateAndSelectPreviewB313Wall({
  dn: 250,
  outsideDiameterMm: 273,
  designPressure: 51.1,
  pressureUnit: 'barg',
  corrosionAllowanceMm: 6,
  allowableStress: 20,
  stressUnit: 'ksi',
  qualityFactorE: 1,
  weldStrengthReductionW: 1,
  coefficientY: 0.4,
  dimensionStandard: 'ASME B36.10M',
  edition: '2024',
});
assert.equal(benchmarkArithmetic.ok, true, JSON.stringify(benchmarkArithmetic));
assert(Math.abs(benchmarkArithmetic.calculation.requiredNominalThicknessMm - 12.553618958106954) < 1e-9);
assert.equal(benchmarkArithmetic.selectedNominalWallMm, 12.7);
assert.equal(benchmarkArithmetic.selectedSchedule, '60');
assert.deepEqual(benchmarkArithmetic.equivalentSchedules, ['60', 'XS']);

console.log('xml-cii B31.3 preview blocker provenance tests: PASS');
