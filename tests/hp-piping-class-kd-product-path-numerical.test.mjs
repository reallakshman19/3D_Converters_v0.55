import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_NPS4_REFERENCE_ID,
  createHpPipingClassReferenceProject,
} from '../tabs/hp-piping-class-reference-samples.js';
import {
  createHpPipingClassWorkspaceController,
  parseHpPipingClassWorkspaceProject,
  serializeHpPipingClassWorkspaceProject,
} from '../tabs/hp-piping-class-workspace-controller.js';
import {
  addAllHpPipingClassExternalResults,
  copyFirstHpPipingClassKdBasisToAll,
} from '../tabs/hp-piping-class-kd-productivity.js';
import {
  HP_PIPING_CLASS_KD_BULK_HEADERS,
  applyHpPipingClassKdBulkInput,
} from '../tabs/hp-piping-class-kd-bulk-input.js';

const HAND_INPUT = Object.freeze({
  outsideDiameterMm: 114.3,
  nominalWallMm: 13.49,
  minusTolerancePct: 12.5,
  internalAllowanceMm: 3,
  externalAllowanceMm: 0,
  lowPressureMpa: 2,
  highPressureMpa: 20,
});

function close(actual, expected, tolerance = 1e-10) {
  assert(Number.isFinite(actual), `actual is not finite: ${actual}`);
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function boreStressIntensityMpa(pressureMpa, outsideDiameterMm, effectiveWallMm) {
  const innerDiameterMm = outsideDiameterMm - (2 * effectiveWallMm);
  const y = outsideDiameterMm / innerDiameterMm;
  const y2 = y ** 2;
  return 2 * pressureMpa * y2 / (y2 - 1);
}

function handOracle(input = HAND_INPUT) {
  const minimumAsManufacturedThicknessMm = input.nominalWallMm * (1 - (input.minusTolerancePct / 100));
  const effectiveWallMm = minimumAsManufacturedThicknessMm
    - input.internalAllowanceMm - input.externalAllowanceMm;
  const innerDiameterMm = input.outsideDiameterMm - (2 * effectiveWallMm);
  const diameterRatioY = input.outsideDiameterMm / innerDiameterMm;
  const lowStressIntensityMpa = boreStressIntensityMpa(
    input.lowPressureMpa, input.outsideDiameterMm, effectiveWallMm,
  );
  const highStressIntensityMpa = boreStressIntensityMpa(
    input.highPressureMpa, input.outsideDiameterMm, effectiveWallMm,
  );
  const stressIntensityRangeMpa = Math.abs(highStressIntensityMpa - lowStressIntensityMpa);
  return {
    minimumAsManufacturedThicknessMm,
    effectiveWallMm,
    innerDiameterMm,
    diameterRatioY,
    lowStressIntensityMpa,
    highStressIntensityMpa,
    stressIntensityRangeMpa,
    alternatingStressIntensityMpa: stressIntensityRangeMpa / 2,
  };
}

function prepareTwoCycleProject() {
  const project = createHpPipingClassReferenceProject(HP_PIPING_CLASS_NPS4_REFERENCE_ID);
  project.metadata.referenceSampleId = null;
  project.metadata.revision = 'NUMERICAL-E2E-A';
  project.transient.transitions.push({
    spectrumId: project.transient.spectrum.spectrumId,
    cycleId: 'C2',
    fromStateId: 'HIGH',
    toStateId: 'LOW',
    totalCycles: 1200,
    category: 'PROCESS_CYCLE',
  });

  const added = addAllHpPipingClassExternalResults(project, 0);
  assert.deepEqual(added, { added: 1, reason: null });
  const copied = copyFirstHpPipingClassKdBasisToAll(project, 0);
  assert.deepEqual(copied, { copied: 1, reason: null });

  const salt = handOracle().alternatingStressIntensityMpa;
  const header = HP_PIPING_CLASS_KD_BULK_HEADERS.join(',');
  const bulk = [
    header,
    `C1,BORE_INNER_SURFACE,${salt},70,10000`,
    `C2,BORE_INNER_SURFACE,${salt},85,30000`,
  ].join('\n');
  const applied = applyHpPipingClassKdBulkInput(project, 0, bulk);
  assert.equal(applied.applied, true, JSON.stringify(applied));
  return project;
}

function assertNumericalProductResult(result) {
  const oracle = handOracle();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.projectState, 'CALCULATED_NOT_AUTHORIZED');
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.codeCompliance, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);

  const product = result.products[0];
  assert.equal(product.engineeringState, 'REVIEW_COMPLETE_NOT_AUTHORIZED');
  close(product.selectedFatigueWallMm, oracle.effectiveWallMm);
  const fatigue = product.calculations.fatigue.outputs;
  assert.equal(fatigue.calculationMode, 'USER_CALCULATED_KD3');
  assert.equal(fatigue.independentCheckComplete, true);
  assert.equal(fatigue.cycles.length, 2);

  const byCycle = new Map(fatigue.cycles.map((row) => [row.cycleId, row]));
  const c1 = byCycle.get('C1');
  const c2 = byCycle.get('C2');
  close(c1.coreSaltMpa, oracle.alternatingStressIntensityMpa);
  close(c2.coreSaltMpa, oracle.alternatingStressIntensityMpa);
  close(c1.userSaltMpa, oracle.alternatingStressIntensityMpa);
  close(c2.userSaltMpa, oracle.alternatingStressIntensityMpa);
  assert.equal(c1.saltCrossCheckStatus, 'MATCH');
  assert.equal(c2.saltCrossCheckStatus, 'MATCH');
  assert.equal(c1.equivalentAlternatingStressMpa, 70);
  assert.equal(c2.equivalentAlternatingStressMpa, 85);
  assert.equal(c1.permissibleCycles, 10000);
  assert.equal(c2.permissibleCycles, 30000);
  close(c1.usage, 500 / 10000);
  close(c2.usage, 1200 / 30000);
  close(fatigue.cumulativeUsage, (500 / 10000) + (1200 / 30000));
  assert.equal(fatigue.usageWithinUnity, true);
  assert.equal(fatigue.referenceStatus, 'REFERENCE_PASS');
}

