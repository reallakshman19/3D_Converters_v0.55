import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_GRE_EQUIVALENT_PRESSURE_METHOD,
  calculateLegacyGreEquivalentPressure,
  deriveLegacyGrePartFactor,
  deriveLegacyGreQualifiedPressure,
  evaluateLegacyGreEquivalentPressureCases,
} from '../converters/engineering-calculations/flange/legacy-gre-equivalent-pressure.js';

function close(actual, expected, tolerance = 1e-12) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

const G = 0.764;
const QUALIFIED = 4e6;

function sourceCase(id, loadCategory, systemPressurePa, partFactor, axialForceN, bendingMomentNm) {
  return {
    id,
    loadCategory,
    systemPressurePa,
    qualifiedPressurePa: QUALIFIED,
    partFactor,
    meanGasketDiameterM: G,
    axialForceN,
    bendingMomentNm,
  };
}

const DESIGN = sourceCase('ROW13-DES', 'DESIGN_LONG_TERM', 1e6, 0.6944, -847, 22);
const SUSTAINED = sourceCase('ROW13-SUS', 'SUSTAINED_LONG_TERM', 1e6, 0.56, -750, 15);
const HYDRO = sourceCase('ROW13-HYD', 'HYDROTEST_SHORT_TERM', 1.5e6, 0.7448, -781, 11);

test('workbook qualification multiplier is explicit and reproduces row-13 Pq', () => {
  const result = deriveLegacyGreQualifiedPressure({ flangeRatingPa: 2e6, qualifiedPressureMultiplier: 2 });
  close(result.qualifiedPressurePa, 4e6);
  assert.equal(result.sourceAuthority, 'SCREENING_REFERENCE_ONLY');
});

test('workbook part-factor decompositions reproduce design, sustained and hydro factors', () => {
  close(deriveLegacyGrePartFactor({ baseFactor: 0.56, loadCategoryMultiplier: 1.24 }).partFactor, 0.6944);
  close(deriveLegacyGrePartFactor({ baseFactor: 0.56, loadCategoryMultiplier: 1 }).partFactor, 0.56);
  close(deriveLegacyGrePartFactor({ baseFactor: 0.56, loadCategoryMultiplier: 1.33 }).partFactor, 0.7448);
});

test('row-13 design case reproduces workbook bending, axial and total equivalent pressure', () => {
  const result = calculateLegacyGreEquivalentPressure(DESIGN);
  close(result.bendingEquivalentPressurePa, 251.2538441097501);
  close(result.axialEquivalentPressurePa, 1847.5951426610475);
  close(result.equivalentPressurePa, 1002098.8489867707);
  close(result.allowableEquivalentPressurePa, 2777600);
  assert.equal(result.passesRecoveredWorkbookCheck, true);
});

test('row-13 sustained case reproduces workbook result', () => {
  const result = calculateLegacyGreEquivalentPressure(SUSTAINED);
  close(result.bendingEquivalentPressurePa, 171.3094391657387);
  close(result.axialEquivalentPressurePa, 1636.0051440328048);
  close(result.equivalentPressurePa, 1001807.3145831985);
  close(result.utilization, 0.4472354082960708);
});

test('row-13 hydrotest case reproduces workbook result', () => {
  const result = calculateLegacyGreEquivalentPressure(HYDRO);
  close(result.bendingEquivalentPressurePa, 125.62692205487505);
  close(result.axialEquivalentPressurePa, 1703.6266899861607);
  close(result.equivalentPressurePa, 1501829.253612041);
  close(result.marginPa, 1477370.746387959);
});

test('axial contribution uses magnitude for tension and compression, matching workbook ABS(F)', () => {
  const compression = calculateLegacyGreEquivalentPressure(DESIGN);
  const tension = calculateLegacyGreEquivalentPressure({ ...DESIGN, axialForceN: 847 });
  close(compression.axialEquivalentPressurePa, tension.axialEquivalentPressurePa);
  close(compression.equivalentPressurePa, tension.equivalentPressurePa);
});

test('bending equivalent pressure follows 16 M over pi G cubed in SI', () => {
  const result = calculateLegacyGreEquivalentPressure({ ...DESIGN, bendingMomentNm: 44 });
  close(result.bendingEquivalentPressurePa, 2 * 251.2538441097501);
});

test('multi-case API preserves category identity and reports the highest utilization', () => {
  const result = evaluateLegacyGreEquivalentPressureCases({ cases: [DESIGN, SUSTAINED, HYDRO] });
  assert.equal(result.method, LEGACY_GRE_EQUIVALENT_PRESSURE_METHOD);
  assert.equal(result.governingCaseId, 'ROW13-HYD');
  close(result.governingUtilization, 0.5041048783606475);
  assert.equal(result.allCasesPassRecoveredWorkbookCheck, true);
});

test('a demand above factored qualified pressure fails the recovered workbook check', () => {
  const result = calculateLegacyGreEquivalentPressure({
    ...DESIGN,
    systemPressurePa: 3e6,
  });
  assert.equal(result.passesRecoveredWorkbookCheck, false);
  assert(result.marginPa < 0);
  assert(result.utilization > 1);
});

test('negative bending moment is rejected because workbook Mb is a magnitude input', () => {
  assert.throws(
    () => calculateLegacyGreEquivalentPressure({ ...DESIGN, bendingMomentNm: -1 }),
    (error) => error.code === 'INPUT_INVALID' && error.field === 'bendingMomentNm',
  );
});

test('zero or invalid qualified pressure, part factor and gasket diameter fail closed', () => {
  assert.throws(() => calculateLegacyGreEquivalentPressure({ ...DESIGN, qualifiedPressurePa: 0 }), /greater than zero/);
  assert.throws(() => calculateLegacyGreEquivalentPressure({ ...DESIGN, partFactor: 0 }), /greater than zero/);
  assert.throws(() => calculateLegacyGreEquivalentPressure({ ...DESIGN, meanGasketDiameterM: 0 }), /greater than zero/);
});

test('duplicate case ids fail closed before an envelope is accepted', () => {
  assert.throws(
    () => evaluateLegacyGreEquivalentPressureCases({ cases: [DESIGN, { ...SUSTAINED, id: DESIGN.id }] }),
    (error) => error.code === 'INPUT_INVALID' && error.field === 'cases',
  );
});

test('screening result exposes authority boundary and no leak-rate or contact claims', () => {
  const result = calculateLegacyGreEquivalentPressure(DESIGN);
  assert.equal(result.sourceAuthority, 'SCREENING_REFERENCE_ONLY');
  assert.equal(result.physicalLeakRateEvaluated, false);
  assert.equal(result.gasketContactStressEvaluated, false);
  assert.equal(result.flangeSeparationEvaluated, false);
  assert.equal(result.codeCompliance, false);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
  assert.equal(Object.hasOwn(result, 'leakRate'), false);
});
