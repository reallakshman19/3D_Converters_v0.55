import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateEngineering,
  getEngineeringCalculationDefinition,
} from '../converters/engineering-calculations/index.js';
import { evaluateHpPipingClassProject } from '../converters/b313-chapter-ix/hp-piping-class-orchestrator.js';
import { createHpPipingClassNps4ReferenceProject } from '../tabs/hp-piping-class-reference-samples.js';

const IDS = Object.freeze({
  straightPressure: 'PIPE.B313.CH9.STRAIGHT_PRESSURE_REVIEW',
  wallState: 'PIPE.B313.CH9.WALL_STATE_REVIEW',
  userFatigue: 'PIPE.B313.CH9.FATIGUE_USER_REVIEW',
  strictUserFatigue: 'PIPE.B313.CH9.FATIGUE_USER_CALCULATED',
});

function close(actual, expected, tolerance = 1e-10) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function fatigueInputs(resultOverrides = {}) {
  return {
    outsideDiameter: 114.3,
    effectiveWall: 8.80375,
    spectrum: { spectrumId: 'S1', designLifeYears: 20 },
    states: [
      { spectrumId: 'S1', stateId: 'LOW', pressureMpa: 5, materialTemperatureC: 40, structuralTemperatureC: 40 },
      { spectrumId: 'S1', stateId: 'HIGH', pressureMpa: 30, materialTemperatureC: 40, structuralTemperatureC: 40 },
    ],
    transitions: [
      { spectrumId: 'S1', cycleId: 'C1', fromStateId: 'LOW', toStateId: 'HIGH', totalCycles: 10000, category: 'PROCESS_CYCLE' },
    ],
    externalResults: [{
      cycleId: 'C1',
      locationId: 'BORE_INNER_SURFACE',
      fromStateId: 'LOW',
      toStateId: 'HIGH',
      userAlternatingStressIntensityMpa: 87.91596640349115,
      equivalentAlternatingStressMpa: 95,
      permissibleCycles: 20000,
      ...resultOverrides,
    }],
  };
}

test('production-review calculations are executable in normal strict console mode without authority promotion', () => {
  for (const id of [IDS.straightPressure, IDS.wallState, IDS.userFatigue]) {
    const definition = getEngineeringCalculationDefinition(id);
    assert.ok(definition, id);
    assert.equal(definition.authority.calculationState, 'IMPLEMENTED');
    assert.equal(definition.authority.qualificationState, 'IMPLEMENTED');
    assert.equal(definition.authority.codeCompliance, false);
    assert.equal(definition.ui.requiredQualificationMode, undefined);
    assert.equal(definition.ui.productSurface, 'ENGINEERING_CALCULATIONS');
  }
});

test('production straight-pressure review reproduces the frozen NPS4 arithmetic under default execution', () => {
  const result = calculateEngineering({
    calculationId: IDS.straightPressure,
    inputs: {
      outsideDiameter: 114.3,
      designPressure: 20,
      allowableStress: 138,
      internalAllowance: 3,
      externalAllowance: 0,
      minusTolerancePct: 12.5,
      providedNominalThickness: 13.49,
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  close(result.outputs.pressureDesignThicknessMm, 7.7103934983403475);
  close(result.outputs.requiredMinimumThicknessMm, 10.710393498340348);
  close(result.outputs.requiredNominalThicknessMm, 12.240449712388969);
  close(result.outputs.minimumAsManufacturedThicknessMm, 11.80375);
  close(result.outputs.effectiveNetWallMm, 8.80375);
  close(result.outputs.pressureRatingMpa, 23.086120852009273);
  assert.equal(result.outputs.staticPass, true);
  assert.equal(result.assessment.status, 'ENGINEERING_REVIEW_PASS');
  assert.equal(result.provenance.codeCompliance, false);
  assert.equal(result.provenance.canUseForDesignAuthority, false);
});

test('production wall-state review exposes EOL and projected-EOL walls without a qualification-mode gate', () => {
  const result = calculateEngineering({
    calculationId: IDS.wallState,
    inputs: {
      nominalWall: 13.49,
      minusTolerancePct: 12.5,
      internalServiceAllowance: 3,
      externalServiceAllowance: 0,
      measuredCurrentWall: 10.2,
      futureInternalLoss: 1.2,
      futureExternalLoss: 0.3,
    },
    options: { qualificationMode: 'strict' },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  close(result.outputs.minimumAsManufacturedWallMm, 11.80375);
  close(result.outputs.endOfLifeEffectiveWallMm, 8.80375);
  close(result.outputs.projectedEndOfLifeWallMm, 8.7);
  assert.equal(result.provenance.codeCompliance, false);
});

test('production USER_CALCULATED_KD3 review computes Salt and Miner usage when provenance/checker evidence is absent', () => {
  const result = calculateEngineering({
    calculationId: IDS.userFatigue,
    inputs: fatigueInputs(),
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.outputs.calculationMode, 'USER_CALCULATED_KD3');
  assert.equal(result.outputs.independentCheckComplete, false);
  assert(result.outputs.evidenceIssueCount > 0);
  close(result.outputs.cycles[0].coreSaltMpa, 87.91596640349115);
  close(result.outputs.cumulativeUsage, 0.5);
  assert.equal(result.outputs.usageWithinUnity, true);
  assert(result.warnings.some((row) => row.code === 'EXTERNAL_KD3_EVIDENCE_ADVISORY'));
  assert.equal(result.provenance.codeCompliance, false);
  assert.equal(result.provenance.canUseForDesignAuthority, false);
});

test('formal USER_CALCULATED_KD3 intake retains its evidence gate for later qualification work', () => {
  const result = calculateEngineering({
    calculationId: IDS.strictUserFatigue,
    inputs: fatigueInputs(),
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'USER_FATIGUE_BASIS_REQUIRED');
  assert.equal(result.qualification.designAuthority, false);
});

test('production review defers evidence only; invalid numerical fatigue input still fails closed', () => {
  const invalidN = calculateEngineering({
    calculationId: IDS.userFatigue,
    inputs: fatigueInputs({ permissibleCycles: null }),
  });
  assert.equal(invalidN.ok, false);
  assert.equal(invalidN.errors[0].code, 'USER_N_ALLOWED_INVALID');

  const saltConflict = calculateEngineering({
    calculationId: IDS.userFatigue,
    inputs: fatigueInputs({ userAlternatingStressIntensityMpa: 100 }),
  });
  assert.equal(saltConflict.ok, false);
  assert.equal(saltConflict.errors[0].code, 'USER_SALT_MISMATCH');
});

test('HP Piping Class product path uses advisory-evidence fatigue review and still reproduces NPS4 result', () => {
  const project = createHpPipingClassNps4ReferenceProject();
  delete project.fatigueEvidence[0].externalResults[0].calculationBasis;
  const result = evaluateHpPipingClassProject(project);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.calculationIds.fatigue, IDS.userFatigue);
  assert.equal(result.products[0].calculationOk, true);
  assert.equal(result.products[0].engineeringState, 'REVIEW_COMPLETE_NOT_AUTHORIZED');
  close(result.products[0].selectedFatigueWallMm, 8.80375);
  close(result.products[0].calculations.fatigue.outputs.cycles[0].coreSaltMpa, 63.29949581051363);
  close(result.products[0].assessment.cumulativeUsage, 0.05);
  assert(result.products[0].calculations.fatigue.outputs.evidenceIssueCount > 0);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.codeCompliance, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});
