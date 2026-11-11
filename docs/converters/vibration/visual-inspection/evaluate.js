import {
  createVibrationVisualInspectionError,
  createVibrationVisualInspectionEvidencePackage,
} from './contracts.js';

export const VIBRATION_VISUAL_INSPECTION_STATUS_SCHEMA = 'VibrationVisualInspectionStatus.v1';
export const VIBRATION_VISUAL_INSPECTION_STATUS_AUTHORITY = Object.freeze({
  authority: 'VISUAL_OBSERVATION_WORKFLOW_PROJECTION_ONLY',
  eiChecklistCoverage: 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sameScope(left, right) {
  return left.lineId === right.lineId
    && left.caseId === right.caseId
    && left.operatingCaseSnapshotId === right.operatingCaseSnapshotId
    && left.operatingCaseSnapshotHash === right.operatingCaseSnapshotHash;
}

function normalizedScope(value = {}) {
  const required = ['lineId', 'caseId', 'operatingCaseSnapshotId'];
  for (const field of required) {
    if (typeof value[field] !== 'string' || !value[field].trim()) throw new TypeError(`scope.${field} must be non-empty text.`);
  }
  if (typeof value.operatingCaseSnapshotHash !== 'string' || !SHA256_PATTERN.test(value.operatingCaseSnapshotHash)) {
    throw createVibrationVisualInspectionError(
      'VIBRATION_VISUAL_HASH_REQUIRED',
      'scope.operatingCaseSnapshotHash must be a canonical sha256 hash.',
      { field: 'scope.operatingCaseSnapshotHash' },
    );
  }
  return Object.freeze({
    lineId: value.lineId.trim(),
    caseId: value.caseId.trim(),
    operatingCaseSnapshotId: value.operatingCaseSnapshotId.trim(),
    operatingCaseSnapshotHash: value.operatingCaseSnapshotHash,
  });
}

function observationSummary(records) {
  const observations = records.flatMap((record) => record.observations);
  const counts = { OBSERVED: 0, NOT_OBSERVED: 0, NOT_INSPECTED: 0, UNRESOLVED: 0 };
  for (const item of observations) counts[item.state] += 1;
  return { observations, counts };
}

function workflowState(recordCount, counts) {
  if (recordCount === 0) return 'NO_VISUAL_EVIDENCE';
  if (counts.UNRESOLVED > 0) return 'UNRESOLVED_VISUAL_OBSERVATIONS';
  if (counts.NOT_INSPECTED > 0) return 'VISUAL_EVIDENCE_INCOMPLETE';
  if (counts.OBSERVED > 0) return 'OBSERVED_CONDITIONS_REQUIRE_REVIEW';
  return 'VISUAL_EVIDENCE_RECORDED';
}

export function evaluateVibrationVisualInspectionScope({ scope, evidence } = {}) {
  const normalized = normalizedScope(scope);
  const pkg = createVibrationVisualInspectionEvidencePackage(evidence);
  const records = pkg.records.filter((record) => sameScope(normalized, record.scope));
  const { observations, counts } = observationSummary(records);
  const state = workflowState(records.length, counts);
  return deepFreeze({
    schema: VIBRATION_VISUAL_INSPECTION_STATUS_SCHEMA,
    scope: normalized,
    state,
    inspectionIds: records.map((record) => record.inspectionId).sort(),
    observationCount: observations.length,
    countsByObservationState: counts,
    engineerReviewRequired: counts.OBSERVED > 0 || counts.UNRESOLVED > 0,
    authority: VIBRATION_VISUAL_INSPECTION_STATUS_AUTHORITY,
  });
}
