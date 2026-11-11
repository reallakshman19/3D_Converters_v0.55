import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_MECHANISM_CAPABILITY_SCHEMA,
  listVibrationMechanismCapabilities,
  resolveVibrationMechanismCapability,
} from '../converters/vibration/mechanisms/capability.js';
import { VIBRATION_MECHANISM_IDS } from '../converters/vibration/mechanisms/registry.js';

test('capability projection covers the governed mechanism universe in registry order', () => {
  const capabilities = listVibrationMechanismCapabilities();
  assert.deepEqual(capabilities.map((item) => item.mechanismId), VIBRATION_MECHANISM_IDS);
  assert.ok(capabilities.every((item) => item.schema === VIBRATION_MECHANISM_CAPABILITY_SCHEMA));
});

test('AIV is integrated at assessment scope while line governing remains runtime-controlled', () => {
  const capability = resolveVibrationMechanismCapability('aiv');
  assert.equal(capability.eitModuleCode, 'aiv');
  assert.equal(capability.calculationId, 'VIB.AIV.ACOUSTIC');
  assert.equal(capability.calculationRegistered, true);
  assert.equal(capability.calculationAvailable, true);
  assert.equal(capability.calculationState, 'IMPLEMENTED');
  assert.equal(capability.qualificationState, 'SCREENING');
  assert.equal(capability.assessmentIntegrationState, 'INTEGRATED_ASSESSMENT_SCOPE');
  assert.equal(capability.integrityImplementationState, 'SCREENING_ASSESSMENT_SCOPE');
  assert.equal(capability.governingEligibilitySource, 'RUNTIME_ASSESSMENT_ONLY');
});

test('FIT remains integrated while calculator qualification is projected from the central registry', () => {
  const capability = resolveVibrationMechanismCapability('fit');
  assert.equal(capability.calculationId, 'VIB.FIV.FLOW_TURBULENCE');
  assert.equal(capability.calculationRegistered, true);
  assert.equal(capability.calculationAvailable, true);
  assert.equal(capability.assessmentIntegrationState, 'INTEGRATED');
  assert.equal(capability.integrityImplementationState, 'SCREENING');
  assert.equal(capability.governingEligibilitySource, 'RUNTIME_ASSESSMENT_ONLY');
});

test('Mechanical screening and SBC candidate remain integrated without inventing central calculation availability', () => {
  const mechanical = resolveVibrationMechanismCapability('mechanicalExcitation');
  const sbc = resolveVibrationMechanismCapability('smallBoreConnections');
  assert.equal(mechanical.calculationId, null);
  assert.equal(mechanical.calculationAvailable, false);
  assert.equal(mechanical.assessmentIntegrationState, 'INTEGRATED');
  assert.equal(mechanical.integrityImplementationState, 'SCREENING');
  assert.equal(sbc.calculationId, null);
  assert.equal(sbc.calculationAvailable, false);
  assert.equal(sbc.assessmentIntegrationState, 'INTEGRATED');
  assert.equal(sbc.integrityImplementationState, 'CANDIDATE_USER_INPUT');
});

test('known mechanisms with no available calculation or integration fail closed', () => {
  const capability = resolveVibrationMechanismCapability('reciprocatingPulsation');
  assert.equal(capability.calculationId, null);
  assert.equal(capability.calculationRegistered, false);
  assert.equal(capability.calculationAvailable, false);
  assert.equal(capability.assessmentIntegrationState, 'NONE');
  assert.equal(capability.integrityImplementationState, 'NOT_IMPLEMENTED');
});

test('unknown mechanism identifiers are rejected instead of projected optimistically', () => {
  assert.throws(() => resolveVibrationMechanismCapability('not-a-mechanism'), /UNKNOWN_VIBRATION_MECHANISM:not-a-mechanism/u);
});
