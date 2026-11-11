import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_OPERATING_SCENARIO_AUTHORITY,
  VIBRATION_OPERATING_SCENARIO_DECLARATION,
  VIBRATION_OPERATING_SCENARIO_SCHEMA,
  assembleVibrationIntegrityDataset,
  assertVibrationOperatingScenario,
  buildVibrationOperatingScenario,
} from '../converters/vibration/dataset/index.js';
import {
  VIBRATION_TABLE_EXCHANGE_INTEGRITY,
  VIBRATION_TABLE_EXCHANGE_SCHEMA,
} from '../converters/vibration/exchange/schema.js';

function exchange(authorityOverrides = {}) {
  return {
    schema: VIBRATION_TABLE_EXCHANGE_SCHEMA,
    completeExchange: true,
    integrityStatus: VIBRATION_TABLE_EXCHANGE_INTEGRITY.DECLARED_NOT_REVERIFIED,
    authority: {
      canonicalHash: 'sha256:canonical',
      projectionHash: 'sha256:projection',
      sourceHash: 'sha256:source',
      datasetId: 'plant-a',
      datasetVersion: 'rev-1',
      ...authorityOverrides,
    },
    sourceFileName: 'plant-a.xlsx',
    elements: [
      { canonicalId: 'CANON-001', line: 'L-100', tag: 'P-100', type: 'PIPE' },
    ],
  };
}

function cases() {
  return [
    {
      caseId: 'NORMAL',
      line: 'L-100',
      label: 'Normal operation',
      phase: 'GAS',
      source: 'HMB-100',
      sourceRevision: 'C',
      recordId: 'HMB-100-L100-NORMAL',
      massFlow: { value: 100, unit: 'kg/s' },
      density: { value: 8, unit: 'kg/m3' },
      pressure: { value: 10, unit: 'barg', reference: 'gauge' },
      temperature: { value: 40, unit: 'C' },
    },
    {
      caseId: 'RELIEF',
      line: 'L-100',
      label: 'Relief scenario',
      phase: 'GAS',
      source: 'RELIEF-STUDY-01',
      sourceRevision: 'B',
      recordId: 'RELIEF-01-L100',
      massFlow: { value: 50, unit: 'kg/s' },
      density: { value: 6, unit: 'kg/m3' },
      pressure: { value: 20, unit: 'barg', reference: 'gauge' },
      temperature: { value: 60, unit: 'C' },
    },
  ];
}

function dataset(operatingCases = cases(), exchangeValue = exchange()) {
  return assembleVibrationIntegrityDataset({
    exchange: exchangeValue,
    operatingCases,
    enrichment: [],
  });
}

function selector(caseId = 'NORMAL') {
  return {
    line: 'L-100',
    caseId,
    coherenceDeclaration: VIBRATION_OPERATING_SCENARIO_DECLARATION,
  };
}

test('exact line/case selection creates one coherent frozen OperatingScenario snapshot', () => {
  const scenario = buildVibrationOperatingScenario(dataset(), selector());
  assert.equal(scenario.schema, VIBRATION_OPERATING_SCENARIO_SCHEMA);
  assert.equal(scenario.datasetId, 'plant-a');
  assert.equal(scenario.line, 'L-100');
  assert.equal(scenario.caseId, 'NORMAL');
  assert.equal(scenario.quantities.massFlow.value, 100);
  assert.equal(scenario.quantities.pressure.value, 10);
  assert.equal(scenario.provenance.status, 'COMPLETE');
  assert.equal(scenario.provenance.dataset.datasetId, 'plant-a');
  assert.equal(scenario.provenance.dataset.datasetVersion, 'rev-1');
  assert.equal(scenario.provenance.dataset.sourceHash, 'sha256:source');
  assert.equal(scenario.provenance.operatingCase.source, 'HMB-100');
  assert.equal(scenario.provenance.operatingCase.sourceRevision, 'C');
  assert.equal(scenario.provenance.operatingCase.recordId, 'HMB-100-L100-NORMAL');
  assert.equal(scenario.coherence.basis, 'SINGLE_DATASET_OPERATING_CASE_ROW');
  assert.equal(scenario.coherence.crossScenarioMixingAllowed, false);
  assert.equal(scenario.coherence.independentMaximaSynthesisAllowed, false);
  assert.equal(scenario.coherence.designLimitSubstitutionAllowed, false);
  assert.equal(scenario.basisState.processBasis, 'NOT_REPRESENTED_BY_DATASET_V1');
  assert.equal(scenario.basisState.processActualization, 'NOT_PERFORMED');
  assert.equal(scenario.basisState.pressureReference, 'AS_PROVIDED');
  assert.equal(scenario.authority, VIBRATION_OPERATING_SCENARIO_AUTHORITY);
  assert(Object.isFrozen(scenario));
  assert(Object.isFrozen(scenario.quantities));
  assert.equal(assertVibrationOperatingScenario(scenario), scenario);
});

