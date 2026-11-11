import { createHash } from 'node:crypto';

import { assertVibrationActionOccurrence } from '../facility/action-completion.js';
import { VIBRATION_REQUIRED_ACTION_SCHEMA } from '../facility/action-lifecycle.js';
import { assertVibrationActionVerificationLedger } from '../facility/action-verification-ledger.js';
import { assertVibrationRcaLedger } from '../rca/ledger.js';

export const VIBRATION_MITIGATION_PROPOSAL_SCHEMA = 'VibrationMitigationProposal.v1';
export const VIBRATION_MITIGATION_IMPLEMENTATION_SCHEMA = 'VibrationMitigationImplementation.v1';

export const VIBRATION_MITIGATION_PROPOSAL_AUTHORITY = Object.freeze({
  purpose: 'ENGINEER_AUTHORED_MITIGATION_PROPOSAL_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  mitigationAuthority: 'EXPLICIT_ENGINEER_PROPOSAL_ONLY',
  automaticRecommendation: false,
  predictedBenefitAuthority: 'NONE',
  rootCauseAuthority: 'NONE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
  codeCompliance: false,
  safetyAuthority: false,
});

export const VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY = Object.freeze({
  purpose: 'CALLER_ATTESTED_MITIGATION_IMPLEMENTATION_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  mitigationAuthority: 'CALLER_IMPLEMENTATION_ATTESTATION_ONLY',
  automaticRecommendation: false,
  predictedBenefitAuthority: 'NONE',
  rootCauseAuthority: 'NONE',
  postModificationVerificationAuthority: 'NONE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256 = /^sha256:[0-9a-f]{64}$/u;
const ACTION_KEYS = Object.freeze(['schema', 'actionId', 'mechanismId', 'scope']);
const ACTION_SCOPE_KEYS = Object.freeze(['line', 'caseId', 'canonicalId']);
const BASIS_KEYS = Object.freeze(['verificationRecords', 'rcaRecords', 'evidenceRefs']);
const VERIFICATION_SNAPSHOT_KEYS = Object.freeze([
  'recordId', 'attachmentId', 'requirementId', 'verificationState',
  'verificationStatusFingerprint', 'evidenceFingerprint',
]);
const RCA_SNAPSHOT_KEYS = Object.freeze([
  'recordId', 'hypothesisRecordId', 'hypothesisId', 'hypothesisFingerprint', 'state', 'conclusionOutcome',
]);
const PROPOSAL_KEYS = Object.freeze([
  'schema', 'proposalRecordId', 'proposalFingerprint', 'projectId', 'action', 'occurrence',
  'proposalId', 'engineerId', 'proposedAt', 'proposalText', 'rationale', 'basis', 'authority',
]);
const IMPLEMENTATION_KEYS = Object.freeze([
  'schema', 'implementationRecordId', 'implementationFingerprint', 'proposal',
  'proposalRecordId', 'proposalFingerprint', 'projectId', 'actionId', 'mechanismId', 'occurrenceId',
  'implementationId', 'implementedBy', 'implementedAt', 'implementationStatement', 'evidence', 'authority',
]);

function mitigationError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationMitigationCustodyError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw mitigationError('VIBRATION_MITIGATION_TEXT_REQUIRED', `${field} is required.`, { field });
  return normalized;
}

function isoTime(value, field) {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw mitigationError('VIBRATION_MITIGATION_TIME_INVALID', `${field} must be an ISO-compatible timestamp.`, { field });
  }
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

function assertExactKeys(value, expectedKeys, code, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw mitigationError(code, `${field} must be an object.`, { field });
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (stableJson(actual) !== stableJson(expected)) {
    throw mitigationError(code, `${field} contains missing or unsupported fields.`, { field, actual, expected });
  }
}

function assertAuthority(value, expected, code) {
  assertExactKeys(value, Object.keys(expected), code, 'authority');
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) {
      throw mitigationError(code, `Mitigation authority mismatch at ${key}.`, { key });
    }
  }
}

