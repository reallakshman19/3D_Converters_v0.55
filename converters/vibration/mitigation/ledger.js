import {
  assertVibrationMitigationImplementation,
  assertVibrationMitigationProposal,
} from './contracts.js';

export const VIBRATION_MITIGATION_LEDGER_SCHEMA = 'VibrationMitigationLedger.v1';

export const VIBRATION_MITIGATION_LEDGER_AUTHORITY = Object.freeze({
  purpose: 'PROJECT_SCOPED_MITIGATION_SESSION_LEDGER_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  completionAuthority: 'NONE',
  mitigationAuthority: 'CUSTODY_ONLY',
  automaticRecommendation: false,
  predictedBenefitAuthority: 'NONE',
  postModificationVerificationAuthority: 'NONE',
  storageSemantics: 'APPEND_ONLY_SESSION_LEDGER',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  determinesCompletion: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
});

const LEDGER_KEYS = Object.freeze(['schema', 'records', 'authority']);
const PROPOSAL_RECORD_KEYS = Object.freeze(['sequence', 'entryType', 'recordId', 'projectId', 'proposal']);
const IMPLEMENTATION_RECORD_KEYS = Object.freeze(['sequence', 'entryType', 'recordId', 'projectId', 'implementation']);

function ledgerError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationMitigationLedgerError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function text(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw ledgerError('VIBRATION_MITIGATION_LEDGER_TEXT_REQUIRED', `${field} is required.`, { field });
  return normalized;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function exactKeys(value, expectedKeys, code, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw ledgerError(code, `${field} must be an object.`, { field });
  }
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw ledgerError(code, `${field} contains missing or unsupported fields.`, { field, actual, expected });
  }
}

function authority(value) {
  exactKeys(value, Object.keys(VIBRATION_MITIGATION_LEDGER_AUTHORITY), 'VIBRATION_MITIGATION_LEDGER_AUTHORITY_INVALID', 'ledger.authority');
  for (const [key, expected] of Object.entries(VIBRATION_MITIGATION_LEDGER_AUTHORITY)) {
    if (value[key] !== expected) {
      throw ledgerError('VIBRATION_MITIGATION_LEDGER_AUTHORITY_INVALID', `Mitigation ledger authority mismatch at ${key}.`, { key });
    }
  }
}

function entryId(sequence, entryType, projectId, custodyId) {
  return JSON.stringify([sequence, entryType, projectId, custodyId]);
}

function proposalKey(projectId, proposalRecordId) {
  return JSON.stringify([projectId, proposalRecordId]);
}

export function createVibrationMitigationLedger() {
  return deepFreeze({
    schema: VIBRATION_MITIGATION_LEDGER_SCHEMA,
    records: [],
    authority: VIBRATION_MITIGATION_LEDGER_AUTHORITY,
  });
}

export function assertVibrationMitigationLedger(value) {
  exactKeys(value, LEDGER_KEYS, 'VIBRATION_MITIGATION_LEDGER_SCHEMA_INVALID', 'ledger');
  if (value.schema !== VIBRATION_MITIGATION_LEDGER_SCHEMA || !Array.isArray(value.records)) {
    throw ledgerError('VIBRATION_MITIGATION_LEDGER_SCHEMA_INVALID', `Expected ${VIBRATION_MITIGATION_LEDGER_SCHEMA}.`);
  }
  authority(value.authority);
  const proposals = new Map();
  const implemented = new Set();
  value.records.forEach((record, index) => {
    const sequence = index + 1;
    const projectId = text(record?.projectId, 'record.projectId');
    if (record?.sequence !== sequence) {
      throw ledgerError('VIBRATION_MITIGATION_LEDGER_SEQUENCE_INVALID', 'Mitigation ledger records must be globally contiguous.');
    }
    if (record.entryType === 'PROPOSAL') {
      exactKeys(record, PROPOSAL_RECORD_KEYS, 'VIBRATION_MITIGATION_LEDGER_RECORD_SHAPE_INVALID', 'proposal record');
      const proposal = assertVibrationMitigationProposal(record.proposal);
      if (proposal.projectId !== projectId) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_PROJECT_MISMATCH', 'Mitigation proposal project does not match ledger record scope.');
      }
      const key = proposalKey(projectId, proposal.proposalRecordId);
      if (proposals.has(key)) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_DUPLICATE_PROPOSAL', 'The same mitigation proposal cannot be appended twice.');
      }
      if (record.recordId !== entryId(sequence, 'PROPOSAL', projectId, proposal.proposalRecordId)) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_RECORD_ID_INVALID', 'Mitigation proposal ledger identity mismatch.');
      }
      proposals.set(key, proposal);
      return;
    }
    if (record.entryType === 'IMPLEMENTATION') {
      exactKeys(record, IMPLEMENTATION_RECORD_KEYS, 'VIBRATION_MITIGATION_LEDGER_RECORD_SHAPE_INVALID', 'implementation record');
      const implementation = assertVibrationMitigationImplementation(record.implementation);
      if (implementation.projectId !== projectId) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_PROJECT_MISMATCH', 'Mitigation implementation project does not match ledger record scope.');
      }
      const key = proposalKey(projectId, implementation.proposalRecordId);
      const proposal = proposals.get(key);
      if (!proposal || proposal.proposalFingerprint !== implementation.proposalFingerprint) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_PROPOSAL_REQUIRED', 'Implementation can only follow its exact proposal in the same ledger.');
      }
      if (implemented.has(key)) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_DUPLICATE_IMPLEMENTATION', 'A mitigation proposal can have only one implementation attestation in this foundation contract.');
      }
      if (record.recordId !== entryId(sequence, 'IMPLEMENTATION', projectId, implementation.implementationRecordId)) {
        throw ledgerError('VIBRATION_MITIGATION_LEDGER_RECORD_ID_INVALID', 'Mitigation implementation ledger identity mismatch.');
      }
      implemented.add(key);
      return;
    }
    throw ledgerError('VIBRATION_MITIGATION_LEDGER_ENTRY_TYPE_INVALID', 'Mitigation ledger entryType must be PROPOSAL or IMPLEMENTATION.');
  });
  return value;
}

