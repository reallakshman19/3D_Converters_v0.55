import { createHash } from 'node:crypto';

import { assertVibrationActionOccurrence } from '../facility/action-completion.js';
import { assertVibrationActionVerificationLedger } from '../facility/action-verification-ledger.js';

export const VIBRATION_RCA_HYPOTHESIS_SCHEMA = 'VibrationRcaHypothesis.v1';
export const VIBRATION_RCA_CONCLUSION_SCHEMA = 'VibrationRcaEngineerConclusion.v1';

export const VIBRATION_RCA_CONCLUSION_OUTCOMES = Object.freeze([
  'CONFIRMED_ROOT_CAUSE',
  'CONTRIBUTING_FACTOR',
  'NOT_SUPPORTED',
  'INCONCLUSIVE',
]);

export const VIBRATION_RCA_AUTHORITY = Object.freeze({
  purpose: 'EVIDENCE_LINKED_ENGINEER_RCA_CUSTODY_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  rootCauseAuthority: 'EXPLICIT_ENGINEER_ATTESTATION_ONLY',
  platformRootCauseInference: false,
  autoConfirmAllowed: false,
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256 = /^sha256:[0-9a-f]{64}$/u;

function rcaError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationRcaError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw rcaError('VIBRATION_RCA_TEXT_REQUIRED', `${field} is required.`, { field });
  return normalized;
}

function isoTime(value, field) {
  const normalized = text(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw rcaError('VIBRATION_RCA_TIME_INVALID', `${field} must be an ISO-compatible timestamp.`, { field });
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

function authority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_RCA_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw rcaError('VIBRATION_RCA_AUTHORITY_INVALID', `RCA authority mismatch at ${key}.`, { key });
    }
  }
}

function uniqueIds(value, field) {
  if (!Array.isArray(value)) throw rcaError('VIBRATION_RCA_EVIDENCE_ARRAY_INVALID', `${field} must be an array.`);
  const ids = value.map((item, index) => text(item, `${field}[${index}]`));
  if (new Set(ids).size !== ids.length) {
    throw rcaError('VIBRATION_RCA_EVIDENCE_DUPLICATE', `${field} must contain unique record IDs.`);
  }
  return ids;
}

function verificationIndex(ledgerInput, projectId, occurrenceId) {
  const ledger = assertVibrationActionVerificationLedger(ledgerInput);
  const records = ledger.records.filter((record) => record.projectId === projectId
    && record.attachment.occurrence.occurrenceId === occurrenceId);
  return new Map(records.map((record) => [record.recordId, record]));
}

function snapshotEvidence(index, forIds, againstIds) {
  const all = [...forIds, ...againstIds];
  if (!all.length) {
    throw rcaError('VIBRATION_RCA_EVIDENCE_REQUIRED', 'An RCA hypothesis requires at least one governed verification record.');
  }
  const overlap = forIds.filter((id) => againstIds.includes(id));
  if (overlap.length) {
    throw rcaError('VIBRATION_RCA_EVIDENCE_CONFLICT', 'The same verification record cannot be evidence both for and against a hypothesis.', { overlap });
  }
  return Object.freeze(all.map((recordId) => {
    const record = index.get(recordId);
    if (!record) throw rcaError('VIBRATION_RCA_EVIDENCE_FOREIGN', 'Selected verification evidence does not belong to the exact project/action occurrence.', { recordId });
    const attachment = record.attachment;
    return Object.freeze({
      recordId,
      direction: forIds.includes(recordId) ? 'FOR' : 'AGAINST',
      attachmentId: attachment.attachmentId,
      requirementId: attachment.requirement.requirementId,
      verificationState: attachment.verificationStatus.state,
      verificationStatusFingerprint: attachment.verificationStatusFingerprint,
      evidenceFingerprint: attachment.evidenceFingerprint,
    });
  }));
}

