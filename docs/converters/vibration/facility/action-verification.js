import {
  assertVibrationActionCompletionRecord,
  assertVibrationActionOccurrence,
} from './action-completion.js';
import {
  assertVibrationActionVerificationStatusIntegrity,
  vibrationActionVerificationFingerprint,
} from './action-verification-integrity.js';
import { VIBRATION_REQUIRED_ACTION_SCHEMA } from './action-lifecycle.js';
import { assertVibrationMeasurementEvidencePackage } from '../measurement/contracts.js';
import { createVibrationVerificationRequirement } from '../verification/contracts.js';
import { evaluateVibrationVerification } from '../verification/evaluate.js';

export const VIBRATION_ACTION_VERIFICATION_ATTACHMENT_SCHEMA = 'VibrationActionVerificationAttachment.v2';

export const VIBRATION_ACTION_VERIFICATION_AUTHORITY = Object.freeze({
  purpose: 'ACTION_OCCURRENCE_MEASUREMENT_VERIFICATION_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  verificationAuthority: 'DELEGATED_TO_EXISTING_VERIFICATION_CONTRACT',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256 = /^sha256:[0-9a-f]{64}$/u;

function custodyError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationActionVerificationCustodyError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw custodyError('VIBRATION_ACTION_VERIFICATION_TEXT_REQUIRED', `${field} is required.`, { field });
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertAuthority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_ACTION_VERIFICATION_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw custodyError('VIBRATION_ACTION_VERIFICATION_AUTHORITY_INVALID', `Attachment authority mismatch at ${key}.`, { key });
    }
  }
}

function sameScope(left, right) {
  return left.lineId === right.lineId
    && left.caseId === right.caseId
    && left.operatingCaseSnapshotId === right.operatingCaseSnapshotId
    && left.operatingCaseSnapshotHash === right.operatingCaseSnapshotHash;
}

function actionReference(action, occurrence) {
  if (action?.schema !== VIBRATION_REQUIRED_ACTION_SCHEMA) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_ACTION_SCHEMA_INVALID', `action.schema must be ${VIBRATION_REQUIRED_ACTION_SCHEMA}.`);
  }
  const actionId = text(action.actionId, 'action.actionId');
  const mechanismId = text(action.mechanismId, 'action.mechanismId');
  const scope = {
    line: text(action.scope?.line, 'action.scope.line'),
    caseId: text(action.scope?.caseId, 'action.scope.caseId'),
    canonicalId: text(action.scope?.canonicalId, 'action.scope.canonicalId'),
  };
  if (actionId !== occurrence.actionId) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_ACTION_ID_MISMATCH', 'Action ID does not match the action occurrence.');
  }
  const scenario = occurrence.scenarioExecutionBasis;
  if (scope.line !== scenario.line || scope.caseId !== scenario.caseId) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_ACTION_SCOPE_MISMATCH', 'Action scope does not match the action occurrence scenario.');
  }
  return Object.freeze({ schema: VIBRATION_REQUIRED_ACTION_SCHEMA, actionId, mechanismId, scope: Object.freeze(scope) });
}

export function vibrationVerificationScopeFromActionOccurrence(input) {
  const occurrence = assertVibrationActionOccurrence(input);
  const scenario = occurrence.scenarioExecutionBasis;
  return Object.freeze({
    lineId: scenario.line,
    caseId: scenario.caseId,
    operatingCaseSnapshotId: scenario.scenarioId,
    operatingCaseSnapshotHash: scenario.scenarioSnapshotHash,
  });
}

function requirementForAction(actionRef, occurrence, input) {
  const expectedScope = vibrationVerificationScopeFromActionOccurrence(occurrence);
  const requirement = createVibrationVerificationRequirement(input);
  if (requirement.mechanismId !== actionRef.mechanismId) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_MECHANISM_MISMATCH', 'Verification mechanism does not match the required action.');
  }
  if (!sameScope(requirement.scope, expectedScope)) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_SCOPE_MISMATCH', 'Verification requirement scope must exactly match the action occurrence scenario.', {
      expectedScope,
      actualScope: requirement.scope,
    });
  }
  return requirement;
}

