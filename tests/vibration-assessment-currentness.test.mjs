import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY,
  evaluateVibrationAssessmentEvidenceCurrentness,
  evaluateVibrationAssessmentEvidenceLedgerCurrentness,
} from '../converters/vibration/project/assessment-currentness.js';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;

function basis(overrides = {}) {
  return {
    methodId: 'VIB.FIT.T2.2', methodRevision: '1', qualificationRevision: 'QUAL-1',
    methodDefinitionHash: HASH_A, engineeringInputsHash: HASH_B, sourceBasisHash: HASH_C, ...overrides,
  };
}

function receipt(id = 'R-1', itemId = 'ITEM-1', overrides = {}) {
  return {
    receiptId: id, assessmentItemId: itemId, mechanismId: 'fit',
    scope: { line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' },
    calculatedAt: '2026-08-19T10:00:00Z', basis: basis(), resultStateAtCalculation: 'CURRENT_RESULT',
    resultPayload: { lof: 0.42 },
    authorityAtCalculation: {
      qualificationEffective: 'SCREENING', engineeringAuthority: 'SCREENING', screeningAuthority: 'AUTHORIZED',
      designAuthority: false, rootCauseAuthority: false, codeCompliance: false,
    },
    ...overrides,
  };
}

test('exact basis parity produces evidence-current freshness without current-result authority', () => {
  const value = evaluateVibrationAssessmentEvidenceCurrentness({ receipt: receipt(), currentBasis: basis() });
  assert.equal(value.state, 'EVIDENCE_CURRENT');
  assert.deepEqual(value.reasons, []);
  assert.equal(value.authority, VIBRATION_ASSESSMENT_EVIDENCE_CURRENTNESS_AUTHORITY);
  assert.equal(value.authority.createsCurrentEngineeringResult, false);
  assert.equal(value.authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('missing current basis fails closed as basis unavailable', () => {
  const value = evaluateVibrationAssessmentEvidenceCurrentness({ receipt: receipt(), currentBasis: null });
  assert.equal(value.state, 'BASIS_UNAVAILABLE');
  assert.deepEqual(value.reasons, ['CURRENT_BASIS_UNAVAILABLE']);
});

test('method and qualification revision changes mark evidence stale', () => {
  const value = evaluateVibrationAssessmentEvidenceCurrentness({
    receipt: receipt(), currentBasis: basis({ methodRevision: '2', qualificationRevision: 'QUAL-2' }),
  });
  assert.equal(value.state, 'STALE_EVIDENCE');
  assert.deepEqual(value.reasons, ['METHOD_REVISION_CHANGED', 'QUALIFICATION_REVISION_CHANGED']);
});

test('method definition, engineering inputs and source basis changes are individually visible', () => {
  const value = evaluateVibrationAssessmentEvidenceCurrentness({
    receipt: receipt(), currentBasis: basis({
      methodDefinitionHash: HASH_D, engineeringInputsHash: HASH_D, sourceBasisHash: HASH_D,
    }),
  });
  assert.equal(value.state, 'STALE_EVIDENCE');
  assert.deepEqual(value.reasons, ['METHOD_DEFINITION_CHANGED', 'ENGINEERING_INPUTS_CHANGED', 'SOURCE_BASIS_CHANGED']);
});

test('method identity change is stale rather than silently treated as another basis', () => {
  const value = evaluateVibrationAssessmentEvidenceCurrentness({
    receipt: receipt(), currentBasis: basis({ methodId: 'VIB.FIT.OTHER' }),
  });
  assert.equal(value.state, 'STALE_EVIDENCE');
  assert.deepEqual(value.reasons, ['METHOD_ID_CHANGED']);
});

test('ledger evaluates receipt history independently and counts freshness states', () => {
  const ledger = { receipts: [receipt('R-1', 'ITEM-1'), receipt('R-2', 'ITEM-2'), receipt('R-3', 'ITEM-3')] };
  const value = evaluateVibrationAssessmentEvidenceLedgerCurrentness({
    ledger,
    currentBasisByAssessmentItemId: {
      'ITEM-1': basis(),
      'ITEM-2': basis({ engineeringInputsHash: HASH_D }),
    },
  });
  assert.equal(value.receiptCount, 3);
  assert.equal(value.countsByState.EVIDENCE_CURRENT, 1);
  assert.equal(value.countsByState.STALE_EVIDENCE, 1);
  assert.equal(value.countsByState.BASIS_UNAVAILABLE, 1);
  assert.equal(value.authority.promotesReceiptAuthority, false);
});