test('independent hand oracle fixes the physical wall and pressure-cycle Salt', () => {
  const oracle = handOracle();
  close(oracle.minimumAsManufacturedThicknessMm, 11.80375);
  close(oracle.effectiveWallMm, 8.80375);
  close(oracle.innerDiameterMm, 96.6925);
  close(oracle.diameterRatioY, 1.1820978876334773);
  close(oracle.lowStressIntensityMpa, 14.066554624558583);
  close(oracle.highStressIntensityMpa, 140.66554624558586);
  close(oracle.stressIntensityRangeMpa, 126.59899162102727);
  close(oracle.alternatingStressIntensityMpa, 63.29949581051363);

  const wrongNominalWallSalt = Math.abs(
    boreStressIntensityMpa(HAND_INPUT.highPressureMpa, HAND_INPUT.outsideDiameterMm, HAND_INPUT.nominalWallMm)
    - boreStressIntensityMpa(HAND_INPUT.lowPressureMpa, HAND_INPUT.outsideDiameterMm, HAND_INPUT.nominalWallMm),
  ) / 2;
  close(wrongNominalWallSalt, 43.23041554660033);
  assert((oracle.alternatingStressIntensityMpa - wrongNominalWallSalt)
    / oracle.alternatingStressIntensityMpa > 0.31);
});

test('reference -> governed cycles -> bulk Seq/N -> controller calculate reproduces hand Salt and Miner sum', () => {
  const controller = createHpPipingClassWorkspaceController({
    initialProject: prepareTwoCycleProject(),
    storage: null,
  });
  const result = controller.calculate({ includeEvidence: true });
  assertNumericalProductResult(result);
  close(result.products[0].assessment.cumulativeUsage, 0.09);
});

test('serialized project round-trip preserves the exact numerical fatigue result and authority boundary', () => {
  const project = prepareTwoCycleProject();
  const serialized = serializeHpPipingClassWorkspaceProject(project);
  const parsed = parseHpPipingClassWorkspaceProject(serialized);
  const replay = createHpPipingClassWorkspaceController({ initialProject: parsed, storage: null });
  const result = replay.calculate({ includeEvidence: true });
  assertNumericalProductResult(result);
  assert.equal(result.products[0].authority.nativeCoreKd3Qualified, false);
  assert.equal(result.products[0].authority.codeCompliance, false);
  assert.equal(result.products[0].authority.canUseForDesignAuthority, false);
});
