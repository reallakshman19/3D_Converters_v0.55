import {
  inspectMechanicalFacilityCandidate,
  mechanicalFacilityScope,
} from '../mechanical/facility.js';
import {
  createVibrationMechanismAssessmentItem,
  createVibrationMechanismAssessmentSet,
} from './contracts.js';

export const MECHANICAL_VIBRATION_MECHANISM_ID = 'mechanicalExcitation';
export const MECHANICAL_VIBRATION_MECHANISM_IMPLEMENTATION_STATE = 'IMPLEMENTED_SCREENING';

function scopeFromRow(row = {}) {
  return {
    line: row.line,
    caseId: row.caseId ?? null,
    canonicalId: row.canonicalId,
  };
}

function normalizeKeys(sourceKeys) {
  return Array.isArray(sourceKeys)
    ? [...new Set(sourceKeys.map((value) => String(value ?? '').trim()).filter(Boolean))]
    : [];
}

function readiness(sourceKeys, inspected, notApplicable) {
  if (notApplicable) return { missing: [], invalid: [], reasons: [] };
  if (!sourceKeys.length) {
    return {
      missing: ['MECHANICAL_T23_EQUIPMENT_SOURCE_SELECTION'],
      invalid: [],
      reasons: ['MECHANICAL_T23_APPLICABILITY_UNKNOWN'],
    };
  }
  if (inspected.status === 'NOT_EVALUATED') {
    return {
      missing: ['MECHANICAL_T23_SCREENING_EVALUATION'],
      invalid: [],
      reasons: ['MECHANICAL_T23_EVALUATION_REQUIRED'],
    };
  }
  if (!inspected.ok) {
    return { missing: [], invalid: [inspected.status], reasons: [inspected.status] };
  }
  return { missing: [], invalid: [], reasons: [] };
}

function assessmentState(sourceKeys, inspected, notApplicable) {
  if (notApplicable) return 'NOT_APPLICABLE';
  if (!sourceKeys.length) return 'APPLICABILITY_UNKNOWN';
  if (!inspected.ok) return 'APPLICABLE_INCOMPLETE';
  return 'CALCULATED';
}

function resultState(inspected, requested, notApplicable) {
  if (notApplicable || !inspected.ok) return 'UNRUN';
  return requested === 'STALE_RESULT' ? 'STALE_RESULT' : 'CURRENT_RESULT';
}

function resultValue(inspected, notApplicable) {
  if (notApplicable) {
    return { calculated: false, governingLof: null, status: 'NOT_APPLICABLE', governingSourceKey: null };
  }
  if (!inspected.ok) {
    return { calculated: false, governingLof: null, status: inspected.status, governingSourceKey: null };
  }
  const screening = inspected.candidate;
  return {
    calculated: true,
    governingLof: screening.governingLof,
    status: screening.status,
    governingSourceKey: screening.governingSourceKey,
    sourceRows: screening.rows,
    governingEligible: true,
  };
}

function traceValue(sourceKeys, inspected, notApplicable) {
  return {
    equationIds: [],
    ruleIds: ['EI-AVIFF-T2.3-TABLE-T2-3-DIRECT-BASELINE-MAX'],
    correlationIds: [],
    inputTrace: {
      status: sourceKeys.length || notApplicable ? 'SOURCE_AND_NORMALIZED_ONLY' : 'UNAVAILABLE',
      normalizedInputs: { sourceKeys, notApplicable },
      sourceTrace: inspected.ok ? inspected.candidate.provenance : null,
    },
  };
}

function evidenceValue(inspected, notApplicable) {
  if (!inspected.ok || notApplicable) {
    return { facilityScope: inspected.scope, status: notApplicable ? 'NOT_APPLICABLE' : inspected.status };
  }
  return {
    facilityScope: inspected.scope,
    provenance: inspected.candidate.provenance,
    authority: inspected.candidate.authority,
    excludedBranches: [
      'SHARED_SUPPORT_ADJACENT_LINE_TRANSFER',
      'POST_DYNAMIC_ANALYSIS_REDUCED_LOF',
    ],
  };
}

export function buildMechanicalVibrationMechanismAssessmentItem(options = {}) {
  const { row, cachedCandidate = null, resultState: requestedResultState = null } = options;
  const sourceKeys = normalizeKeys(options.sourceKeys);
  const notApplicable = options.notApplicable === true;
  const facilityScope = mechanicalFacilityScope(row);
  const inspected = inspectMechanicalFacilityCandidate(row, cachedCandidate);
  return createVibrationMechanismAssessmentItem({
    mechanismId: MECHANICAL_VIBRATION_MECHANISM_ID,
    scope: scopeFromRow(row), childKey: 't2.3-direct-baseline', childOrdinal: 0,
    implementationState: MECHANICAL_VIBRATION_MECHANISM_IMPLEMENTATION_STATE,
    assessmentState: assessmentState(sourceKeys, inspected, notApplicable),
    resultState: resultState(inspected, requestedResultState, notApplicable),
    applicability: {
      status: notApplicable ? 'NOT_APPLICABLE_USER_CONFIRMED'
        : sourceKeys.length ? 'USER_SELECTED_CONNECTED_OR_ADJACENT_EQUIPMENT' : 'UNKNOWN',
      facilityScopeId: facilityScope.scopeId, sourceKeys,
    },
    readiness: readiness(sourceKeys, inspected, notApplicable),
    request: {
      methodId: 'VIB.MECHANICAL.T2_3.BASELINE', facilityScopeId: facilityScope.scopeId,
      evidenceClass: 'CONTROLLED_EI_T2_3_TABLE_T2_3_DIRECT_BASELINE',
    },
    execution: inspected.ok && !notApplicable
      ? { status: 'CALCULATED_SCREENING', screeningAuthorized: true } : null,
    result: resultValue(inspected, notApplicable),
    trace: traceValue(sourceKeys, inspected, notApplicable),
    qualification: {
      effective: 'SCREENING', engineeringAuthority: 'SCREENING',
      screeningAuthority: 'AUTHORIZED', designAuthority: false, masterDataAuthority: false,
      authorityScope: 'DIRECT_TABLE_T2_3_BASELINE_ONLY',
    },
    evidence: evidenceValue(inspected, notApplicable),
  });
}

export function buildMechanicalVibrationMechanismAssessmentSet(options = {}) {
  const item = buildMechanicalVibrationMechanismAssessmentItem(options);
  return createVibrationMechanismAssessmentSet({
    mechanismId: MECHANICAL_VIBRATION_MECHANISM_ID,
    scope: item.scope,
    items: [item],
  });
}
