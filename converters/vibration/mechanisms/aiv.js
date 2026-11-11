import {
  createVibrationMechanismAssessmentItem,
  createVibrationMechanismAssessmentSet,
} from './contracts.js';

export const AIV_VIBRATION_MECHANISM_ID = 'aiv';
export const AIV_VIBRATION_MECHANISM_IMPLEMENTATION_STATE = 'IMPLEMENTED_SCREENING';

const AIV_CALCULATION_ID = 'VIB.AIV.ACOUSTIC';
const AIV_ASSESSMENT_SCHEMA = 'AivAssessmentResult.v1';
const ALLOWED_RESULT_STATES = new Set(['CURRENT_RESULT', 'STALE_RESULT']);

function scope(row = {}) {
  return {
    line: String(row.line ?? '').trim(),
    caseId: row.caseId == null ? null : String(row.caseId).trim(),
    canonicalId: String(row.canonicalId ?? '').trim(),
  };
}

function sameAssessmentScope(result, target) {
  return String(result?.line ?? '').trim() === target.line
    && (result?.caseId == null ? null : String(result.caseId).trim()) === target.caseId
    && String(result?.assessmentCanonicalId ?? '').trim() === target.canonicalId;
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function assertScreeningEnvelope(result) {
  if (!result || typeof result !== 'object') throw new TypeError('AIV screening result must be an object.');
  if (result.ok !== true || result.calculationId !== AIV_CALCULATION_ID) {
    throw new Error('AIV_INTEGRITY_REGISTERED_SCREENING_RESULT_REQUIRED');
  }
  if (result.outputs?.screeningResultScope !== 'ASSESSMENT') {
    throw new Error('AIV_INTEGRITY_ASSESSMENT_SCOPE_REQUIRED');
  }
  if (result.assessment?.resultScope !== 'ASSESSMENT_SCREENING'
      || result.assessment?.screeningAuthority !== 'AUTHORIZED'
      || result.assessment?.lineCaseSummaryAuthoritativeForScreening !== false
      || result.assessment?.designAuthority !== false) {
    throw new Error('AIV_INTEGRITY_SCREENING_AUTHORITY_INVALID');
  }
  if (!Array.isArray(result.outputs?.assessmentResults)) {
    throw new TypeError('AIV screening result must contain assessmentResults.');
  }
  return result;
}

function assertAssessmentResult(result) {
  const authority = result?.authority ?? {};
  const valid = result?.schema === AIV_ASSESSMENT_SCHEMA
    && result?.resultScope === 'ASSESSMENT'
    && result?.calculationId === AIV_CALCULATION_ID
    && result?.status === 'SCREENING_CALCULATED'
    && finiteNonNegative(result?.lof)
    && authority.calculationState === 'IMPLEMENTED'
    && authority.qualificationState === 'SCREENING'
    && authority.engineeringAuthority === 'SCREENING'
    && authority.screeningAuthority === 'AUTHORIZED'
    && authority.designAuthority === false;
  if (!valid) throw new Error(`AIV_INTEGRITY_ASSESSMENT_RESULT_INVALID:${result?.assessmentCanonicalId ?? 'UNKNOWN'}`);
  return result;
}

function screeningQualification(result) {
  return Object.freeze({
    effective: 'SCREENING',
    method: 'SCREENING',
    data: 'SCREENING',
    engineeringAuthority: 'SCREENING',
    screeningAuthority: 'AUTHORIZED',
    designAuthority: false,
    sourceQualificationState: result.authority.qualificationState,
  });
}

function assessmentItem(target, result, resultState) {
  return createVibrationMechanismAssessmentItem({
    mechanismId: AIV_VIBRATION_MECHANISM_ID,
    scope: target,
    childKey: result.assessmentCanonicalId,
    implementationState: AIV_VIBRATION_MECHANISM_IMPLEMENTATION_STATE,
    assessmentState: 'CALCULATED',
    resultState,
    applicability: {
      applicable: true,
      resultScope: 'ASSESSMENT',
      assessmentCanonicalId: result.assessmentCanonicalId,
      contributingSourceCanonicalIds: result.contributingSourceCanonicalIds ?? [],
    },
    result: {
      assessmentLof: result.lof,
      governingLof: null,
      resultScope: 'ASSESSMENT',
      aggregationEligible: false,
      aggregationBlockedReason: 'AIV_LINE_CASE_AGGREGATION_NOT_QUALIFIED',
    },
    qualification: screeningQualification(result),
    evidence: {
      schema: result.schema,
      calculationId: result.calculationId,
      status: result.status,
      assessmentCanonicalId: result.assessmentCanonicalId,
      line: result.line,
      caseId: result.caseId,
      authority: result.authority,
    },
    trace: {
      ruleIds: ['AIV_ASSESSMENT_SCOPE_EXACT_IDENTITY'],
      inputTrace: {
        status: 'SOURCE_AND_NORMALIZED_ONLY',
        normalizedInputs: {
          line: result.line,
          caseId: result.caseId,
          assessmentCanonicalId: result.assessmentCanonicalId,
        },
        sourceTrace: result.trace ?? null,
      },
    },
  });
}

export function buildAivVibrationMechanismAssessmentSet({
  row,
  screeningResult = null,
  resultState = 'UNRUN',
} = {}) {
  const target = scope(row);
  if (!target.line || !target.canonicalId) throw new TypeError('AIV Integrity adapter requires row line and canonicalId.');
  if (!screeningResult) {
    return createVibrationMechanismAssessmentSet({
      mechanismId: AIV_VIBRATION_MECHANISM_ID,
      scope: target,
      items: [],
    });
  }
  if (!ALLOWED_RESULT_STATES.has(resultState)) {
    throw new Error(`AIV_INTEGRITY_RESULT_CURRENCY_REQUIRED:${resultState ?? 'UNKNOWN'}`);
  }
  const envelope = assertScreeningEnvelope(screeningResult);
  const matches = envelope.outputs.assessmentResults
    .filter((result) => sameAssessmentScope(result, target))
    .map(assertAssessmentResult);
  if (matches.length > 1) {
    throw new Error(`AIV_INTEGRITY_DUPLICATE_ASSESSMENT_RESULT:${target.line}:${target.caseId ?? ''}:${target.canonicalId}`);
  }
  return createVibrationMechanismAssessmentSet({
    mechanismId: AIV_VIBRATION_MECHANISM_ID,
    scope: target,
    items: matches.map((result) => assessmentItem(target, result, resultState)),
  });
}
