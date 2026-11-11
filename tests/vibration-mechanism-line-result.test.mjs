import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_MECHANISM_LINE_RESULT_SCHEMA,
  VIBRATION_MECHANISM_NUMERIC_RESULT_SCHEMA,
} from '../converters/vibration/mechanisms/result-contracts.js';
import {
  VIBRATION_MECHANISM_REDUCER_REGISTRY,
  reduceVibrationMechanismAssessmentSetToLineResult,
} from '../converters/vibration/mechanisms/reducers.js';

const SCOPE = Object.freeze({ line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1' });

function item(mechanismId, index, lof, overrides = {}) {
  return {
    schema: 'VibrationMechanismAssessmentItem.v1',
    itemId: `${mechanismId}-item-${index}`,
    mechanismId,
    scope: { ...SCOPE },
    child: { key: `child-${index}`, ordinal: index - 1 },
    implementationState: 'IMPLEMENTED_SCREENING',
    assessmentState: 'CALCULATED',
    resultState: 'CURRENT_RESULT',
    result: { calculated: true, governingLof: lof },
    qualification: { effective: 'SCREENING' },
    ...overrides,
  };
}

function set(mechanismId, items) {
  return {
    schema: 'VibrationMechanismAssessmentSet.v1',
    setId: `${mechanismId}-set`,
    mechanismId,
    scope: { ...SCOPE },
    cardinality: { count: items.length, kind: items.length === 0 ? 'ZERO' : items.length === 1 ? 'ONE' : 'MANY' },
    items,
  };
}

test('VIB-REDUCE-001: one current Screening assessment unit reduces by identity only', () => {
  const result = reduceVibrationMechanismAssessmentSetToLineResult(set('fit', [item('fit', 1, 0.34)]));
  assert.equal(result.schema, VIBRATION_MECHANISM_LINE_RESULT_SCHEMA);
  assert.equal(result.state, 'CURRENT_RESULT');
  assert.equal(result.governingLof, 0.34);
  assert.equal(result.aggregationEligible, true);
  assert.equal(result.reduction.ruleId, 'IDENTITY_SINGLE_ASSESSMENT_UNIT');
  assert.equal(result.reduction.qualification, 'STRUCTURAL_IDENTITY_ONLY');
  assert.equal(result.numericResults[0].schema, VIBRATION_MECHANISM_NUMERIC_RESULT_SCHEMA);
  assert.deepEqual(result.sourceItemIds, ['fit-item-1']);
});

test('VIB-REDUCE-002: stale unit remains visible evidence but cannot become a current line result', () => {
  const stale = item('fit', 1, 0.34, { resultState: 'STALE_RESULT' });
  const result = reduceVibrationMechanismAssessmentSetToLineResult(set('fit', [stale]));
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.governingLof, null);
  assert.equal(result.aggregationEligible, false);
  assert.equal(result.numericResults[0].observedGoverningLof, 0.34);
  assert.ok(result.reasons.some((reason) => reason.startsWith('CURRENT_SCREENING_RESULT_REQUIRED:')));
});

test('VIB-REDUCE-003: candidate qualification cannot be promoted by the reducer', () => {
  const candidate = item('mechanicalExcitation', 1, 0.9, {
    implementationState: 'IMPLEMENTED_CANDIDATE_MASTER',
    qualification: { effective: 'CANDIDATE_MASTER' },
  });
  const result = reduceVibrationMechanismAssessmentSetToLineResult(set('mechanicalExcitation', [candidate]));
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.governingLof, null);
  assert.ok(result.reasons.some((reason) => reason.startsWith('SCREENING_QUALIFICATION_REQUIRED:')));
});

test('VIB-REDUCE-004: invalid assessment-unit LOF fails closed', () => {
  for (const lof of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -0.1]) {
    const result = reduceVibrationMechanismAssessmentSetToLineResult(set('fit', [item('fit', 1, lof)]));
    assert.equal(result.state, 'INCOMPLETE');
    assert.equal(result.governingLof, null);
    assert.ok(result.reasons.some((reason) => reason.startsWith('VALID_GOVERNING_LOF_REQUIRED:')));
  }
});

test('VIB-REDUCE-005: MANY AIV pairs do not acquire an implicit max reducer', () => {
  const result = reduceVibrationMechanismAssessmentSetToLineResult(set('aiv', [
    item('aiv', 1, 0.21), item('aiv', 2, 0.63), item('aiv', 3, 0.47),
  ]));
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.governingLof, null);
  assert.equal(result.aggregationEligible, false);
  assert.equal(result.reduction.inputCardinality, 'MANY');
  assert.equal(result.reduction.ruleId, null);
  assert.ok(result.reasons.includes('MULTI_ITEM_REDUCTION_UNQUALIFIED:aiv'));
  assert.deepEqual(result.numericResults.map((entry) => entry.observedGoverningLof), [0.21, 0.63, 0.47]);
});

test('VIB-REDUCE-006: ZERO assessment units remain incomplete, not not-applicable', () => {
  const result = reduceVibrationMechanismAssessmentSetToLineResult(set('fit', []));
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.governingLof, null);
  assert.ok(result.reasons.includes('NO_ASSESSMENT_UNIT_RESULT'));
});

test('VIB-REDUCE-007: reducer registry declares no universal multi-item engineering rule', () => {
  assert.equal(VIBRATION_MECHANISM_REDUCER_REGISTRY.authority.universalMultiItemReducer, false);
  assert.equal(VIBRATION_MECHANISM_REDUCER_REGISTRY.authority.multiItemReductionQualified, false);
  assert.ok(VIBRATION_MECHANISM_REDUCER_REGISTRY.entries.every((entry) => entry.multiItemRule === null));
});

test('VIB-REDUCE-008: malformed scope/mechanism evidence fails instead of being repaired', () => {
  const wrong = item('fit', 1, 0.34, { mechanismId: 'aiv' });
  assert.throws(
    () => reduceVibrationMechanismAssessmentSetToLineResult(set('fit', [wrong])),
    /MECHANISM_REDUCER_ASSESSMENT_SCOPE_MISMATCH/u,
  );
  assert.throws(
    () => reduceVibrationMechanismAssessmentSetToLineResult(set('unknownMechanism', [])),
    /UNKNOWN_VIBRATION_MECHANISM_REDUCER/u,
  );
});