function actionReference(action, occurrence) {
  if (action?.schema !== VIBRATION_REQUIRED_ACTION_SCHEMA) {
    throw mitigationError('VIBRATION_MITIGATION_ACTION_SCHEMA_INVALID', `action.schema must be ${VIBRATION_REQUIRED_ACTION_SCHEMA}.`);
  }
  const actionId = text(action.actionId, 'action.actionId');
  const mechanismId = text(action.mechanismId, 'action.mechanismId');
  const scope = Object.freeze({
    line: text(action.scope?.line, 'action.scope.line'),
    caseId: text(action.scope?.caseId, 'action.scope.caseId'),
    canonicalId: text(action.scope?.canonicalId, 'action.scope.canonicalId'),
  });
  if (actionId !== occurrence.actionId) {
    throw mitigationError('VIBRATION_MITIGATION_ACTION_OCCURRENCE_MISMATCH', 'Mitigation action does not match the exact action occurrence.');
  }
  const scenario = occurrence.scenarioExecutionBasis;
  if (scope.line !== scenario.line || scope.caseId !== scenario.caseId) {
    throw mitigationError('VIBRATION_MITIGATION_ACTION_SCOPE_MISMATCH', 'Mitigation action scope does not match the occurrence scenario.');
  }
  return Object.freeze({ schema: VIBRATION_REQUIRED_ACTION_SCHEMA, actionId, mechanismId, scope });
}

function assertCanonicalActionSnapshot(value, canonical) {
  assertExactKeys(value, ACTION_KEYS, 'VIBRATION_MITIGATION_ACTION_SHAPE_INVALID', 'proposal.action');
  assertExactKeys(value.scope, ACTION_SCOPE_KEYS, 'VIBRATION_MITIGATION_ACTION_SCOPE_SHAPE_INVALID', 'proposal.action.scope');
  if (stableJson(value) !== stableJson(canonical)) {
    throw mitigationError('VIBRATION_MITIGATION_ACTION_SHAPE_INVALID', 'Stored mitigation action snapshot is not canonical.');
  }
}

function uniqueIds(values, field) {
  if (!Array.isArray(values)) throw mitigationError('VIBRATION_MITIGATION_REFERENCE_ARRAY_INVALID', `${field} must be an array.`, { field });
  const ids = values.map((value, index) => text(value, `${field}[${index}]`));
  if (new Set(ids).size !== ids.length) {
    throw mitigationError('VIBRATION_MITIGATION_REFERENCE_DUPLICATE', `${field} must contain unique references.`, { field });
  }
  return ids;
}

function verificationBasis(projectId, occurrence, action, ledgerInput, recordIdsInput) {
  const recordIds = uniqueIds(recordIdsInput, 'verificationRecordIds');
  if (!recordIds.length) return Object.freeze([]);
  const ledger = assertVibrationActionVerificationLedger(ledgerInput);
  const index = new Map(ledger.records.map((record) => [record.recordId, record]));
  return Object.freeze(recordIds.map((recordId) => {
    const record = index.get(recordId);
    if (!record
        || record.projectId !== projectId
        || record.attachment.occurrence.occurrenceId !== occurrence.occurrenceId
        || record.attachment.action.actionId !== action.actionId
        || record.attachment.action.mechanismId !== action.mechanismId) {
      throw mitigationError(
        'VIBRATION_MITIGATION_VERIFICATION_REFERENCE_FOREIGN',
        'Selected verification record does not belong to the exact project/action occurrence/mechanism.',
        { recordId },
      );
    }
    return Object.freeze({
      recordId,
      attachmentId: record.attachment.attachmentId,
      requirementId: record.attachment.requirement.requirementId,
      verificationState: record.attachment.verificationStatus.state,
      verificationStatusFingerprint: record.attachment.verificationStatusFingerprint,
      evidenceFingerprint: record.attachment.evidenceFingerprint,
    });
  }));
}

