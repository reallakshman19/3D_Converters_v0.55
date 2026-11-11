import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_OPERATING_SCENARIO_DECLARATION,
  assembleVibrationIntegrityDataset,
  buildVibrationOperatingScenario,
} from '../converters/vibration/dataset/index.js';
import {
  VIBRATION_ASSESSMENT_EXECUTION_BASIS_SCHEMA,
  VIBRATION_ASSESSMENT_UNIT_AUTHORITY,
  VIBRATION_ASSESSMENT_UNIT_SCHEMA,
  assertVibrationAssessmentUnit,
  createRequiredVibrationAssessmentSet,
  createVibrationAssessmentUnit,
  createVibrationAssessmentUnitSet,
  executeVibrationAssessmentUnitWithScenarioGuard,
} from '../converters/vibration/mechanisms/index.js';
import {
  VIBRATION_TABLE_EXCHANGE_INTEGRITY,
  VIBRATION_TABLE_EXCHANGE_SCHEMA,
} from '../converters/vibration/exchange/schema.js';

function exchange(datasetId = 'plant-a', datasetVersion = 'rev-1', line = 'L-100', canonicalId = 'CANON-001') {
  return {
    schema: VIBRATION_TABLE_EXCHANGE_SCHEMA,
    completeExchange: true,
    integrityStatus: VIBRATION_TABLE_EXCHANGE_INTEGRITY.DECLARED_NOT_REVERIFIED,
    authority: {
      canonicalHash: `sha256:canonical-${datasetId}`,
      projectionHash: `sha256:projection-${datasetId}`,
      sourceHash: `sha256:source-${datasetVersion}`,
      datasetId,
      datasetVersion,
    },
    sourceFileName: `${datasetId}.xlsx`,
    elements: [{ canonicalId, line, tag: canonicalId, type: 'PIPE' }],
  };
}

function operatingCase({
  line = 'L-100', caseId = 'NORMAL', massFlow = 100, pressure = 10, recordId = null,
} = {}) {
  return {
    caseId,
    line,
    source: 'HMB-100',
    sourceRevision: 'C',
    recordId: recordId ?? `HMB-${line}-${caseId}`,
    massFlow: { value: massFlow, unit: 'kg/s' },
    density: { value: 8, unit: 'kg/m3' },
    pressure: { value: pressure, unit: 'barg', reference: 'gauge' },
  };
}

function dataset({
  datasetId = 'plant-a', datasetVersion = 'rev-1', line = 'L-100', canonicalId = 'CANON-001', cases = null,
} = {}) {
  return assembleVibrationIntegrityDataset({
    exchange: exchange(datasetId, datasetVersion, line, canonicalId),
    operatingCases: cases ?? [operatingCase({ line })],
    enrichment: [],
  });
}

function scenario(source = dataset(), line = 'L-100', caseId = 'NORMAL') {
  return buildVibrationOperatingScenario(source, {
    line,
    caseId,
    coherenceDeclaration: VIBRATION_OPERATING_SCENARIO_DECLARATION,
  });
}

function identification({
  mechanismId = 'fit', line = 'L-100', caseId = 'NORMAL', canonicalId = 'CANON-001',
  assessmentUnitType = 'MAIN_LINE_SECTION',
} = {}) {
  return {
    mechanismId,
    scope: { line, caseId, canonicalId },
    assessmentUnitType,
    disposition: 'REQUIRED',
    requiredQualification: 'SCREENING',
    evidence: { sourceId: `T1-${mechanismId}-${line}-${caseId}` },
    reason: 'test-required',
  };
}

function requiredSet(identifications = [identification()], knownMechanismIds = ['fit']) {
  return createRequiredVibrationAssessmentSet({ identifications, knownMechanismIds });
}

function requirement(identifications = [identification()], knownMechanismIds = ['fit'], index = 0) {
  return requiredSet(identifications, knownMechanismIds).required[index];
}

test('assessment unit binds one required assessment to exact scenario identity and snapshot', () => {
  const operatingScenario = scenario();
  const unit = createVibrationAssessmentUnit({
    requirement: requirement(),
    operatingScenario,
  });
  assert.equal(unit.schema, VIBRATION_ASSESSMENT_UNIT_SCHEMA);
  assert.equal(unit.mechanismId, 'fit');
  assert.equal(unit.assessmentUnitType, 'MAIN_LINE_SECTION');
  assert.equal(unit.operatingScenario.scenarioId, operatingScenario.scenarioId);
  assert.equal(unit.operatingScenario.scenarioSnapshotHash, operatingScenario.snapshotHash);
  assert.equal(unit.operatingScenario.datasetId, 'plant-a');
  assert.equal(unit.authority, VIBRATION_ASSESSMENT_UNIT_AUTHORITY);
  assert(Object.isFrozen(unit));
  assert.equal(assertVibrationAssessmentUnit(unit), unit);
});

