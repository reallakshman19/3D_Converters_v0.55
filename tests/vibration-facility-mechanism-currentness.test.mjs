import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  VIBRATION_OPERATING_SCENARIO_DECLARATION,
  assembleVibrationIntegrityDataset,
  buildVibrationOperatingScenario,
} from '../converters/vibration/dataset/index.js';
import {
  VIBRATION_FACILITY_MECHANISM_CURRENTNESS_AUTHORITY,
  projectVibrationFacilityMechanismCurrentness,
} from '../converters/vibration/facility/mechanism-currentness.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';
import { vibrationFacilityScenarioSetKey } from '../converters/vibration/facility/scenario-handoff.js';
import { buildVibrationIntegrityMatrixContext } from '../tabs/vibration-integrity-matrix-context.js';

function exchange() {
  return {
    schema: 'VibrationTableExchange.v1',
    completeExchange: true,
    integrityStatus: 'DECLARED_NOT_REVERIFIED',
    authority: {
      canonicalHash: 'sha256:canonical',
      projectionHash: 'sha256:projection',
      sourceHash: 'sha256:source',
      datasetId: 'plant-a',
      datasetVersion: 'rev-1',
    },
    sourceFileName: 'plant-a.xlsx',
    elements: [{ canonicalId: 'CAN-1', line: 'L-100', type: 'PIPE' }],
  };
}

function operatingCase(flow = 100) {
  return {
    caseId: 'NORMAL', line: 'L-100', phase: 'GAS', source: 'HMB-1', sourceRevision: 'A',
    recordId: 'HMB-L100-NORMAL', massFlow: { value: flow, unit: 'kg/s' },
    pressure: { value: 10, unit: 'barg', reference: 'gauge' },
  };
}

function scenario(flow = 100) {
  const dataset = assembleVibrationIntegrityDataset({
    exchange: exchange(), operatingCases: [operatingCase(flow)], enrichment: [],
  });
  return buildVibrationOperatingScenario(dataset, {
    line: 'L-100', caseId: 'NORMAL',
    coherenceDeclaration: VIBRATION_OPERATING_SCENARIO_DECLARATION,
  });
}

function scenarioSetKey(current) {
  return vibrationFacilityScenarioSetKey([current]);
}

function executionBasis(current) {
  return Object.freeze({
    schema: 'VibrationScenarioExecutionBasis.v1',
    scenarioId: current.scenarioId,
    scenarioSnapshotHash: current.snapshotHash,
    datasetId: current.datasetId,
    line: current.line,
    caseId: current.caseId,
  });
}

function runBasis(current, runId = 'FIT-RUN-2', key = scenarioSetKey(current)) {
  return createVibrationFacilityRunBasis({ runId, datasetId: 'plant-a', scenarioSetKey: key });
}

function candidate(current, runId = 'FIT-RUN-2', key = scenarioSetKey(current)) {
  return Object.freeze({
    scenarioExecutionBasis: executionBasis(current),
    facilityRunBasis: runBasis(current, runId, key),
  });
}

function aivSession(current, runId = 'FIT-RUN-2', key = scenarioSetKey(current)) {
  return Object.freeze({
    resultState: 'CURRENT_RESULT',
    executionContext: 'FACILITY_LINKED',
    scenarioExecutionPlan: Object.freeze({
      facilityRunId: runId,
      datasetId: 'plant-a',
      scenarioSetKey: key,
    }),
  });
}

function currentOptions(overrides = {}) {
  const current = overrides.current ?? scenario(100);
  return {
    resultState: 'CURRENT_RESULT',
    runId: 'FIT-RUN-2',
    datasetId: 'plant-a',
    scenarioSetKey: scenarioSetKey(current),
    operatingScenarios: [current],
    mechanicalCandidateResultsByScope: {},
    sbcCandidateResultsByScope: {},
    aivScreeningSession: null,
    ...overrides,
    current: undefined,
  };
}