function rcaBasis(projectId, occurrence, action, ledgerInput, recordIdsInput) {
  const recordIds = uniqueIds(recordIdsInput, 'rcaRecordIds');
  if (!recordIds.length) return Object.freeze([]);
  const ledger = assertVibrationRcaLedger(ledgerInput);
  const index = new Map(ledger.records.map((record) => [record.recordId, record]));
  return Object.freeze(recordIds.map((recordId) => {
    const record = index.get(recordId);
    const hypothesis = record?.hypothesis;
    if (!record
        || record.projectId !== projectId
        || hypothesis.occurrence.occurrenceId !== occurrence.occurrenceId
        || hypothesis.actionId !== action.actionId
        || hypothesis.mechanismId !== action.mechanismId) {
      throw mitigationError(
        'VIBRATION_MITIGATION_RCA_REFERENCE_FOREIGN',
        'Selected RCA record does not belong to the exact project/action occurrence/mechanism.',
        { recordId },
      );
    }
    return Object.freeze({
      recordId,
      hypothesisRecordId: hypothesis.hypothesisRecordId,
      hypothesisId: hypothesis.hypothesisId,
      hypothesisFingerprint: hypothesis.hypothesisFingerprint,
      state: hypothesis.state,
      conclusionOutcome: hypothesis.conclusion?.outcome ?? null,
    });
  }));
}

function evidenceRefs(values) {
  return Object.freeze(uniqueIds(values, 'evidenceRefs'));
}

function assertVerificationSnapshots(values) {
  if (!Array.isArray(values)) throw mitigationError('VIBRATION_MITIGATION_VERIFICATION_SNAPSHOT_INVALID', 'basis.verificationRecords must be an array.');
  const ids = new Set();
  for (const item of values) {
    assertExactKeys(item, VERIFICATION_SNAPSHOT_KEYS, 'VIBRATION_MITIGATION_VERIFICATION_SNAPSHOT_INVALID', 'basis.verificationRecords[]');
    const recordId = text(item.recordId, 'basis.verificationRecords[].recordId');
    if (ids.has(recordId)) throw mitigationError('VIBRATION_MITIGATION_REFERENCE_DUPLICATE', 'Verification snapshot record IDs must be unique.');
    ids.add(recordId);
    text(item.attachmentId, 'basis.verificationRecords[].attachmentId');
    text(item.requirementId, 'basis.verificationRecords[].requirementId');
    text(item.verificationState, 'basis.verificationRecords[].verificationState');
    if (!SHA256.test(String(item.verificationStatusFingerprint ?? '')) || !SHA256.test(String(item.evidenceFingerprint ?? ''))) {
      throw mitigationError('VIBRATION_MITIGATION_VERIFICATION_FINGERPRINT_INVALID', 'Verification basis fingerprints must be canonical sha256 values.');
    }
  }
  return values;
}

function assertRcaSnapshots(values) {
  if (!Array.isArray(values)) throw mitigationError('VIBRATION_MITIGATION_RCA_SNAPSHOT_INVALID', 'basis.rcaRecords must be an array.');
  const ids = new Set();
  for (const item of values) {
    assertExactKeys(item, RCA_SNAPSHOT_KEYS, 'VIBRATION_MITIGATION_RCA_SNAPSHOT_INVALID', 'basis.rcaRecords[]');
    const recordId = text(item.recordId, 'basis.rcaRecords[].recordId');
    if (ids.has(recordId)) throw mitigationError('VIBRATION_MITIGATION_REFERENCE_DUPLICATE', 'RCA snapshot record IDs must be unique.');
    ids.add(recordId);
    text(item.hypothesisRecordId, 'basis.rcaRecords[].hypothesisRecordId');
    text(item.hypothesisId, 'basis.rcaRecords[].hypothesisId');
    text(item.state, 'basis.rcaRecords[].state');
    if (item.conclusionOutcome != null) text(item.conclusionOutcome, 'basis.rcaRecords[].conclusionOutcome');
    if (!SHA256.test(String(item.hypothesisFingerprint ?? ''))) {
      throw mitigationError('VIBRATION_MITIGATION_RCA_FINGERPRINT_INVALID', 'RCA basis fingerprints must be canonical sha256 values.');
    }
  }
  return values;
}

function proposalPayload({ projectId, action, occurrence, proposalId, engineerId, proposedAt, proposalText, rationale, basis }) {
  return { projectId, action, occurrence, proposalId, engineerId, proposedAt, proposalText, rationale, basis };
}

function proposalRecordId(projectId, occurrenceId, proposalId, proposalFingerprint) {
  return JSON.stringify([projectId, occurrenceId, proposalId, proposalFingerprint]);
}