test('two credible cases remain distinct and no independent-maxima Franken-case is synthesized', () => {
  const source = dataset();
  const normal = buildVibrationOperatingScenario(source, selector('NORMAL'));
  const relief = buildVibrationOperatingScenario(source, selector('RELIEF'));
  assert.notEqual(normal.scenarioId, relief.scenarioId);
  assert.notEqual(normal.identityHash, relief.identityHash);
  assert.notEqual(normal.snapshotHash, relief.snapshotHash);

  assert.deepEqual(
    { massFlow: normal.quantities.massFlow.value, pressure: normal.quantities.pressure.value },
    { massFlow: 100, pressure: 10 },
  );
  assert.deepEqual(
    { massFlow: relief.quantities.massFlow.value, pressure: relief.quantities.pressure.value },
    { massFlow: 50, pressure: 20 },
  );
  assert.notDeepEqual(
    { massFlow: normal.quantities.massFlow.value, pressure: normal.quantities.pressure.value },
    { massFlow: 100, pressure: 20 },
  );
});

test('scenario creation requires explicit coherent-state declaration and rejects maxima selectors', () => {
  assert.throws(
    () => buildVibrationOperatingScenario(dataset(), { line: 'L-100', caseId: 'NORMAL' }),
    (error) => error.code === 'VIBRATION_SCENARIO_TEXT_REQUIRED',
  );
  assert.throws(
    () => buildVibrationOperatingScenario(dataset(), {
      ...selector(),
      maxPressureAcrossCases: true,
    }),
    (error) => error.code === 'VIBRATION_SCENARIO_SELECTOR_FIELD_UNKNOWN',
  );
  assert.throws(
    () => buildVibrationOperatingScenario(dataset(), {
      line: 'L-100', caseId: 'NORMAL', coherenceDeclaration: 'AUTO_MAXIMA_CASE',
    }),
    (error) => error.code === 'VIBRATION_SCENARIO_COHERENCE_DECLARATION_REQUIRED',
  );
});

test('missing source revision and record ID remain explicit operating-case provenance gaps', () => {
  const incomplete = [{
    caseId: 'NORMAL',
    line: 'L-100',
    source: 'HMB-100',
    massFlow: { value: 100, unit: 'kg/s' },
  }];
  const scenario = buildVibrationOperatingScenario(dataset(incomplete), selector());
  assert.equal(scenario.provenance.status, 'INCOMPLETE');
  assert.deepEqual(
    scenario.provenance.missingFields,
    ['operatingCase.sourceRevision', 'operatingCase.recordId'],
  );
  assert.equal(scenario.provenance.operatingCase.sourceRevision, null);
  assert.equal(scenario.provenance.operatingCase.recordId, null);
});

test('logical scenario identity is dataset scoped while snapshot moves with engineering input/revision', () => {
  const first = buildVibrationOperatingScenario(dataset(), selector());
  const changedCases = cases().map((row) => (
    row.caseId === 'NORMAL'
      ? { ...row, massFlow: { value: 101, unit: 'kg/s' } }
      : row
  ));
  const changedInput = buildVibrationOperatingScenario(dataset(changedCases), selector());
  assert.equal(first.scenarioId, changedInput.scenarioId);
  assert.equal(first.identityHash, changedInput.identityHash);
  assert.notEqual(first.snapshotHash, changedInput.snapshotHash);

  const changedDatasetRevision = buildVibrationOperatingScenario(
    dataset(cases(), exchange({ datasetVersion: 'rev-2' })),
    selector(),
  );
  assert.equal(first.scenarioId, changedDatasetRevision.scenarioId);
  assert.notEqual(first.snapshotHash, changedDatasetRevision.snapshotHash);

  const foreignDataset = buildVibrationOperatingScenario(
    dataset(cases(), exchange({ datasetId: 'plant-b' })),
    selector(),
  );
  assert.notEqual(first.scenarioId, foreignDataset.scenarioId);
  assert.notEqual(first.identityHash, foreignDataset.identityHash);
});

test('snapshot integrity detects tampering and foreign or identity-less datasets fail closed', () => {
  const scenario = buildVibrationOperatingScenario(dataset(), selector());
  const tampered = JSON.parse(JSON.stringify(scenario));
  tampered.quantities.massFlow.value = 999;
  assert.throws(
    () => assertVibrationOperatingScenario(tampered),
    (error) => error.code === 'VIBRATION_SCENARIO_SNAPSHOT_HASH_INVALID',
  );
  assert.throws(
    () => buildVibrationOperatingScenario({ schema: 'OtherDataset.v1', operatingCases: [] }, selector()),
    (error) => error.code === 'VIBRATION_SCENARIO_DATASET_INVALID',
  );
  assert.throws(
    () => buildVibrationOperatingScenario(dataset(cases(), exchange({ datasetId: '' })), selector()),
    (error) => error.code === 'VIBRATION_SCENARIO_TEXT_REQUIRED',
  );
});

test('pressure reference is preserved but never inferred and process actualization stays separate', () => {
  const noReference = [{
    caseId: 'NORMAL',
    line: 'L-100',
    source: 'HMB-100',
    sourceRevision: 'C',
    recordId: 'HMB-100-L100-NORMAL',
    pressure: { value: 10, unit: 'bar' },
  }];
  const scenario = buildVibrationOperatingScenario(dataset(noReference), selector());
  assert.equal(Object.hasOwn(scenario.quantities.pressure, 'reference'), false);
  assert.equal(scenario.basisState.pressureReference, 'UNRESOLVED');
  assert.equal(scenario.basisState.processBasis, 'NOT_REPRESENTED_BY_DATASET_V1');
  assert.equal(scenario.basisState.processActualization, 'NOT_PERFORMED');
  assert.equal(scenario.authority.processActualizationAuthority, 'NONE');
  assert.equal(scenario.authority.coherenceAuthority, 'CALLER_DECLARATION_ONLY');
});
