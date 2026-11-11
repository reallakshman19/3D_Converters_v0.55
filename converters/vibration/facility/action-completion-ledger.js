import {
  VIBRATION_ACTION_COMPLETION_AUTHORITY,
  assertVibrationActionCompletionRecord,
} from './action-completion.js';

export const VIBRATION_ACTION_COMPLETION_LEDGER_SCHEMA = 'VibrationActionCompletionLedger.v1';

function ledgerError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationActionCompletionLedgerError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertAuthority(value) {
  for (const [key, expected] of Object.entries(VIBRATION_ACTION_COMPLETION_AUTHORITY)) {
    if (value?.[key] !== expected) {
      throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_AUTHORITY_INVALID', `Completion ledger authority mismatch at ${key}.`);
    }
  }
}

export function createVibrationActionCompletionLedger() {
  return deepFreeze({
    schema: VIBRATION_ACTION_COMPLETION_LEDGER_SCHEMA,
    records: [],
    authority: VIBRATION_ACTION_COMPLETION_AUTHORITY,
  });
}

export function assertVibrationActionCompletionLedger(value) {
  if (value?.schema !== VIBRATION_ACTION_COMPLETION_LEDGER_SCHEMA || !Array.isArray(value.records)) {
    throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_INVALID', `Expected ${VIBRATION_ACTION_COMPLETION_LEDGER_SCHEMA}.`);
  }
  assertAuthority(value.authority);
  const recordIds = new Set();
  const byOccurrence = new Map();
  for (const input of value.records) {
    const record = assertVibrationActionCompletionRecord(input);
    if (recordIds.has(record.recordId)) {
      throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_DUPLICATE_RECORD', 'Completion ledger contains a duplicate record.', { recordId: record.recordId });
    }
    recordIds.add(record.recordId);
    const history = byOccurrence.get(record.occurrenceId) ?? [];
    history.push(record);
    byOccurrence.set(record.occurrenceId, history);
  }
  for (const history of byOccurrence.values()) {
    history.sort((left, right) => left.sequence - right.sequence);
    let expectedTransition = 'COMPLETE';
    for (let index = 0; index < history.length; index += 1) {
      const record = history[index];
      if (record.sequence !== index + 1) {
        throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_SEQUENCE_GAP', 'Completion ledger sequence must be contiguous per action occurrence.');
      }
      if (record.transition !== expectedTransition) {
        throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_ILLEGAL_TRANSITION', `Expected ${expectedTransition} at sequence ${record.sequence}.`);
      }
      expectedTransition = expectedTransition === 'COMPLETE' ? 'REOPEN' : 'COMPLETE';
    }
  }
  return value;
}

export function appendVibrationActionCompletionRecord(ledgerInput, recordInput) {
  const ledger = assertVibrationActionCompletionLedger(ledgerInput);
  const record = assertVibrationActionCompletionRecord(recordInput);
  const sameOccurrence = ledger.records.filter((item) => item.occurrenceId === record.occurrenceId);
  const expectedSequence = sameOccurrence.length + 1;
  if (record.sequence !== expectedSequence) {
    throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_SEQUENCE_GAP', `Expected sequence ${expectedSequence}.`);
  }
  const expectedTransition = expectedSequence % 2 === 1 ? 'COMPLETE' : 'REOPEN';
  if (record.transition !== expectedTransition) {
    throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_ILLEGAL_TRANSITION', `Expected ${expectedTransition} at sequence ${expectedSequence}.`);
  }
  if (ledger.records.some((item) => item.recordId === record.recordId)) {
    throw ledgerError('VIBRATION_ACTION_COMPLETION_LEDGER_DUPLICATE_RECORD', 'Completion record is already present.', { recordId: record.recordId });
  }
  return deepFreeze({
    schema: VIBRATION_ACTION_COMPLETION_LEDGER_SCHEMA,
    records: [...ledger.records, record],
    authority: VIBRATION_ACTION_COMPLETION_AUTHORITY,
  });
}