export function createVibrationMitigationProposal({
  projectId: projectInput,
  action: actionInput,
  occurrence: occurrenceInput,
  proposalId: proposalInput,
  engineerId: engineerInput,
  proposedAt: proposedAtInput,
  proposalText: proposalTextInput,
  rationale: rationaleInput,
  verificationLedger = null,
  verificationRecordIds = [],
  rcaLedger = null,
  rcaRecordIds = [],
  evidenceRefs: evidenceInput = [],
} = {}) {
  const projectId = text(projectInput, 'projectId');
  const occurrence = assertVibrationActionOccurrence(occurrenceInput);
  const action = actionReference(actionInput, occurrence);
  const proposalId = text(proposalInput, 'proposalId');
  const engineerId = text(engineerInput, 'engineerId');
  const proposedAt = isoTime(proposedAtInput, 'proposedAt');
  const proposalText = text(proposalTextInput, 'proposalText');
  const rationale = text(rationaleInput, 'rationale');
  const basis = deepFreeze({
    verificationRecords: verificationBasis(projectId, occurrence, action, verificationLedger, verificationRecordIds),
    rcaRecords: rcaBasis(projectId, occurrence, action, rcaLedger, rcaRecordIds),
    evidenceRefs: evidenceRefs(evidenceInput),
  });
  const payload = proposalPayload({ projectId, action, occurrence, proposalId, engineerId, proposedAt, proposalText, rationale, basis });
  const proposalFingerprint = sha256(payload);
  return deepFreeze({
    schema: VIBRATION_MITIGATION_PROPOSAL_SCHEMA,
    proposalRecordId: proposalRecordId(projectId, occurrence.occurrenceId, proposalId, proposalFingerprint),
    proposalFingerprint,
    ...payload,
    authority: VIBRATION_MITIGATION_PROPOSAL_AUTHORITY,
  });
}

export function assertVibrationMitigationProposal(value) {
  if (value?.schema !== VIBRATION_MITIGATION_PROPOSAL_SCHEMA) {
    throw mitigationError('VIBRATION_MITIGATION_PROPOSAL_SCHEMA_INVALID', `Expected ${VIBRATION_MITIGATION_PROPOSAL_SCHEMA}.`);
  }
  assertExactKeys(value, PROPOSAL_KEYS, 'VIBRATION_MITIGATION_PROPOSAL_SHAPE_INVALID', 'proposal');
  assertAuthority(value.authority, VIBRATION_MITIGATION_PROPOSAL_AUTHORITY, 'VIBRATION_MITIGATION_PROPOSAL_AUTHORITY_INVALID');
  const projectId = text(value.projectId, 'proposal.projectId');
  const occurrence = assertVibrationActionOccurrence(value.occurrence);
  const action = actionReference(value.action, occurrence);
  assertCanonicalActionSnapshot(value.action, action);
  const proposalId = text(value.proposalId, 'proposal.proposalId');
  const engineerId = text(value.engineerId, 'proposal.engineerId');
  const proposedAt = isoTime(value.proposedAt, 'proposal.proposedAt');
  const proposalText = text(value.proposalText, 'proposal.proposalText');
  const rationale = text(value.rationale, 'proposal.rationale');
  assertExactKeys(value.basis, BASIS_KEYS, 'VIBRATION_MITIGATION_BASIS_INVALID', 'proposal.basis');
  const basis = {
    verificationRecords: assertVerificationSnapshots(value.basis.verificationRecords),
    rcaRecords: assertRcaSnapshots(value.basis.rcaRecords),
    evidenceRefs: evidenceRefs(value.basis.evidenceRefs),
  };
  const expectedFingerprint = sha256(proposalPayload({ projectId, action, occurrence, proposalId, engineerId, proposedAt, proposalText, rationale, basis }));
  if (value.proposalFingerprint !== expectedFingerprint
      || value.proposalRecordId !== proposalRecordId(projectId, occurrence.occurrenceId, proposalId, expectedFingerprint)) {
    throw mitigationError('VIBRATION_MITIGATION_PROPOSAL_FINGERPRINT_INVALID', 'Mitigation proposal identity does not match its custody fields.');
  }
  return value;
}

