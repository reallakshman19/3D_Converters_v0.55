export const VIBRATION_MECHANISM_NUMERIC_RESULT_SCHEMA = 'MechanismNumericResult.v1';
export const VIBRATION_MECHANISM_LINE_RESULT_SCHEMA = 'MechanismLineResult.v1';
export const VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA = 'VibrationMechanismAssessmentItem.v1';

export const VIBRATION_MECHANISM_NUMERIC_RESULT_STATES = Object.freeze([
  'CURRENT_RESULT',
  'INELIGIBLE',
]);

export const VIBRATION_MECHANISM_LINE_RESULT_STATES = Object.freeze([
  'CURRENT_RESULT',
  'INCOMPLETE',
]);

const RESULT_AUTHORITY = Object.freeze({
  authorityPromotion: false,
  screeningAuthority: 'DERIVED_FROM_ASSESSMENT_EVIDENCE_ONLY',
  designAuthority: false,
  codeCompliance: false,
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }
  return value.trim();
}

function scopeValue(scope = {}) {
  return {
    line: requiredText(scope.line, 'scope.line'),
    caseId: scope.caseId == null ? null : requiredText(scope.caseId, 'scope.caseId'),
    canonicalId: requiredText(scope.canonicalId, 'scope.canonicalId'),
  };
}

function enumValue(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new RangeError(`${field} must be one of ${allowed.join(', ')}.`);
  }
  return value;
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizedReasons(reasons) {
  return [...new Set((Array.isArray(reasons) ? reasons : []).map((value) => String(value)))];
}

export function mechanismLineResultId({ mechanismId, scope } = {}) {
  const resolvedScope = scopeValue(scope);
  return JSON.stringify([
    requiredText(mechanismId, 'mechanismId'),
    resolvedScope.line,
    resolvedScope.caseId,
    resolvedScope.canonicalId,
  ]);
}

export function createMechanismNumericResultFromAssessmentItem(item = {}) {
  if (item?.schema !== VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA) {
    throw new TypeError(`Assessment item must use ${VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA}.`);
  }
  const mechanismId = requiredText(item.mechanismId, 'item.mechanismId');
  const scope = scopeValue(item.scope);
  const itemId = requiredText(item.itemId, 'item.itemId');
  const reasons = [];

  if (item.implementationState !== 'IMPLEMENTED_SCREENING'
      || item.qualification?.effective !== 'SCREENING') {
    reasons.push('SCREENING_QUALIFICATION_REQUIRED');
  }
  if (item.assessmentState !== 'CALCULATED' || item.resultState !== 'CURRENT_RESULT') {
    reasons.push('CURRENT_SCREENING_RESULT_REQUIRED');
  }

  const observedLof = item.result?.governingLof;
  if (!finiteNonNegative(observedLof)) reasons.push('VALID_GOVERNING_LOF_REQUIRED');

  const aggregationEligible = reasons.length === 0;
  return deepFreeze({
    schema: VIBRATION_MECHANISM_NUMERIC_RESULT_SCHEMA,
    mechanismId,
    scope,
    assessmentItemId: itemId,
    childKey: item.child?.key == null ? null : String(item.child.key),
    state: aggregationEligible ? 'CURRENT_RESULT' : 'INELIGIBLE',
    observedGoverningLof: finiteNonNegative(observedLof) ? observedLof : null,
    lof: {
      value: aggregationEligible ? observedLof : null,
      definition: 'ASSESSMENT_ITEM_GOVERNING_LOF',
      unit: '1',
    },
    sourceResultState: item.resultState ?? null,
    sourceAssessmentState: item.assessmentState ?? null,
    sourceImplementationState: item.implementationState ?? null,
    sourceQualification: item.qualification?.effective ?? null,
    aggregationEligible,
    reasons,
    authority: RESULT_AUTHORITY,
  });
}

export function createMechanismLineResult(input = {}) {
  const mechanismId = requiredText(input.mechanismId, 'mechanismId');
  const scope = scopeValue(input.scope);
  const state = enumValue(input.state, VIBRATION_MECHANISM_LINE_RESULT_STATES, 'state');
  const numericResults = Array.isArray(input.numericResults) ? [...input.numericResults] : [];
  const sourceItemIds = numericResults.map((item) => requiredText(item.assessmentItemId, 'numericResults[].assessmentItemId'));
  const reasons = normalizedReasons(input.reasons);
  const aggregationEligible = input.aggregationEligible === true;

  if (state === 'CURRENT_RESULT') {
    if (!aggregationEligible) throw new Error('CURRENT_MECHANISM_LINE_RESULT_MUST_BE_AGGREGATION_ELIGIBLE');
    if (!finiteNonNegative(input.governingLof)) throw new Error('CURRENT_MECHANISM_LINE_RESULT_REQUIRES_VALID_LOF');
    if (reasons.length) throw new Error('CURRENT_MECHANISM_LINE_RESULT_CANNOT_HAVE_BLOCKING_REASONS');
  } else if (aggregationEligible || input.governingLof != null) {
    throw new Error('INCOMPLETE_MECHANISM_LINE_RESULT_CANNOT_BE_NUMERIC_OR_ELIGIBLE');
  }

  return deepFreeze({
    schema: VIBRATION_MECHANISM_LINE_RESULT_SCHEMA,
    lineResultId: mechanismLineResultId({ mechanismId, scope }),
    mechanismId,
    scope,
    assessmentId: input.assessmentId == null ? null : requiredText(input.assessmentId, 'assessmentId'),
    state,
    governingLof: state === 'CURRENT_RESULT' ? input.governingLof : null,
    aggregationEligible,
    reduction: input.reduction ?? null,
    numericResults,
    sourceItemIds,
    reasons,
    authority: RESULT_AUTHORITY,
  });
}
