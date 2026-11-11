import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY,
  createVibrationAssessmentEvidenceLedger,
  createVibrationAssessmentEvidenceReceipt,
  createVibrationAssessmentEvidenceReceiptFromItem,
} from '../converters/vibration/project/assessment-evidence.js';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const scope = Object.freeze({ line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' });

function basis(overrides = {}) {
  return {
    methodId: 'VIB.FIT.T2.2', methodRevision: '1', qualificationRevision: 'QUAL-1',
    methodDefinitionHash: HASH_A, engineeringInputsHash: HASH_B, sourceBasisHash: HASH_C,
    ...overrides,
  };
}

function authoritySnapshot(overrides = {}) {
  return {
    qualificationEffective: 'SCREENING', engineeringAuthority: 'SCREENING', screeningAuthority: 'AUTHORIZED',
    designAuthority: false, rootCauseAuthority: false, codeCompliance: false, ...overrides,
  };
}

function receipt(overrides = {}) {
  return {
    receiptId: 'R-1', assessmentItemId: 'ITEM-1', mechanismId: 'fit', scope,
    calculatedAt: '2026-08-19T10:00:00Z', basis: basis(), resultStateAtCalculation: 'CURRENT_RESULT',
    resultPayload: { lof: 0.42, band: 'LOW' }, authorityAtCalculation: authoritySnapshot(), ...overrides,
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('receipt preserves calculation evidence but remains non-authorizing', () => {
  const value = createVibrationAssessmentEvidenceReceipt(receipt());
  assert.equal(value.resultPayload.lof, 0.42);
  assert.equal(value.authority, VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY);
  assert.equal(value.authority.createsCurrentEngineeringResult, false);
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(value.authorityAtCalculation.screeningAuthority, 'AUTHORIZED');
});

test('receipt rejects forged receipt authority and unsupported authority snapshot', () => {
  expectCode(() => createVibrationAssessmentEvidenceReceipt(receipt({
    authority: { ...VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY, screeningAuthority: 'AUTHORIZED' },
  })), 'VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_INVALID');
  expectCode(() => createVibrationAssessmentEvidenceReceipt(receipt({
    authorityAtCalculation: authoritySnapshot({ designAuthority: true }),
  })), 'VIBRATION_ASSESSMENT_EVIDENCE_AUTHORITY_SNAPSHOT_UNSUPPORTED');
});

test('basis requires canonical method input and source hashes', () => {
  expectCode(() => createVibrationAssessmentEvidenceReceipt(receipt({
    basis: basis({ engineeringInputsHash: 'bad-hash' }),
  })), 'VIBRATION_ASSESSMENT_EVIDENCE_HASH_REQUIRED');
});

test('receipt only represents a result that was current at calculation time', () => {
  expectCode(() => createVibrationAssessmentEvidenceReceipt(receipt({ resultStateAtCalculation: 'STALE_RESULT' })),
    'VIBRATION_ASSESSMENT_EVIDENCE_RESULT_NOT_CURRENT');
});

test('result payload must remain JSON-safe', () => {
  expectCode(() => createVibrationAssessmentEvidenceReceipt(receipt({ resultPayload: { lof: Number.NaN } })),
    'VIBRATION_ASSESSMENT_EVIDENCE_PAYLOAD_INVALID');
});

test('factory derives exact identity and result from current mechanism assessment item', () => {
  const item = {
    schema: 'VibrationMechanismAssessmentItem.v1', itemId: 'ITEM-1', mechanismId: 'fit', scope,
    resultState: 'CURRENT_RESULT', result: { lof: 0.7 },
  };
  const value = createVibrationAssessmentEvidenceReceiptFromItem({
    receiptId: 'R-ITEM', item, basis: basis(), calculatedAt: '2026-08-19T10:00:00Z', authorityAtCalculation: authoritySnapshot(),
  });
  assert.equal(value.assessmentItemId, 'ITEM-1');
  assert.equal(value.resultPayload.lof, 0.7);
});

test('factory rejects stale mechanism assessment item', () => {
  const item = {
    schema: 'VibrationMechanismAssessmentItem.v1', itemId: 'ITEM-1', mechanismId: 'fit', scope,
    resultState: 'STALE_RESULT', result: { lof: 0.7 },
  };
  expectCode(() => createVibrationAssessmentEvidenceReceiptFromItem({
    receiptId: 'R-ITEM', item, basis: basis(), calculatedAt: '2026-08-19T10:00:00Z', authorityAtCalculation: authoritySnapshot(),
  }), 'VIBRATION_ASSESSMENT_EVIDENCE_RESULT_NOT_CURRENT');
});

test('ledger preserves history but rejects duplicate receipt identity', () => {
  const ledger = createVibrationAssessmentEvidenceLedger({ receipts: [receipt(), receipt({ receiptId: 'R-2' })] });
  assert.equal(ledger.receipts.length, 2);
  expectCode(() => createVibrationAssessmentEvidenceLedger({ receipts: [receipt(), receipt()] }),
    'VIBRATION_ASSESSMENT_EVIDENCE_DUPLICATE_RECEIPT_ID');
});