function implementationPayload({ proposal, implementationId, implementedBy, implementedAt, implementationStatement, evidence }) {
  return {
    proposalRecordId: proposal.proposalRecordId,
    proposalFingerprint: proposal.proposalFingerprint,
    projectId: proposal.projectId,
    actionId: proposal.action.actionId,
    mechanismId: proposal.action.mechanismId,
    occurrenceId: proposal.occurrence.occurrenceId,
    implementationId,
    implementedBy,
    implementedAt,
    implementationStatement,
    evidence,
  };
}

function implementationRecordId(proposalRecordIdValue, implementationId, implementationFingerprint) {
  return JSON.stringify([proposalRecordIdValue, implementationId, implementationFingerprint]);
}

export function createVibrationMitigationImplementation({
  proposal: proposalInput,
  implementationId: implementationInput,
  implementedBy: implementedByInput,
  implementedAt: implementedAtInput,
  implementationStatement: statementInput,
  evidenceRefs: evidenceInput = [],
} = {}) {
  const proposal = assertVibrationMitigationProposal(proposalInput);
  const implementationId = text(implementationInput, 'implementationId');
  const implementedBy = text(implementedByInput, 'implementedBy');
  const implementedAt = isoTime(implementedAtInput, 'implementedAt');
  const implementationStatement = text(statementInput, 'implementationStatement');
  const evidence = evidenceRefs(evidenceInput);
  if (!evidence.length) {
    throw mitigationError('VIBRATION_MITIGATION_IMPLEMENTATION_EVIDENCE_REQUIRED', 'Implementation attestation requires at least one evidence reference.');
  }
  const payload = implementationPayload({ proposal, implementationId, implementedBy, implementedAt, implementationStatement, evidence });
  const implementationFingerprint = sha256(payload);
  return deepFreeze({
    schema: VIBRATION_MITIGATION_IMPLEMENTATION_SCHEMA,
    implementationRecordId: implementationRecordId(proposal.proposalRecordId, implementationId, implementationFingerprint),
    implementationFingerprint,
    proposal,
    ...payload,
    authority: VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY,
  });
}

export function assertVibrationMitigationImplementation(value) {
  if (value?.schema !== VIBRATION_MITIGATION_IMPLEMENTATION_SCHEMA) {
    throw mitigationError('VIBRATION_MITIGATION_IMPLEMENTATION_SCHEMA_INVALID', `Expected ${VIBRATION_MITIGATION_IMPLEMENTATION_SCHEMA}.`);
  }
  assertExactKeys(value, IMPLEMENTATION_KEYS, 'VIBRATION_MITIGATION_IMPLEMENTATION_SHAPE_INVALID', 'implementation');
  assertAuthority(value.authority, VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY, 'VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY_INVALID');
  const proposal = assertVibrationMitigationProposal(value.proposal);
  const implementationId = text(value.implementationId, 'implementation.implementationId');
  const implementedBy = text(value.implementedBy, 'implementation.implementedBy');
  const implementedAt = isoTime(value.implementedAt, 'implementation.implementedAt');
  const implementationStatement = text(value.implementationStatement, 'implementation.implementationStatement');
  const evidence = evidenceRefs(value.evidence);
  if (!evidence.length) {
    throw mitigationError('VIBRATION_MITIGATION_IMPLEMENTATION_EVIDENCE_REQUIRED', 'Implementation attestation requires at least one evidence reference.');
  }
  const expected = implementationPayload({ proposal, implementationId, implementedBy, implementedAt, implementationStatement, evidence });
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (stableJson(value[key]) !== stableJson(expectedValue)) {
      throw mitigationError('VIBRATION_MITIGATION_IMPLEMENTATION_BINDING_INVALID', `Implementation custody mismatch at ${key}.`, { key });
    }
  }
  const expectedFingerprint = sha256(expected);
  if (value.implementationFingerprint !== expectedFingerprint
      || value.implementationRecordId !== implementationRecordId(proposal.proposalRecordId, implementationId, expectedFingerprint)) {
    throw mitigationError('VIBRATION_MITIGATION_IMPLEMENTATION_FINGERPRINT_INVALID', 'Mitigation implementation identity does not match its custody fields.');
  }
  return value;
}
