import { createHash } from 'node:crypto';

import { createVibrationMeasurementDisposition } from '../verification/contracts.js';
import {
  VIBRATION_VERIFICATION_STATUS_AUTHORITY,
  VIBRATION_VERIFICATION_STATUS_SCHEMA,
} from '../verification/evaluate.js';

function integrityError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationActionVerificationIntegrityError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function vibrationActionVerificationFingerprint(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

function sameScope(left, right) {
  return left?.lineId === right?.lineId
    && left?.caseId === right?.caseId
    && left?.operatingCaseSnapshotId === right?.operatingCaseSnapshotId
    && left?.operatingCaseSnapshotHash === right?.operatingCaseSnapshotHash;
}

function uniqueSorted(values, field) {
  if (!Array.isArray(values)) throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_EVIDENCE_INVALID', `${field} must be an array.`);
  const normalized = values.map((value) => String(value ?? '').trim());
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_EVIDENCE_INVALID', `${field} must contain unique non-empty values.`);
  }
  return normalized.sort();
}

function sameValues(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function assertStatusAuthority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_VERIFICATION_STATUS_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_AUTHORITY_INVALID', `Verification status authority mismatch at ${key}.`, { key });
    }
  }
}

function evidenceFacts(requirement, evidence) {
  if (!evidence || !Array.isArray(evidence.sessions) || !Array.isArray(evidence.products)) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_EVIDENCE_SNAPSHOT_INVALID', 'Verification evidence snapshot is required.');
  }
  const matchingSessionIds = uniqueSorted(evidence.sessions.map((item) => item.sessionId), 'evidence.sessions[].sessionId');
  const matchingProductIds = uniqueSorted(evidence.products.map((item) => item.productId), 'evidence.products[].productId');
  const productTypes = uniqueSorted([...new Set(evidence.products.map((item) => String(item.productType ?? '').trim()))], 'evidence.products[].productType');
  const missingProductTypes = requirement.requiredProductTypes.filter((type) => !productTypes.includes(type));
  return { matchingSessionIds, matchingProductIds, availableProductTypes: productTypes, missingProductTypes };
}

function assertStatusEvidence(actual, expected) {
  if (!actual || typeof actual !== 'object') {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_EVIDENCE_INVALID', 'Verification status evidence summary is required.');
  }
  const fields = ['matchingSessionIds', 'matchingProductIds', 'availableProductTypes', 'missingProductTypes'];
  for (const field of fields) {
    const actualValues = uniqueSorted(actual[field], `verificationStatus.evidence.${field}`);
    if (!sameValues(actualValues, expected[field])) {
      throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_EVIDENCE_MISMATCH', `Verification status ${field} does not match the attached evidence snapshot.`, { field });
    }
  }
}

function statusFromDisposition(outcome) {
  return {
    EVIDENCE_ACCEPTED_FOR_REQUIREMENT: 'VERIFICATION_EVIDENCE_ACCEPTED',
    EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
    SPECIALIST_REVIEW_REQUIRED: 'SPECIALIST_REVIEW_REQUIRED',
    CORRECTIVE_ACTION_REQUIRED: 'CORRECTIVE_ACTION_REQUIRED',
  }[outcome] ?? null;
}

function initialStatus(evidence) {
  if (evidence.matchingSessionIds.length === 0) return 'EVIDENCE_REQUIRED';
  if (evidence.missingProductTypes.length > 0) return 'EVIDENCE_INCOMPLETE';
  return 'AWAITING_ENGINEER_DISPOSITION';
}

function dispositionResult(status, requirement, evidence, facts) {
  if (status.disposition == null) return { disposition: null, expectedState: initialStatus(facts) };
  const disposition = createVibrationMeasurementDisposition(status.disposition);
  if (stableJson(disposition) !== stableJson(status.disposition)) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_DISPOSITION_NONCANONICAL', 'Verification disposition contains non-canonical or unsupported fields.');
  }
  if (disposition.requirementId !== requirement.requirementId
      || disposition.mechanismId !== requirement.mechanismId
      || !sameScope(disposition.scope, requirement.scope)) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_DISPOSITION_IDENTITY_MISMATCH', 'Verification disposition does not match the attached requirement.');
  }
  const sessionIds = new Set(evidence.sessions.map((item) => item.sessionId));
  const productIds = new Set(evidence.products.map((item) => item.productId));
  if (disposition.evidence.sessionIds.some((id) => !sessionIds.has(id))
      || disposition.evidence.productIds.some((id) => !productIds.has(id))) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_DISPOSITION_EVIDENCE_MISMATCH', 'Verification disposition references evidence outside the attachment snapshot.');
  }
  if (disposition.outcome === 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT') {
    if (facts.missingProductTypes.length > 0) {
      throw integrityError('VIBRATION_ACTION_VERIFICATION_ACCEPTANCE_INCOMPLETE', 'Accepted verification cannot retain missing required product types.');
    }
    const productTypeById = new Map(evidence.products.map((item) => [item.productId, item.productType]));
    const referencedTypes = new Set(disposition.evidence.productIds.map((id) => productTypeById.get(id)).filter(Boolean));
    const missingReferences = requirement.requiredProductTypes.filter((type) => !referencedTypes.has(type));
    if (missingReferences.length > 0) {
      throw integrityError('VIBRATION_ACTION_VERIFICATION_ACCEPTANCE_REFERENCES_INCOMPLETE', 'Accepted verification disposition does not reference every required product type.', { missingProductTypes: missingReferences });
    }
  }
  return { disposition, expectedState: statusFromDisposition(disposition.outcome) };
}

export function assertVibrationActionVerificationStatusIntegrity(status, requirement, evidence) {
  if (status?.schema !== VIBRATION_VERIFICATION_STATUS_SCHEMA) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_INVALID', `Expected ${VIBRATION_VERIFICATION_STATUS_SCHEMA}.`);
  }
  if (status.requirementId !== requirement.requirementId
      || status.mechanismId !== requirement.mechanismId
      || status.requirementType !== requirement.requirementType
      || !sameScope(status.scope, requirement.scope)) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_INVALID', 'Verification status identity does not match the attached requirement.');
  }
  assertStatusAuthority(status.authority);
  const facts = evidenceFacts(requirement, evidence);
  assertStatusEvidence(status.evidence, facts);
  const { disposition, expectedState } = dispositionResult(status, requirement, evidence, facts);
  if (!expectedState || status.state !== expectedState) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_STATE_MISMATCH', 'Verification status state does not match its evidence/disposition custody.', { expectedState, actualState: status.state });
  }
  const canonical = {
    schema: VIBRATION_VERIFICATION_STATUS_SCHEMA,
    requirementId: requirement.requirementId,
    scope: requirement.scope,
    mechanismId: requirement.mechanismId,
    requirementType: requirement.requirementType,
    state: expectedState,
    evidence: facts,
    disposition,
    authority: VIBRATION_VERIFICATION_STATUS_AUTHORITY,
  };
  if (stableJson(status) !== stableJson(canonical)) {
    throw integrityError('VIBRATION_ACTION_VERIFICATION_STATUS_NONCANONICAL', 'Verification status contains unsupported or non-canonical fields.');
  }
  return status;
}