export function appendVibrationMitigationProposal(ledgerInput, proposalInput) {
  const ledger = assertVibrationMitigationLedger(ledgerInput);
  const proposal = assertVibrationMitigationProposal(proposalInput);
  const key = proposalKey(proposal.projectId, proposal.proposalRecordId);
  if (ledger.records.some((record) => record.entryType === 'PROPOSAL'
      && proposalKey(record.projectId, record.proposal.proposalRecordId) === key)) {
    throw ledgerError('VIBRATION_MITIGATION_LEDGER_DUPLICATE_PROPOSAL', 'The same mitigation proposal cannot be appended twice.');
  }
  const sequence = ledger.records.length + 1;
  const record = deepFreeze({
    sequence,
    entryType: 'PROPOSAL',
    recordId: entryId(sequence, 'PROPOSAL', proposal.projectId, proposal.proposalRecordId),
    projectId: proposal.projectId,
    proposal,
  });
  return deepFreeze({
    schema: VIBRATION_MITIGATION_LEDGER_SCHEMA,
    records: [...ledger.records, record],
    authority: VIBRATION_MITIGATION_LEDGER_AUTHORITY,
  });
}

export function appendVibrationMitigationImplementation(ledgerInput, implementationInput) {
  const ledger = assertVibrationMitigationLedger(ledgerInput);
  const implementation = assertVibrationMitigationImplementation(implementationInput);
  const key = proposalKey(implementation.projectId, implementation.proposalRecordId);
  const proposalRecord = ledger.records.find((record) => record.entryType === 'PROPOSAL'
    && proposalKey(record.projectId, record.proposal.proposalRecordId) === key);
  if (!proposalRecord || proposalRecord.proposal.proposalFingerprint !== implementation.proposalFingerprint) {
    throw ledgerError('VIBRATION_MITIGATION_LEDGER_PROPOSAL_REQUIRED', 'Implementation can only follow its exact proposal in the same ledger.');
  }
  if (ledger.records.some((record) => record.entryType === 'IMPLEMENTATION'
      && proposalKey(record.projectId, record.implementation.proposalRecordId) === key)) {
    throw ledgerError('VIBRATION_MITIGATION_LEDGER_DUPLICATE_IMPLEMENTATION', 'A mitigation proposal can have only one implementation attestation in this foundation contract.');
  }
  const sequence = ledger.records.length + 1;
  const record = deepFreeze({
    sequence,
    entryType: 'IMPLEMENTATION',
    recordId: entryId(sequence, 'IMPLEMENTATION', implementation.projectId, implementation.implementationRecordId),
    projectId: implementation.projectId,
    implementation,
  });
  return deepFreeze({
    schema: VIBRATION_MITIGATION_LEDGER_SCHEMA,
    records: [...ledger.records, record],
    authority: VIBRATION_MITIGATION_LEDGER_AUTHORITY,
  });
}