export function createVibrationActionVerificationRequirement({
  action, occurrence, requirementId, requirementType, reason, requiredProductTypes,
} = {}) {
  const normalizedOccurrence = assertVibrationActionOccurrence(occurrence);
  const actionRef = actionReference(action, normalizedOccurrence);
  return createVibrationVerificationRequirement({
    requirementId,
    scope: vibrationVerificationScopeFromActionOccurrence(normalizedOccurrence),
    mechanismId: actionRef.mechanismId,
    requirementType,
    reason,
    requiredProductTypes,
  });
}

function completionReference(input, occurrence) {
  if (input == null) return null;
  const record = assertVibrationActionCompletionRecord(input);
  if (record.actionId !== occurrence.actionId || record.occurrenceId !== occurrence.occurrenceId) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_COMPLETION_OCCURRENCE_MISMATCH', 'Completion record must reference the exact action occurrence.');
  }
  return record;
}

function evidenceSnapshot(status, pkg) {
  const sessionIndex = new Map(pkg.sessions.map((session) => [session.sessionId, session]));
  const productIndex = new Map(pkg.products.map((product) => [product.productId, product]));
  const sessions = status.evidence.matchingSessionIds.map((sessionId) => {
    const session = sessionIndex.get(sessionId);
    return Object.freeze({
      sessionId,
      measurementRecordFingerprint: vibrationActionVerificationFingerprint(session),
      rawDataHashes: Object.freeze(session.channels.map((channel) => channel.rawData.sha256).sort()),
    });
  });
  const products = status.evidence.matchingProductIds.map((productId) => {
    const product = productIndex.get(productId);
    return Object.freeze({
      productId,
      sessionId: product.sessionId,
      productType: product.productType,
      measurementRecordFingerprint: vibrationActionVerificationFingerprint(product),
      artifactSha256: product.artifact.sha256,
      inputRawDataHashes: Object.freeze([...product.inputRawDataHashes].sort()),
    });
  });
  return Object.freeze({ sessions: Object.freeze(sessions), products: Object.freeze(products) });
}

function attachmentId(
  occurrenceId, requirementId, dispositionId, completionRecordId,
  evidenceFingerprint, verificationStatusFingerprint,
) {
  return JSON.stringify([
    occurrenceId,
    requirementId,
    dispositionId ?? null,
    completionRecordId ?? null,
    evidenceFingerprint,
    verificationStatusFingerprint,
  ]);
}

export function createVibrationActionVerificationAttachment({
  action, occurrence, requirement, measurementEvidence, disposition = null, completionRecord = null,
} = {}) {
  const normalizedOccurrence = assertVibrationActionOccurrence(occurrence);
  const actionRef = actionReference(action, normalizedOccurrence);
  const normalizedRequirement = requirementForAction(actionRef, normalizedOccurrence, requirement);
  const pkg = assertVibrationMeasurementEvidencePackage(measurementEvidence);
  const verificationStatus = evaluateVibrationVerification({
    requirement: normalizedRequirement,
    measurementEvidence: pkg,
    disposition,
  });
  const normalizedCompletion = completionReference(completionRecord, normalizedOccurrence);
  const evidence = evidenceSnapshot(verificationStatus, pkg);
  assertVibrationActionVerificationStatusIntegrity(verificationStatus, normalizedRequirement, evidence);
  const evidenceFingerprint = vibrationActionVerificationFingerprint(evidence);
  const verificationStatusFingerprint = vibrationActionVerificationFingerprint(verificationStatus);
  const dispositionId = verificationStatus.disposition?.dispositionId ?? null;
  const recordId = normalizedCompletion?.recordId ?? null;
  return deepFreeze({
    schema: VIBRATION_ACTION_VERIFICATION_ATTACHMENT_SCHEMA,
    attachmentId: attachmentId(
      normalizedOccurrence.occurrenceId,
      normalizedRequirement.requirementId,
      dispositionId,
      recordId,
      evidenceFingerprint,
      verificationStatusFingerprint,
    ),
    action: actionRef,
    occurrence: normalizedOccurrence,
    requirement: normalizedRequirement,
    verificationStatus,
    verificationStatusFingerprint,
    evidence,
    evidenceFingerprint,
    completionRecord: normalizedCompletion,
    relation: normalizedCompletion ? 'ACTION_OCCURRENCE_AND_COMPLETION_RECORD' : 'ACTION_OCCURRENCE_ONLY',
    authority: VIBRATION_ACTION_VERIFICATION_AUTHORITY,
  });
}