test('currentness projection is presentation-only and non-blocking', () => {
  const projection = projectVibrationFacilityMechanismCurrentness(currentOptions());
  assert.deepEqual(projection.authority, VIBRATION_FACILITY_MECHANISM_CURRENTNESS_AUTHORITY);
  assert.equal(projection.authority.engineeringAuthority, 'NONE');
  assert.equal(projection.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(projection.authority.determinesCompleteness, false);
  assert.equal(projection.authority.determinesGoverningResult, false);
  assert.equal(projection.authority.blocksCalculation, false);
});

test('exact current-run Mechanical and SBC caches remain visible', () => {
  const current = scenario(100);
  const exact = candidate(current);
  const projection = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current,
    mechanicalCandidateResultsByScope: { MECH: exact },
    sbcCandidateResultsByScope: { SBC: exact },
  }));
  assert.equal(projection.mechanicalCandidateResultsByScope.MECH, exact);
  assert.equal(projection.sbcCandidateResultsByScope.SBC, exact);
  assert.equal(projection.excluded.length, 0);
});

test('identical rerun filters previous-run Mechanical and SBC caches despite equal scenario hash', () => {
  const current = scenario(100);
  const old = candidate(current, 'FIT-RUN-1');
  const projection = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current,
    mechanicalCandidateResultsByScope: { MECH: old },
    sbcCandidateResultsByScope: { SBC: old },
  }));
  assert.deepEqual(projection.mechanicalCandidateResultsByScope, {});
  assert.deepEqual(projection.sbcCandidateResultsByScope, {});
  assert.equal(projection.excluded.length, 2);
  assert(projection.excluded.every((item) => item.reason === 'STALE_OR_FOREIGN_RUN_CUSTODY'));
});

test('same-run candidate with stale OperatingScenario snapshot is filtered', () => {
  const prepared = scenario(100);
  const current = scenario(101);
  const stale = candidate(prepared, 'FIT-RUN-2', scenarioSetKey(current));
  const projection = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current,
    mechanicalCandidateResultsByScope: { MECH: stale },
  }));
  assert.deepEqual(projection.mechanicalCandidateResultsByScope, {});
  assert.equal(projection.excluded[0].mechanismId, 'mechanicalExcitation');
});

test('claimed facility scenario-set key must equal deterministic OperatingScenario fingerprint', () => {
  const current = scenario(100);
  const projection = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current,
    scenarioSetKey: 'VFSK1:tampered',
  }));
  assert.equal(projection.status, 'FACILITY_SCENARIO_SET_INVALID');
  assert.equal(projection.run, null);
  assert.deepEqual(projection.mechanicalCandidateResultsByScope, {});
});

test('AIV session must match exact current facility run and scenario set', () => {
  const scenarioNow = scenario(100);
  const exact = aivSession(scenarioNow);
  const current = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current: scenarioNow, aivScreeningSession: exact,
  }));
  assert.equal(current.aivScreeningSession, exact);

  const prior = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current: scenarioNow, aivScreeningSession: aivSession(scenarioNow, 'FIT-RUN-1'),
  }));
  assert.equal(prior.aivScreeningSession, null);
  assert.equal(prior.excluded[0].mechanismId, 'aiv');

  const foreignSet = projectVibrationFacilityMechanismCurrentness(currentOptions({
    current: scenarioNow,
    aivScreeningSession: aivSession(scenarioNow, 'FIT-RUN-2', 'VFSK1:old-set'),
  }));
  assert.equal(foreignSet.aivScreeningSession, null);
});

test('whole-facility STALE_RESULT preserves retained stale inspection instead of claiming currentness', () => {
  const retained = Object.freeze({ retained: true });
  const session = aivSession(scenario(100), 'FIT-RUN-1');
  const context = buildVibrationIntegrityMatrixContext({
    resultState: 'STALE_RESULT',
    mechanicalCandidateResultsByScope: { MECH: retained },
    sbcFacilityCandidateResults: { SBC: retained },
  }, { aivScreeningSession: session });
  assert.equal(context.mechanicalCandidateResultsByScope.MECH, retained);
  assert.equal(context.sbcCandidateResultsByScope.SBC, retained);
  assert.equal(context.aivScreeningSession, session);
  assert.equal(context.aivResultState, 'STALE_RESULT');
  assert.equal(context.facilityMechanismCurrentness, null);
});

test('shared matrix-context builder is the only cache ingress for register and roadmap projections', () => {
  const view = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-view.js', import.meta.url)), 'utf8');
  const bridge = readFileSync(fileURLToPath(new URL('../tabs/vibration-integrity-roadmap-bridge.js', import.meta.url)), 'utf8');
  for (const source of [view, bridge]) {
    assert.match(source, /buildVibrationIntegrityMatrixContext/);
    assert.doesNotMatch(source, /function matrixContext\s*\(/);
  }
});
