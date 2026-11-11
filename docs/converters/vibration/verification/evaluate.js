import { assertVibrationMeasurementEvidencePackage } from '../measurement/contracts.js';
import {
  createVibrationMeasurementDisposition,
  createVibrationVerificationError,
  createVibrationVerificationRequirement,
} from './contracts.js';

export const VIBRATION_VERIFICATION_STATUS_SCHEMA = 'VibrationVerificationStatus.v1';
export const VIBRATION_VERIFICATION_STATUS_AUTHORITY = Object.freeze({
  authority: 'FIELD_VERIFICATION_STATUS_PROJECTION_ONLY',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

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

function evidenceForScope(requirement, pkg) {
  const sessions = pkg.sessions.filter((session) => sameScope(requirement.scope, session.scope));
  const sessionIds = new Set(sessions.map((session) => session.sessionId));
  const products = pkg.products.filter((product) => sessionIds.has(product.sessionId));
  const availableProductTypes = [...new Set(products.map((product) => product.productType))].sort();
  const missingProductTypes = requirement.requiredProductTypes.filter((type) => !availableProductTypes.includes(type));
  return {
    matchingSessionIds: sessions.map((session) => session.sessionId).sort(),
    matchingProductIds: products.map((product) => product.productId).sort(),
    availableProductTypes,
    missingProductTypes,
  };
}

function referenceIndexes(pkg) {
  return {
    sessions: new Map(pkg.sessions.map((session) => [session.sessionId, session])),
    products: new Map(pkg.products.map((product) => [product.productId, product])),
  };
}

function assertDispositionIdentity(requirement, disposition) {
  if (disposition.requirementId !== requirement.requirementId || disposition.mechanismId !== requirement.mechanismId) {
    throw createVibrationVerificationError(
      'VIBRATION_VERIFICATION_DISPOSITION_IDENTITY_MISMATCH',
      'Disposition must reference the same verification requirement and mechanism.',
    );
  }
  if (!sameScope(disposition.scope, requirement.scope)) {
    throw createVibrationVerificationError(
      'VIBRATION_VERIFICATION_DISPOSITION_SCOPE_MISMATCH',
      'Disposition scope must exactly match the verification requirement scope.',
    );
  }
}

function assertDispositionEvidenceScope(requirement, disposition, pkg) {
  const indexes = referenceIndexes(pkg);
  for (const sessionId of disposition.evidence.sessionIds) {
    const session = indexes.sessions.get(sessionId);
    if (!session) {
      throw createVibrationVerificationError('VIBRATION_VERIFICATION_DANGLING_SESSION', 'Disposition references an unknown measurement session.', { sessionId });
    }
    if (!sameScope(requirement.scope, session.scope)) {
      throw createVibrationVerificationError('VIBRATION_VERIFICATION_WRONG_SCOPE_EVIDENCE', 'Disposition references measurement evidence from another operating scope.', { sessionId });
    }
  }
  for (const productId of disposition.evidence.productIds) {
    const product = indexes.products.get(productId);
    if (!product) {
      throw createVibrationVerificationError('VIBRATION_VERIFICATION_DANGLING_PRODUCT', 'Disposition references an unknown signal product.', { productId });
    }
    const session = indexes.sessions.get(product.sessionId);
    if (!session || !sameScope(requirement.scope, session.scope)) {
      throw createVibrationVerificationError('VIBRATION_VERIFICATION_WRONG_SCOPE_EVIDENCE', 'Disposition references a signal product from another operating scope.', { productId });
    }
  }
}


function dispositionProductTypes(disposition, pkg) {
  const products = new Map(pkg.products.map((product) => [product.productId, product]));
  return [...new Set(disposition.evidence.productIds.map((productId) => products.get(productId)?.productType).filter(Boolean))];
}

function assertAcceptanceCoverage(requirement, disposition, pkg, evidence) {
  if (evidence.missingProductTypes.length > 0) {
    throw createVibrationVerificationError(
      'VIBRATION_VERIFICATION_ACCEPTANCE_WITH_INCOMPLETE_EVIDENCE',
      'Verification evidence cannot be accepted while required signal products are missing.',
      { missingProductTypes: evidence.missingProductTypes },
    );
  }
  const referencedTypes = dispositionProductTypes(disposition, pkg);
  const missingReferences = requirement.requiredProductTypes.filter((type) => !referencedTypes.includes(type));
  if (missingReferences.length > 0) {
    throw createVibrationVerificationError(
      'VIBRATION_VERIFICATION_ACCEPTANCE_REFERENCES_INCOMPLETE',
      'Accepted disposition must explicitly reference signal products covering every required product type.',
      { missingProductTypes: missingReferences },
    );
  }
}

function statusFromDisposition(disposition) {
  return {
    EVIDENCE_ACCEPTED_FOR_REQUIREMENT: 'VERIFICATION_EVIDENCE_ACCEPTED',
    EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
    SPECIALIST_REVIEW_REQUIRED: 'SPECIALIST_REVIEW_REQUIRED',
    CORRECTIVE_ACTION_REQUIRED: 'CORRECTIVE_ACTION_REQUIRED',
  }[disposition.outcome];
}

function initialStatus(evidence) {
  if (evidence.matchingSessionIds.length === 0) return 'EVIDENCE_REQUIRED';
  if (evidence.missingProductTypes.length > 0) return 'EVIDENCE_INCOMPLETE';
  return 'AWAITING_ENGINEER_DISPOSITION';
}

export function evaluateVibrationVerification({ requirement, measurementEvidence, disposition = null } = {}) {
  const normalizedRequirement = createVibrationVerificationRequirement(requirement);
  const pkg = assertVibrationMeasurementEvidencePackage(measurementEvidence);
  const evidence = evidenceForScope(normalizedRequirement, pkg);
  let normalizedDisposition = null;
  let state = initialStatus(evidence);

  if (disposition != null) {
    normalizedDisposition = createVibrationMeasurementDisposition(disposition);
    assertDispositionIdentity(normalizedRequirement, normalizedDisposition);
    assertDispositionEvidenceScope(normalizedRequirement, normalizedDisposition, pkg);
    if (normalizedDisposition.outcome === 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT') {
      assertAcceptanceCoverage(normalizedRequirement, normalizedDisposition, pkg, evidence);
    }
    state = statusFromDisposition(normalizedDisposition);
  }

  return deepFreeze({
    schema: VIBRATION_VERIFICATION_STATUS_SCHEMA,
    requirementId: normalizedRequirement.requirementId,
    scope: normalizedRequirement.scope,
    mechanismId: normalizedRequirement.mechanismId,
    requirementType: normalizedRequirement.requirementType,
    state,
    evidence,
    disposition: normalizedDisposition,
    authority: VIBRATION_VERIFICATION_STATUS_AUTHORITY,
  });
}