test('one unit set can bind different mechanisms to the same coherent scenario', () => {
  const identifications = [
    identification(),
    identification({ mechanismId: 'aiv', assessmentUnitType: 'AIV_SOURCE_ASSESSMENT_PAIR' }),
  ];
  const set = createVibrationAssessmentUnitSet({
    requiredAssessmentSet: requiredSet(identifications, ['fit', 'aiv']),
    operatingScenarios: [scenario()],
  });
  assert.equal(set.cardinality, 2);
  assert.deepEqual(set.units.map((unit) => unit.mechanismId).sort(), ['aiv', 'fit']);
  assert.equal(new Set(set.units.map((unit) => unit.operatingScenario.scenarioSnapshotHash)).size, 1);
});

test('requirement line/case mismatch and missing executable case fail closed', () => {
  assert.throws(
    () => createVibrationAssessmentUnit({
      requirement: requirement([identification({ caseId: 'RELIEF' })]),
      operatingScenario: scenario(),
    }),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_SCENARIO_SCOPE_MISMATCH',
  );
  const missingCase = { ...requirement(), scope: { line: 'L-100', caseId: null, canonicalId: 'CANON-001' } };
  assert.throws(
    () => createVibrationAssessmentUnit({ requirement: missingCase, operatingScenario: scenario() }),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_TEXT_REQUIRED',
  );
});

test('unit logical identity stays stable while revised scenario snapshot moves unit snapshot hash', () => {
  const firstScenario = scenario(dataset({ datasetVersion: 'rev-1' }));
  const secondScenario = scenario(dataset({
    datasetVersion: 'rev-2',
    cases: [operatingCase({ massFlow: 101 })],
  }));
  assert.equal(firstScenario.scenarioId, secondScenario.scenarioId);
  assert.notEqual(firstScenario.snapshotHash, secondScenario.snapshotHash);
  const first = createVibrationAssessmentUnit({ requirement: requirement(), operatingScenario: firstScenario });
  const second = createVibrationAssessmentUnit({ requirement: requirement(), operatingScenario: secondScenario });
  assert.equal(first.assessmentUnitId, second.assessmentUnitId);
  assert.equal(first.identityHash, second.identityHash);
  assert.notEqual(first.unitSnapshotHash, second.unitSnapshotHash);
});

test('execution guard rejects stale scenario snapshot before the mechanism callback is invoked', () => {
  const firstScenario = scenario(dataset({ datasetVersion: 'rev-1' }));
  const revisedScenario = scenario(dataset({
    datasetVersion: 'rev-2',
    cases: [operatingCase({ massFlow: 101 })],
  }));
  const unit = createVibrationAssessmentUnit({ requirement: requirement(), operatingScenario: firstScenario });
  let calls = 0;
  assert.throws(
    () => executeVibrationAssessmentUnitWithScenarioGuard({
      assessmentUnit: unit,
      operatingScenario: revisedScenario,
      execute: () => { calls += 1; },
    }),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_SCENARIO_SNAPSHOT_MISMATCH',
  );
  assert.equal(calls, 0);
});

test('execution guard allows the exact bound scenario and exposes non-authorizing basis evidence', () => {
  const operatingScenario = scenario();
  const unit = createVibrationAssessmentUnit({ requirement: requirement(), operatingScenario });
  let calls = 0;
  const result = executeVibrationAssessmentUnitWithScenarioGuard({
    assessmentUnit: unit,
    operatingScenario,
    execute: ({ executionBasis }) => {
      calls += 1;
      assert.equal(executionBasis.schema, VIBRATION_ASSESSMENT_EXECUTION_BASIS_SCHEMA);
      assert.equal(executionBasis.scenarioSnapshotHash, operatingScenario.snapshotHash);
      assert.equal(executionBasis.authority.engineeringAuthority, 'NONE');
      assert.equal(executionBasis.authority.executionAuthority, 'NONE');
      return 'kernel-result';
    },
  });
  assert.equal(calls, 1);
  assert.equal(result, 'kernel-result');
});

test('unit set rejects mixed datasets and missing scenario bindings', () => {
  const identifications = [
    identification({ line: 'L-100', canonicalId: 'CANON-001' }),
    identification({ line: 'L-200', canonicalId: 'CANON-002' }),
  ];
  const set = requiredSet(identifications, ['fit']);
  const scenarioA = scenario(dataset({ datasetId: 'plant-a', line: 'L-100', canonicalId: 'CANON-001' }));
  const scenarioB = scenario(dataset({ datasetId: 'plant-b', line: 'L-200', canonicalId: 'CANON-002' }), 'L-200');
  assert.throws(
    () => createVibrationAssessmentUnitSet({ requiredAssessmentSet: set, operatingScenarios: [scenarioA, scenarioB] }),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_DATASET_MIX_FORBIDDEN',
  );
  assert.throws(
    () => createVibrationAssessmentUnitSet({ requiredAssessmentSet: set, operatingScenarios: [scenarioA] }),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_SCENARIO_MISSING',
  );
});

test('tampered unit custody is rejected', () => {
  const unit = createVibrationAssessmentUnit({ requirement: requirement(), operatingScenario: scenario() });
  const tampered = JSON.parse(JSON.stringify(unit));
  tampered.operatingScenario.scenarioSnapshotHash = 'sha256:tampered';
  assert.throws(
    () => assertVibrationAssessmentUnit(tampered),
    (error) => error.code === 'VIBRATION_ASSESSMENT_UNIT_SNAPSHOT_HASH_INVALID',
  );
});
