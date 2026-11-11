export const VIBRATION_LINE_CASE_ASSESSMENT_STATUS_SCHEMA = 'VibrationLineCaseAssessmentStatus.v1';

export const VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY = Object.freeze({
  purpose: 'LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY',
  identificationStateSource: 'EXISTING_SCOPE_IDENTIFICATION_RESOLVER',
  completenessStateSource: 'AssessmentCompleteness.v1',
  determinesApplicability: false,
  determinesCompleteness: false,
  createsIdentificationEvidence: false,
  numericalAuthority: 'NONE',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  safetyAuthority: false,
  codeCompliance: false,
});

const IDENTIFICATION_STATES = new Set(['READY', 'MISSING', 'INCOMPLETE', 'INVALID']);
const COMPLETENESS_STATES = new Set(['COMPLETE', 'INCOMPLETE', 'NOT_APPLICABLE']);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function scopeValue(row = {}) {
  const line = text(row.line);
  const canonicalId = text(row.canonicalId);
  if (!line || !canonicalId) throw new TypeError('Line/case assessment status requires line and canonicalId.');
  return Object.freeze({ line, caseId: text(row.caseId) || null, canonicalId });
}

function identificationEvidence(row = {}) {
  const received = text(row.mechanismIdentificationEvidenceStatus);
  const status = IDENTIFICATION_STATES.has(received) ? received : 'UNAVAILABLE';
  const errors = Array.isArray(row.mechanismIdentificationEvidenceErrors)
    ? row.mechanismIdentificationEvidenceErrors.map((value) => String(value))
    : [];
  return Object.freeze({ status, errors: Object.freeze(errors) });
}

function completenessValue(matrix = {}) {
  const value = matrix.assessmentCompleteness;
  if (value?.schema !== 'AssessmentCompleteness.v1') {
    throw new TypeError('Line/case assessment status requires AssessmentCompleteness.v1.');
  }
  if (!COMPLETENESS_STATES.has(value.state)) {
    throw new RangeError(`Unsupported assessment completeness state: ${value.state ?? 'UNKNOWN'}.`);
  }
  return Object.freeze({
    schema: value.schema,
    state: value.state,
    requiredCount: Number(value.requiredCount) || 0,
    completeCount: Number(value.completeCount) || 0,
    incompleteCount: Number(value.incompleteCount) || 0,
    notApplicableCount: Number(value.notApplicableCount) || 0,
    unresolvedIdentificationCount: Number(value.unresolvedIdentificationCount) || 0,
    missingIdentificationCount: Number(value.missingIdentificationCount) || 0,
    missingIdentificationMechanismIds: Object.freeze([...(value.missingIdentificationMechanismIds ?? [])]),
    missingRequiredAssessmentIds: Object.freeze([...(value.missingRequiredAssessmentIds ?? [])]),
    reasons: Object.freeze([...(value.reasons ?? [])]),
    coverageId: value.coverageId ?? null,
  });
}

function assessmentEvidence(assessment) {
  if (!assessment) return null;
  return Object.freeze({
    mechanismId: assessment.mechanism?.id ?? null,
    mechanismLabel: assessment.mechanism?.label ?? null,
    lof: Number.isFinite(Number(assessment.lof)) ? Number(assessment.lof) : null,
    resultState: assessment.resultState ?? null,
    qualificationState: assessment.qualificationState ?? null,
  });
}

function evidenceProjection(current, retained) {
  const currentEvidence = assessmentEvidence(current);
  const retainedEvidence = assessmentEvidence(retained);
  let state = 'NONE';
  if (currentEvidence) state = 'CURRENT';
  else if (retainedEvidence?.resultState === 'STALE_RESULT') state = 'STALE_RETAINED';
  else if (retainedEvidence) state = 'RETAINED_NONCURRENT';
  return Object.freeze({ state, current: currentEvidence, retained: retainedEvidence });
}

function workflowState(identification, completeness) {
  if (identification.status === 'UNAVAILABLE') return 'IDENTIFICATION_STATUS_UNAVAILABLE';
  if (identification.status === 'MISSING') return 'IDENTIFICATION_MISSING';
  if (identification.status === 'INCOMPLETE') return 'IDENTIFICATION_INCOMPLETE';
  if (identification.status === 'INVALID') return 'IDENTIFICATION_INVALID';
  if (completeness.missingIdentificationCount > 0) return 'IDENTIFICATION_COVERAGE_INCOMPLETE';
  if (completeness.unresolvedIdentificationCount > 0) return 'IDENTIFICATION_UNRESOLVED';
  if (completeness.state === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (completeness.state === 'COMPLETE') return 'ASSESSMENT_COMPLETE';
  if (completeness.incompleteCount > 0) return 'REQUIRED_ASSESSMENT_INCOMPLETE';
  return 'ASSESSMENT_INCOMPLETE';
}

function nextActionCode(state) {
  const actions = {
    IDENTIFICATION_STATUS_UNAVAILABLE: 'RESTORE_IDENTIFICATION_RESOLUTION',
    IDENTIFICATION_MISSING: 'AUTHOR_T1_IDENTIFICATION',
    IDENTIFICATION_INCOMPLETE: 'COMPLETE_T1_IDENTIFICATION_EVIDENCE',
    IDENTIFICATION_INVALID: 'CORRECT_T1_IDENTIFICATION_EVIDENCE',
    IDENTIFICATION_COVERAGE_INCOMPLETE: 'AUTHOR_MISSING_MECHANISM_IDENTIFICATIONS',
    IDENTIFICATION_UNRESOLVED: 'RESOLVE_T1_IDENTIFICATION_DISPOSITIONS',
    REQUIRED_ASSESSMENT_INCOMPLETE: 'COMPLETE_REQUIRED_ASSESSMENTS',
    ASSESSMENT_INCOMPLETE: 'REVIEW_ASSESSMENT_GAPS',
    ASSESSMENT_COMPLETE: 'REVIEW_COMPLETE_ASSESSMENT_EVIDENCE',
    NOT_APPLICABLE: 'REVIEW_NOT_APPLICABLE_EVIDENCE',
  };
  return actions[state];
}

export function buildVibrationLineCaseAssessmentStatus({ row = {}, matrix = {} } = {}) {
  const scope = scopeValue(row);
  const identification = identificationEvidence(row);
  const completeness = completenessValue(matrix);
  const state = workflowState(identification, completeness);
  return Object.freeze({
    schema: VIBRATION_LINE_CASE_ASSESSMENT_STATUS_SCHEMA,
    scope,
    state,
    nextActionCode: nextActionCode(state),
    identificationEvidence: identification,
    completeness,
    screeningEvidence: evidenceProjection(matrix.screeningGoverning, matrix.retainedScreeningGoverning),
    candidateEvidence: evidenceProjection(matrix.candidateGoverning, matrix.retainedCandidateGoverning),
    authority: VIBRATION_LINE_CASE_ASSESSMENT_STATUS_AUTHORITY,
  });
}
