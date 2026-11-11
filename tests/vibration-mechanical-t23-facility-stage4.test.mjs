import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MECHANICAL_T23_SOURCE_OPTIONS,
  evaluateMechanicalFacilityCandidate,
  inspectMechanicalFacilityCandidate,
  mechanicalFacilityScopeId,
} from '../converters/vibration/mechanical/facility.js';

function row(overrides = {}) {
  return {
    line: '14-GAS-1001', caseId: 'NORMAL', canonicalId: 'CAN-K402',
    ...overrides,
  };
}

test('D2.4 facility screening reproduces governing Mechanical LOF 0.4', async () => {
  const result = await evaluateMechanicalFacilityCandidate(row(), [
    'CENTRIFUGAL_COMPRESSOR',
    'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW',
  ]);
  assert.equal(result.schema, 'MechanicalFacilityScreeningResult.v1');
  assert.equal(result.status, 'CALCULATED_SCREENING');
  assert.equal(result.governingLof, 0.4);
  assert.equal(result.governingSourceKey, 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW');
  assert.deepEqual(result.rows.map((item) => item.baselineLof), [0.2, 0.4]);
  assert.equal(result.authority.engineeringAuthority, 'SCREENING');
  assert.equal(result.authority.screeningAuthority, 'AUTHORIZED');
  assert.equal(result.authority.authorityScope, 'DIRECT_TABLE_T2_3_BASELINE_ONLY');
  assert.equal(result.authority.dynamicReductionAuthorized, false);
  assert.equal(result.authority.sharedSupportTransferAuthorized, false);
  assert.equal(result.authority.designAuthority, false);
});

test('facility scope is deterministic, encoded and screening inspection is exact-scope only', async () => {
  const target = row({ line: 'L/100', caseId: 'START UP', canonicalId: 'CAN|1' });
  assert.equal(
    mechanicalFacilityScopeId(target),
    'MECHANICAL-FACILITY/L%2F100/START%20UP/CAN%7C1',
  );
  const screening = await evaluateMechanicalFacilityCandidate(target, ['CENTRIFUGAL_PUMP']);
  assert.equal(inspectMechanicalFacilityCandidate(target, screening).ok, true);
  const other = row({ line: 'L/101', caseId: 'START UP', canonicalId: 'CAN|1' });
  const inspected = inspectMechanicalFacilityCandidate(other, screening);
  assert.equal(inspected.ok, false);
  assert.equal(inspected.status, 'FACILITY_SCOPE_MISMATCH');
});

test('source selection is exact, de-duplicated and empty/unknown selections fail closed', async () => {
  const duplicate = await evaluateMechanicalFacilityCandidate(row(), [
    'CENTRIFUGAL_PUMP', 'CENTRIFUGAL_PUMP',
  ]);
  assert.deepEqual(duplicate.sourceKeys, ['CENTRIFUGAL_PUMP']);
  await assert.rejects(
    () => evaluateMechanicalFacilityCandidate(row(), []),
    /MECHANICAL_T23_SOURCE_SELECTION_REQUIRED/u,
  );
  await assert.rejects(
    () => evaluateMechanicalFacilityCandidate(row(), ['NOT_A_SOURCE']),
    /MECHANICAL_T23_SOURCE_UNKNOWN/u,
  );
});

test('shared-support transfer remains blocked from qualified direct baseline screening', async () => {
  const shared = MECHANICAL_T23_SOURCE_OPTIONS.find((item) => !item.directBaselineAvailable);
  assert.equal(shared.sourceKey, 'PIPEWORK_SHARING_SUPPORTS_WITH_LINE_LOF_GE_0_50');
  assert.equal(shared.baselineLof, null);
  assert.equal(shared.screeningAuthorized, false);
  await assert.rejects(
    () => evaluateMechanicalFacilityCandidate(row(), [shared.sourceKey]),
    /MECHANICAL_T23_SHARED_SUPPORT_REQUIRES_ADJACENT_LOF/u,
  );
});
