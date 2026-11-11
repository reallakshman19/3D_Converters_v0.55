export const VIBRATION_T1_SUGGESTION_SCHEMA = 'VibrationT1MechanismSuggestion.v1';
export const VIBRATION_T1_SUGGESTION_SET_SCHEMA = 'VibrationT1MechanismSuggestionSet.v1';

const SUGGESTION_AUTHORITY = Object.freeze({
  suggestionAuthority: 'CONTEXT_ASSISTANCE_ONLY',
  identificationAuthority: 'NONE',
  automaticApplicabilityRules: false,
  createsIdentificationEvidence: false,
  countsTowardCompleteness: false,
  engineerDispositionRequired: true,
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  codeCompliance: false,
});

function rule(ruleId, property, mechanismId, suggestedAssessmentUnitType, label) {
  return Object.freeze({
    ruleId, property, mechanismId, suggestedAssessmentUnitType, label,
    confidence: 'HIGH', requiredStatus: 'VERIFIED', requiredValue: true,
  });
}

export const VIBRATION_T1_SUGGESTION_RULES = Object.freeze([
  rule('VIB-T1-SUG-RECIP-PD-001', 'T1_RECIP_PD_EQUIPMENT_PRESENT', 'reciprocatingPulsation', 'MAIN_LINE_SECTION', 'Reciprocating / positive-displacement equipment present'),
  rule('VIB-T1-SUG-ROTATING-001', 'T1_ROTATING_EQUIPMENT_CONNECTION_PRESENT', 'mechanicalExcitation', 'MAIN_LINE_SECTION', 'Rotating equipment connection present'),
  rule('VIB-T1-SUG-DEADLEG-001', 'T1_DEADLEG_PRESENT', 'deadlegPulsation', 'DEADLEG_BRANCH', 'Deadleg present'),
  rule('VIB-T1-SUG-AIV-001', 'T1_PRESSURE_REDUCING_GAS_SOURCE_PRESENT', 'aiv', 'AIV_SOURCE_ASSESSMENT_PAIR', 'Pressure-reducing gas source present'),
  rule('VIB-T1-SUG-SBC-001', 'T1_SMALL_BORE_CONNECTION_PRESENT', 'smallBoreConnections', 'SBC_CONNECTION', 'Small-bore connection present'),
  rule('VIB-T1-SUG-THERMOWELL-001', 'T1_THERMOWELL_OR_INTRUSIVE_ELEMENT_PRESENT', 'thermowells', 'INTRUSIVE_ELEMENT', 'Thermowell or intrusive element present'),
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function text(value) { return value == null ? '' : String(value).trim(); }
function caseId(value) { return text(value) || null; }
function scopeValue(input = {}) {
  const scope = { line: text(input.line), caseId: caseId(input.caseId), canonicalId: text(input.canonicalId) };
  if (!scope.line || !scope.canonicalId) throw new TypeError('T1 suggestion scope requires line and canonicalId.');
  return scope;
}
function sameScope(row, scope) {
  return text(row?.line) === scope.line
    && caseId(row?.caseId) === scope.caseId
    && text(row?.canonicalId) === scope.canonicalId;
}
function triggerMatches(row, ruleValue) {
  return sameScope(row, ruleValue.scope)
    && text(row?.property) === ruleValue.property
    && row?.value === true
    && text(row?.status).toUpperCase() === ruleValue.requiredStatus;
}
function sourceTrace(row) {
  return {
    source: text(row?.source), sourceRevision: text(row?.sourceRevision) || null,
    recordId: text(row?.recordId) || null, reviewer: text(row?.reviewer) || null,
  };
}
function suggestionId(scope, ruleValue) {
  return JSON.stringify([
    'T1_SUGGESTION', ruleValue.ruleId, scope.line, scope.caseId, scope.canonicalId,
  ]);
}

export function suggestVibrationMechanismsForScope({ scope: scopeInput, enrichment = [] } = {}) {
  const scope = scopeValue(scopeInput);
  if (!Array.isArray(enrichment)) throw new TypeError('T1 suggestion enrichment must be an array.');
  const suggestions = [];
  for (const ruleValue of VIBRATION_T1_SUGGESTION_RULES) {
    const scopedRule = { ...ruleValue, scope };
    const trigger = enrichment.find((row) => triggerMatches(row, scopedRule));
    if (!trigger) continue;
    suggestions.push(deepFreeze({
      schema: VIBRATION_T1_SUGGESTION_SCHEMA,
      suggestionId: suggestionId(scope, ruleValue),
      ruleId: ruleValue.ruleId,
      mechanismId: ruleValue.mechanismId,
      scope,
      suggestedAssessmentUnitType: ruleValue.suggestedAssessmentUnitType,
      confidence: ruleValue.confidence,
      disposition: 'PENDING_ENGINEER_REVIEW',
      triggerFact: {
        property: ruleValue.property, value: true, status: 'VERIFIED',
        label: ruleValue.label, ...sourceTrace(trigger),
      },
      authority: SUGGESTION_AUTHORITY,
    }));
  }
  return deepFreeze({
    schema: VIBRATION_T1_SUGGESTION_SET_SCHEMA,
    scope,
    suggestions,
    authority: SUGGESTION_AUTHORITY,
  });
}

export function collectVibrationT1Suggestions({ scopes = [], enrichment = [] } = {}) {
  if (!Array.isArray(scopes)) throw new TypeError('T1 suggestion scopes must be an array.');
  const suggestions = scopes.flatMap((scope) => (
    suggestVibrationMechanismsForScope({ scope, enrichment }).suggestions
  ));
  return deepFreeze([...suggestions].sort((a, b) => a.suggestionId.localeCompare(b.suggestionId)));
}