function conclusionValue(input, evidence) {
  if (input == null) return null;
  if (input?.schema != null && input.schema !== VIBRATION_RCA_CONCLUSION_SCHEMA) {
    throw rcaError('VIBRATION_RCA_CONCLUSION_SCHEMA_INVALID', `Expected ${VIBRATION_RCA_CONCLUSION_SCHEMA}.`);
  }
  if (input.authority != null) authority(input.authority);
  const outcome = text(input.outcome, 'conclusion.outcome');
  if (!VIBRATION_RCA_CONCLUSION_OUTCOMES.includes(outcome)) {
    throw rcaError('VIBRATION_RCA_CONCLUSION_OUTCOME_INVALID', 'Unsupported engineer RCA conclusion outcome.', { outcome });
  }
  const evidenceFor = evidence.filter((item) => item.direction === 'FOR');
  const evidenceAgainst = evidence.filter((item) => item.direction === 'AGAINST');
  if (['CONFIRMED_ROOT_CAUSE', 'CONTRIBUTING_FACTOR'].includes(outcome) && evidenceFor.length === 0) {
    throw rcaError('VIBRATION_RCA_SUPPORTING_EVIDENCE_REQUIRED', `${outcome} requires explicit supporting verification evidence.`);
  }
  if (outcome === 'CONFIRMED_ROOT_CAUSE'
      && !evidenceFor.some((item) => item.verificationState === 'VERIFICATION_EVIDENCE_ACCEPTED')) {
    throw rcaError('VIBRATION_RCA_ACCEPTED_EVIDENCE_REQUIRED', 'CONFIRMED_ROOT_CAUSE requires at least one accepted supporting verification record.');
  }
  if (outcome === 'NOT_SUPPORTED' && evidenceAgainst.length === 0) {
    throw rcaError('VIBRATION_RCA_CONTRARY_EVIDENCE_REQUIRED', 'NOT_SUPPORTED requires explicit evidence against the hypothesis.');
  }
  return Object.freeze({
    schema: VIBRATION_RCA_CONCLUSION_SCHEMA,
    outcome,
    engineerId: text(input.engineerId, 'conclusion.engineerId'),
    recordedAt: isoTime(input.recordedAt, 'conclusion.recordedAt'),
    reason: text(input.reason, 'conclusion.reason'),
    authority: VIBRATION_RCA_AUTHORITY,
  });
}

function recordIdentity(projectId, occurrenceId, hypothesisId, fingerprint) {
  return JSON.stringify([projectId, occurrenceId, hypothesisId, fingerprint]);
}

function fingerprintPayload({ projectId, occurrence, hypothesisId, mechanismId, statement, evidence, conclusion }) {
  return { projectId, occurrenceId: occurrence.occurrenceId, hypothesisId, mechanismId, statement, evidence, conclusion };
}

export function createVibrationRcaHypothesis({
  projectId: projectInput,
  occurrence: occurrenceInput,
  mechanismId: mechanismInput,
  verificationLedger,
  hypothesisId: hypothesisInput,
  statement: statementInput,
  evidenceForRecordIds = [],
  evidenceAgainstRecordIds = [],
  conclusion = null,
} = {}) {
  const projectId = text(projectInput, 'projectId');
  const occurrence = assertVibrationActionOccurrence(occurrenceInput);
  const hypothesisId = text(hypothesisInput, 'hypothesisId');
  const mechanismId = text(mechanismInput, 'mechanismId');
  const statement = text(statementInput, 'statement');
  const forIds = uniqueIds(evidenceForRecordIds, 'evidenceForRecordIds');
  const againstIds = uniqueIds(evidenceAgainstRecordIds, 'evidenceAgainstRecordIds');
  const index = verificationIndex(verificationLedger, projectId, occurrence.occurrenceId);
  const evidence = snapshotEvidence(index, forIds, againstIds);
  for (const item of evidence) {
    const record = index.get(item.recordId);
    if (record.attachment.action.actionId !== occurrence.actionId
        || record.attachment.action.mechanismId !== mechanismId) {
      throw rcaError('VIBRATION_RCA_ACTION_MISMATCH', 'Verification evidence does not match the RCA action/mechanism custody.');
    }
  }
  const engineerConclusion = conclusionValue(conclusion, evidence);
  const payload = fingerprintPayload({ projectId, occurrence, hypothesisId, mechanismId, statement, evidence, conclusion: engineerConclusion });
  const hypothesisFingerprint = sha256(payload);
  return deepFreeze({
    schema: VIBRATION_RCA_HYPOTHESIS_SCHEMA,
    hypothesisRecordId: recordIdentity(projectId, occurrence.occurrenceId, hypothesisId, hypothesisFingerprint),
    hypothesisFingerprint,
    projectId,
    hypothesisId,
    actionId: occurrence.actionId,
    mechanismId,
    occurrence,
    statement,
    evidence,
    conclusion: engineerConclusion,
    state: engineerConclusion ? 'ENGINEER_CONCLUSION_RECORDED' : 'HYPOTHESIS_OPEN',
    authority: VIBRATION_RCA_AUTHORITY,
  });
}

