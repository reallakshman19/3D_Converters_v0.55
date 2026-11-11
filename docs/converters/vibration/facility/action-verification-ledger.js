import { assertVibrationActionVerificationAttachment } from './action-verification.js';

export const VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA = 'VibrationActionVerificationLedger.v1';

export const VIBRATION_ACTION_VERIFICATION_LEDGER_AUTHORITY = Object.freeze({
  purpose: 'ACTION_VERIFICATION_SESSION_LEDGER_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  storageSemantics: 'APPEND_ONLY_SESSION_LEDGER',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  rootCauseAuthority: false,
});

function ledgerError(code, message) {
  const error = new Error(message);
  error.name = 'VibrationActionVerificationLedgerError';
  error.code = code;
  return error;
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_TEXT_REQUIRED', `${field} is required.`);
  return text;
}

function timestamp(value) {
  const text = String(value ?? '').trim();
  if (!text || Number.isNaN(Date.parse(text))) {
    throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_TIME_INVALID', 'recordedAt must be an ISO-compatible timestamp.');
  }
  return text;
}

function authority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_ACTION_VERIFICATION_LEDGER_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_AUTHORITY_INVALID', `Ledger authority mismatch at ${key}.`);
    }
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function entryId(sequence, projectId, attachmentId) {
  return JSON.stringify([sequence, projectId, attachmentId]);
}

function attachmentKey(projectId, attachmentId) {
  return JSON.stringify([projectId, attachmentId]);
}

export function createVibrationActionVerificationLedger() {
  return deepFreeze({
    schema: VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA,
    records: [],
    authority: VIBRATION_ACTION_VERIFICATION_LEDGER_AUTHORITY,
  });
}

export function assertVibrationActionVerificationLedger(value) {
  if (value?.schema !== VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA || !Array.isArray(value.records)) {
    throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA_INVALID', `Expected ${VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA}.`);
  }
  authority(value.authority);
  const attachmentKeys = new Set();
  value.records.forEach((record, index) => {
    const sequence = index + 1;
    const projectId = requiredText(record?.projectId, 'record.projectId');
    const attachment = assertVibrationActionVerificationAttachment(record?.attachment);
    if (record.sequence !== sequence || record.recordId !== entryId(sequence, projectId, attachment.attachmentId)) {
      throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_SEQUENCE_INVALID', 'Verification ledger records must be contiguous and deterministic.');
    }
    timestamp(record.recordedAt);
    const key = attachmentKey(projectId, attachment.attachmentId);
    if (attachmentKeys.has(key)) {
      throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_DUPLICATE', 'The same project verification attachment cannot be appended twice.');
    }
    attachmentKeys.add(key);
  });
  return value;
}

export function appendVibrationActionVerificationAttachment(ledgerInput, projectIdInput, attachmentInput, recordedAt) {
  const ledger = assertVibrationActionVerificationLedger(ledgerInput);
  const projectId = requiredText(projectIdInput, 'projectId');
  const attachment = assertVibrationActionVerificationAttachment(attachmentInput);
  const key = attachmentKey(projectId, attachment.attachmentId);
  if (ledger.records.some((record) => attachmentKey(record.projectId, record.attachment.attachmentId) === key)) {
    throw ledgerError('VIBRATION_ACTION_VERIFICATION_LEDGER_DUPLICATE', 'The same project verification attachment cannot be appended twice.');
  }
  const sequence = ledger.records.length + 1;
  const record = deepFreeze({
    sequence,
    recordId: entryId(sequence, projectId, attachment.attachmentId),
    projectId,
    recordedAt: timestamp(recordedAt),
    attachment,
  });
  return deepFreeze({
    schema: VIBRATION_ACTION_VERIFICATION_LEDGER_SCHEMA,
    records: [...ledger.records, record],
    authority: VIBRATION_ACTION_VERIFICATION_LEDGER_AUTHORITY,
  });
}
