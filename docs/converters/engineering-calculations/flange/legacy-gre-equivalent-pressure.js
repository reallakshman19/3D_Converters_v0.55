export const LEGACY_GRE_EQUIVALENT_PRESSURE_METHOD = 'LEGACY_GRE_EQUIVALENT_PRESSURE_SCREENING';

function fail(Type, field, message) {
  const error = new Type(message);
  error.code = 'INPUT_INVALID';
  error.field = field;
  throw error;
}

function finite(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) fail(TypeError, field, `${field} must be finite.`);
  return number;
}

function positive(value, field) {
  const number = finite(value, field);
  if (!(number > 0)) fail(RangeError, field, `${field} must be greater than zero.`);
  return number;
}

function nonNegative(value, field) {
  const number = finite(value, field);
  if (number < 0) fail(RangeError, field, `${field} must be non-negative.`);
  return number;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) fail(TypeError, field, `${field} is required.`);
  return text;
}

function authorityBoundary() {
  return Object.freeze({
    sourceAuthority: 'SCREENING_REFERENCE_ONLY',
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
    physicalLeakRateEvaluated: false,
    gasketContactStressEvaluated: false,
    flangeSeparationEvaluated: false,
  });
}

export function deriveLegacyGreQualifiedPressure({
  flangeRatingPa,
  qualifiedPressureMultiplier,
} = {}) {
  const ratingPa = positive(flangeRatingPa, 'flangeRatingPa');
  const multiplier = positive(qualifiedPressureMultiplier, 'qualifiedPressureMultiplier');
  return Object.freeze({
    flangeRatingPa: ratingPa,
    qualifiedPressureMultiplier: multiplier,
    qualifiedPressurePa: ratingPa * multiplier,
    sourceAuthority: 'SCREENING_REFERENCE_ONLY',
  });
}

export function deriveLegacyGrePartFactor({ baseFactor, loadCategoryMultiplier } = {}) {
  const base = positive(baseFactor, 'baseFactor');
  const multiplier = positive(loadCategoryMultiplier, 'loadCategoryMultiplier');
  return Object.freeze({
    baseFactor: base,
    loadCategoryMultiplier: multiplier,
    partFactor: base * multiplier,
    sourceAuthority: 'SCREENING_REFERENCE_ONLY',
  });
}

function normalizeCase(input) {
  return Object.freeze({
    id: requiredText(input.id, 'id'),
    loadCategory: requiredText(input.loadCategory, 'loadCategory'),
    systemPressurePa: nonNegative(input.systemPressurePa, 'systemPressurePa'),
    qualifiedPressurePa: positive(input.qualifiedPressurePa, 'qualifiedPressurePa'),
    partFactor: positive(input.partFactor, 'partFactor'),
    meanGasketDiameterM: positive(input.meanGasketDiameterM, 'meanGasketDiameterM'),
    axialForceN: finite(input.axialForceN, 'axialForceN'),
    bendingMomentNm: nonNegative(input.bendingMomentNm, 'bendingMomentNm'),
  });
}

function equivalentTerms(input) {
  const g = input.meanGasketDiameterM;
  const bendingEquivalentPressurePa = 16 * input.bendingMomentNm / (Math.PI * g ** 3);
  const axialEquivalentPressurePa = 4 * Math.abs(input.axialForceN) / (Math.PI * g ** 2);
  return Object.freeze({ bendingEquivalentPressurePa, axialEquivalentPressurePa });
}

function acceptance(input, equivalentPressurePa) {
  const allowableEquivalentPressurePa = input.partFactor * input.qualifiedPressurePa;
  const marginPa = allowableEquivalentPressurePa - equivalentPressurePa;
  return Object.freeze({
    allowableEquivalentPressurePa,
    marginPa,
    utilization: equivalentPressurePa / allowableEquivalentPressurePa,
    passesRecoveredWorkbookCheck: equivalentPressurePa <= allowableEquivalentPressurePa,
  });
}

export function calculateLegacyGreEquivalentPressure(input = {}) {
  const normalized = normalizeCase(input);
  const terms = equivalentTerms(normalized);
  const equivalentPressurePa = normalized.systemPressurePa
    + terms.bendingEquivalentPressurePa
    + terms.axialEquivalentPressurePa;
  const check = acceptance(normalized, equivalentPressurePa);

  return Object.freeze({
    ok: true,
    method: LEGACY_GRE_EQUIVALENT_PRESSURE_METHOD,
    sourceBasis: 'FLANGE_LEAKAGE_CHECK_GRE_XLS_BIFF8_RECOVERED_EQUIVALENT_FLG',
    id: normalized.id,
    loadCategory: normalized.loadCategory,
    inputs: normalized,
    ...terms,
    equivalentPressurePa,
    ...check,
    ...authorityBoundary(),
    limitations: Object.freeze([
      'Equivalent-pressure screening only; no physical leak-rate or leak-probability model is present.',
      'Qualified-pressure multiplier and part factor must be supplied explicitly from the selected source/project basis.',
      'Axial load contributes by magnitude, matching the recovered workbook formula.',
      'Gasket contact stress, flange separation, bolt redistribution and nonlinear joint behavior are not modeled.',
      'Workbook memo KRO/604201v0 applicability remains uncontrolled in this reference implementation.',
    ]),
  });
}

function governingCase(cases) {
  return cases.reduce((best, current) => (
    !best || current.utilization > best.utilization ? current : best
  ), null);
}

export function evaluateLegacyGreEquivalentPressureCases({ cases } = {}) {
  if (!Array.isArray(cases) || !cases.length) {
    fail(RangeError, 'cases', 'At least one equivalent-pressure load case is required.');
  }
  const results = Object.freeze(cases.map((item) => calculateLegacyGreEquivalentPressure(item)));
  if (new Set(results.map((item) => item.id)).size !== results.length) {
    fail(RangeError, 'cases', 'Equivalent-pressure case ids must be unique.');
  }
  const governing = governingCase(results);
  return Object.freeze({
    ok: true,
    method: LEGACY_GRE_EQUIVALENT_PRESSURE_METHOD,
    sourceAuthority: 'SCREENING_REFERENCE_ONLY',
    cases: results,
    governingCaseId: governing.id,
    governingUtilization: governing.utilization,
    allCasesPassRecoveredWorkbookCheck: results.every((item) => item.passesRecoveredWorkbookCheck),
    codeCompliance: false,
    canUseForDesignAuthority: false,
    governingEligible: false,
  });
}