export function assertVibrationRcaHypothesis(value) {
  if (value?.schema !== VIBRATION_RCA_HYPOTHESIS_SCHEMA) {
    throw rcaError('VIBRATION_RCA_HYPOTHESIS_SCHEMA_INVALID', `Expected ${VIBRATION_RCA_HYPOTHESIS_SCHEMA}.`);
  }
  authority(value.authority);
  const projectId = text(value.projectId, 'hypothesis.projectId');
  const occurrence = assertVibrationActionOccurrence(value.occurrence);
  const hypothesisId = text(value.hypothesisId, 'hypothesis.hypothesisId');
  const mechanismId = text(value.mechanismId, 'hypothesis.mechanismId');
  const statement = text(value.statement, 'hypothesis.statement');
  if (value.actionId !== occurrence.actionId) {
    throw rcaError('VIBRATION_RCA_ACTION_MISMATCH', 'RCA hypothesis action does not match its occurrence.');
  }
  if (!Array.isArray(value.evidence) || value.evidence.length === 0) {
    throw rcaError('VIBRATION_RCA_EVIDENCE_REQUIRED', 'RCA evidence snapshot is required.');
  }
  const ids = new Set();
  for (const item of value.evidence) {
    const recordId = text(item.recordId, 'hypothesis.evidence[].recordId');
    if (ids.has(recordId) || !['FOR', 'AGAINST'].includes(item.direction)) {
      throw rcaError('VIBRATION_RCA_EVIDENCE_SNAPSHOT_INVALID', 'RCA evidence snapshot contains duplicate or invalid evidence rows.');
    }
    ids.add(recordId);
    text(item.attachmentId, 'hypothesis.evidence[].attachmentId');
    text(item.requirementId, 'hypothesis.evidence[].requirementId');
    text(item.verificationState, 'hypothesis.evidence[].verificationState');
    if (!SHA256.test(String(item.evidenceFingerprint ?? ''))) {
      throw rcaError('VIBRATION_RCA_EVIDENCE_FINGERPRINT_INVALID', 'RCA evidence fingerprints must be canonical sha256 values.');
    }
    if (!SHA256.test(String(item.verificationStatusFingerprint ?? ''))) {
      throw rcaError('VIBRATION_RCA_VERIFICATION_STATUS_FINGERPRINT_INVALID', 'RCA verification-status fingerprints must be canonical sha256 values.');
    }
  }
  const conclusion = conclusionValue(value.conclusion, value.evidence);
  const expectedState = conclusion ? 'ENGINEER_CONCLUSION_RECORDED' : 'HYPOTHESIS_OPEN';
  if (value.state !== expectedState) throw rcaError('VIBRATION_RCA_STATE_INVALID', 'RCA hypothesis state does not match its explicit engineer conclusion.');
  const expectedFingerprint = sha256(fingerprintPayload({
    projectId, occurrence, hypothesisId, mechanismId, statement, evidence: value.evidence, conclusion,
  }));
  if (value.hypothesisFingerprint !== expectedFingerprint
      || value.hypothesisRecordId !== recordIdentity(projectId, occurrence.occurrenceId, hypothesisId, expectedFingerprint)) {
    throw rcaError('VIBRATION_RCA_HYPOTHESIS_FINGERPRINT_INVALID', 'RCA hypothesis identity does not match its evidence/conclusion custody.');
  }
  return value;
}
