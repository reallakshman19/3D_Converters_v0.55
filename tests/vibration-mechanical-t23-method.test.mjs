import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MECHANICAL_T23_CONTROLLED_SOURCE,
  MECHANICAL_T23_DIRECT_BASELINE_ROWS,
  MECHANICAL_T23_DYNAMIC_REDUCTION_RULE,
  MECHANICAL_T23_SHARED_SUPPORT_RULE,
  evaluateMechanicalT23DirectBaseline,
} from '../converters/vibration/mechanical/t23-method.js';

const EI_T2_3_TABLE_T2_3_REFERENCE = Object.freeze([
  ['RECIP_PD_COMPRESSOR_OR_PUMP', 0.90],
  ['DIESEL_OR_GAS_ENGINE_DRIVE', 0.80],
  ['SCREW_COMPRESSOR_OR_PUMP', 0.60],
  ['CENTRIFUGAL_PUMP', 0.40],
  ['ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW', 0.40],
  ['ELECTRIC_MOTOR_OR_ALTERNATOR_LT_15KW', 0.20],
  ['CENTRIFUGAL_COMPRESSOR', 0.20],
  ['GAS_TURBINE', 0.20],
  ['FAN_OR_BLOWER', 0.20],
]);

test('controlled T2.3 table matches the independently transcribed nine direct baseline values', () => {
  assert.equal(MECHANICAL_T23_CONTROLLED_SOURCE.sectionId, 'T2.3');
  assert.equal(MECHANICAL_T23_CONTROLLED_SOURCE.tableId, 'T2-3');
  assert.equal(MECHANICAL_T23_CONTROLLED_SOURCE.printedPage, 54);
  assert.deepEqual(
    MECHANICAL_T23_DIRECT_BASELINE_ROWS.map(({ sourceKey, baselineLof }) => [sourceKey, baselineLof]),
    EI_T2_3_TABLE_T2_3_REFERENCE,
  );
});

test('direct T2.3 screening selects the maximum applicable machinery baseline', () => {
  const result = evaluateMechanicalT23DirectBaseline([
    'CENTRIFUGAL_COMPRESSOR',
    'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW',
  ]);
  assert.equal(result.status, 'SCREENING_CALCULATED');
  assert.equal(result.governingLof, 0.40);
  assert.equal(result.governingSourceKey, 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW');
  assert.equal(result.authority.screeningAuthority, 'AUTHORIZED');
  assert.equal(result.authority.authorityScope, 'DIRECT_TABLE_T2_3_BASELINE_ONLY');
  assert.equal(result.authority.designAuthority, false);
});

test('all direct baseline classes remain independently selectable and deterministic', () => {
  for (const [sourceKey, baselineLof] of EI_T2_3_TABLE_T2_3_REFERENCE) {
    const result = evaluateMechanicalT23DirectBaseline([sourceKey]);
    assert.equal(result.governingLof, baselineLof, sourceKey);
  }
});

test('shared-support transfer and dynamic-analysis reductions remain outside screening authority', () => {
  assert.equal(MECHANICAL_T23_SHARED_SUPPORT_RULE.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.reducedLof, 0.40);
  assert.throws(
    () => evaluateMechanicalT23DirectBaseline([MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey]),
    /MECHANICAL_T23_SHARED_SUPPORT_REQUIRES_ADJACENT_LOF/u,
  );
});

test('empty and unknown machinery selections fail closed', () => {
  assert.throws(() => evaluateMechanicalT23DirectBaseline([]), /MECHANICAL_T23_SOURCE_SELECTION_REQUIRED/u);
  assert.throws(() => evaluateMechanicalT23DirectBaseline(['UNKNOWN']), /MECHANICAL_T23_SOURCE_UNKNOWN:UNKNOWN/u);
});