function assertEvidenceSnapshot(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.sessions) || !Array.isArray(value.products)) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_SNAPSHOT_INVALID', 'Attachment evidence snapshot is invalid.');
  }
  for (const session of value.sessions) {
    text(session.sessionId, 'evidence.sessions[].sessionId');
    if (!SHA256.test(String(session.measurementRecordFingerprint ?? ''))
        || !Array.isArray(session.rawDataHashes) || session.rawDataHashes.some((hash) => !SHA256.test(hash))) {
      throw custodyError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_HASH_INVALID', 'Session provenance/raw-data evidence fingerprints must be canonical sha256 values.');
    }
  }
  for (const product of value.products) {
    text(product.productId, 'evidence.products[].productId');
    text(product.sessionId, 'evidence.products[].sessionId');
    text(product.productType, 'evidence.products[].productType');
    if (!SHA256.test(String(product.measurementRecordFingerprint ?? ''))
        || !SHA256.test(product.artifactSha256) || !Array.isArray(product.inputRawDataHashes)
        || product.inputRawDataHashes.some((hash) => !SHA256.test(hash))) {
      throw custodyError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_HASH_INVALID', 'Signal-product provenance/artifact evidence fingerprints must be canonical sha256 values.');
    }
  }
}

export function assertVibrationActionVerificationAttachment(value) {
  if (value?.schema !== VIBRATION_ACTION_VERIFICATION_ATTACHMENT_SCHEMA) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_SCHEMA_INVALID', `Expected ${VIBRATION_ACTION_VERIFICATION_ATTACHMENT_SCHEMA}.`);
  }
  assertAuthority(value.authority);
  const occurrence = assertVibrationActionOccurrence(value.occurrence);
  const actionRef = actionReference(value.action, occurrence);
  const requirement = requirementForAction(actionRef, occurrence, value.requirement);
  assertEvidenceSnapshot(value.evidence);
  const status = assertVibrationActionVerificationStatusIntegrity(value.verificationStatus, requirement, value.evidence);
  const completion = completionReference(value.completionRecord, occurrence);
  const expectedRelation = completion ? 'ACTION_OCCURRENCE_AND_COMPLETION_RECORD' : 'ACTION_OCCURRENCE_ONLY';
  if (value.relation !== expectedRelation) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_RELATION_INVALID', 'Attachment relation does not match its completion-record custody.');
  }
  const expectedEvidenceFingerprint = vibrationActionVerificationFingerprint(value.evidence);
  if (value.evidenceFingerprint !== expectedEvidenceFingerprint) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_FINGERPRINT_INVALID', 'Evidence fingerprint does not match the attached measurement evidence snapshot.');
  }
  const expectedStatusFingerprint = vibrationActionVerificationFingerprint(status);
  if (value.verificationStatusFingerprint !== expectedStatusFingerprint) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_STATUS_FINGERPRINT_INVALID', 'Verification status fingerprint does not match the attached disposition/status custody.');
  }
  const expectedId = attachmentId(
    occurrence.occurrenceId,
    requirement.requirementId,
    status.disposition?.dispositionId ?? null,
    completion?.recordId ?? null,
    expectedEvidenceFingerprint,
    expectedStatusFingerprint,
  );
  if (value.attachmentId !== expectedId) {
    throw custodyError('VIBRATION_ACTION_VERIFICATION_ID_INVALID', 'Attachment identity does not match its custody fields.');
  }
  return value;
}
