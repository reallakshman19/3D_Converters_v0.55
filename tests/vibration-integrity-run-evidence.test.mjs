import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runVibrationFacilityFitBenchmarkFromTables,
  runVibrationFacilityFitScreeningFromTables,
} from '../converters/vibration/facility/fit-workflow-tabular.js';
import { VIBRATION_FIT_UI_BENCHMARK_CASES } from '../tabs/vibration-integrity-benchmarks.js';
import {
  buildLoadedVibrationIntegrityBenchmark,
  captureVibrationIntegrityExecutionState,
  createVibrationIntegrityInputRuntimeState,
} from '../tabs/vibration-integrity-input-runtime.js';
import {
  executeVibrationIntegrityBenchmarkRun,
  executeVibrationIntegrityRun,
} from '../tabs/vibration-integrity-run-controller.js';
import {
  FIT_RUN_EVIDENCE_SCHEMA,
  buildVibrationIntegrityRunEvidence,
  serializeVibrationIntegrityRunEvidence,
} from '../tabs/vibration-integrity-run-evidence.js';

function benchmarkRuntimeState() {
  const id = VIBRATION_FIT_UI_BENCHMARK_CASES[0].id;
  const loaded = buildLoadedVibrationIntegrityBenchmark(id);
  return {
    ...createVibrationIntegrityInputRuntimeState(),
    benchmark: { selectedId: id, loaded: loaded.loaded, detachedFromSource: false },
    tables: loaded.tables,
    files: loaded.files,
    allowLimitedExchange: loaded.allowLimitedExchange,
  };
}

async function currentBenchmarkState() {
  const state = benchmarkRuntimeState();
  const captured = captureVibrationIntegrityExecutionState(state);
  const executed = await executeVibrationIntegrityBenchmarkRun(
    captured,
    runVibrationFacilityFitBenchmarkFromTables,
  );
  return {
    ...state,
    resultState: 'CURRENT_RESULT',
    runSnapshot: Object.freeze({ ...executed.runSnapshot, runId: 'FIT-RUN-TEST-001' }),
    envelope: executed.envelope,
  };
}

async function currentScreeningState() {
  const state = benchmarkRuntimeState();
  const captured = captureVibrationIntegrityExecutionState(state);
  const executed = await executeVibrationIntegrityRun(
    captured,
    runVibrationFacilityFitScreeningFromTables,
  );
  return {
    ...state,
    resultState: 'CURRENT_RESULT',
    runSnapshot: Object.freeze({ ...executed.runSnapshot, runId: 'FIT-RUN-SCREENING-001' }),
    envelope: executed.envelope,
  };
}

test('FIT run evidence binds audit and engineering identities to the central benchmark workflow', async () => {
  const state = await currentBenchmarkState();
  const evidence = await buildVibrationIntegrityRunEvidence(state);
  assert.equal(evidence.schema, FIT_RUN_EVIDENCE_SCHEMA);
  assert.equal(evidence.calculationId, 'VIB.FIV.FLOW_TURBULENCE');
  assert.equal(evidence.qualificationMode, 'benchmark');
  assert.equal(evidence.authority.engineeringAuthority, 'NONE');
  assert.equal(evidence.authority.screeningAuthorized, false);
  assert.equal(evidence.authority.designAuthority, false);
  assert.equal(evidence.run.snapshotHash, state.runSnapshot.snapshotHash);
  assert.equal(evidence.run.engineeringInputHash, state.runSnapshot.engineeringInputHash);
  assert.equal(evidence.run.canonicalInput, state.runSnapshot.canonicalInput);
  assert.equal(evidence.run.engineeringCanonicalInput, state.runSnapshot.engineeringCanonicalInput);
  assert.equal(evidence.sources.benchmark.id, state.benchmark.loaded.id);
  assert.equal(evidence.sources.benchmark.published.standardLof, state.benchmark.loaded.published.standardLof);
  assert.equal(evidence.execution.workflow.result.rows[0].centralResult.outputs.standardLof,
    state.envelope.workflow.result.rows[0].centralResult.outputs.standardLof);
  assert.equal(evidence.mechanismEvidence.schema, 'VibrationFacilityMechanismEvidence.v1');
  assert.equal(evidence.mechanismEvidence.run.runId, 'FIT-RUN-TEST-001');
  assert.equal(evidence.mechanismEvidence.run.scenarioSetKey, state.envelope.workflow.result.scenarioSetKey);
  assert.equal(evidence.mechanismEvidence.summary.currentCount, 0);
  assert.equal(evidence.mechanismEvidence.summary.completenessDetermined, false);
  assert.equal(evidence.mechanismEvidence.authority.blocksExecution, false);
  assert.equal(evidence.actionLifecycle.schema, 'VibrationFacilityActionLifecycle.v1');
  assert.equal(evidence.actionLifecycle.authority.determinesCompleteness, false);
  assert.equal(evidence.actionLifecycle.authority.blocksCalculation, false);
});

test('FIT run evidence preserves bounded screening authority without design authority', async () => {
  const state = await currentScreeningState();
  const evidence = await buildVibrationIntegrityRunEvidence(state);
  assert.equal(evidence.qualificationMode, 'screening');
  assert.equal(evidence.authority.engineeringAuthority, 'SCREENING');
  assert.equal(evidence.authority.screeningAuthorized, true);
  assert.equal(evidence.authority.designAuthority, false);
  assert.equal(evidence.execution.workflow.result.rows[0].status, 'CALCULATED_SCREENING');
  assert.equal(evidence.execution.workflow.result.rows[0].centralResult.qualification.effective, 'SCREENING');
  assert.equal(evidence.execution.workflow.result.rows[0].centralResult.qualification.designAuthority, false);
  assert.equal(evidence.mechanismEvidence.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(evidence.mechanismEvidence.authority.designAuthority, false);
  assert.equal(evidence.actionLifecycle.authority.engineeringAuthority, 'NONE');
  assert.equal(evidence.actionLifecycle.authority.designAuthority, false);
});

test('FIT run evidence serializer round-trips the governed package', async () => {
  const state = await currentBenchmarkState();
  const serialized = await serializeVibrationIntegrityRunEvidence(state);
  const parsed = JSON.parse(serialized);
  assert.equal(parsed.schema, FIT_RUN_EVIDENCE_SCHEMA);
  assert.equal(parsed.run.runId, 'FIT-RUN-TEST-001');
  assert.match(parsed.run.snapshotHash, /^[0-9a-f]{64}$/u);
  assert.match(parsed.run.engineeringInputHash, /^[0-9a-f]{64}$/u);
  assert.equal(parsed.execution.workflow.result.calculationId, 'VIB.FIV.FLOW_TURBULENCE');
  assert.equal(parsed.mechanismEvidence.run.runId, 'FIT-RUN-TEST-001');
  assert.equal(parsed.mechanismEvidence.summary.governingResultDetermined, false);
  assert.equal(parsed.actionLifecycle.schema, 'VibrationFacilityActionLifecycle.v1');
  assert.equal(serialized.endsWith('\n'), true);
});

test('FIT run evidence rejects stale results', async () => {
  const state = await currentBenchmarkState();
  await assert.rejects(
    () => buildVibrationIntegrityRunEvidence({ ...state, resultState: 'STALE_RESULT' }),
    (error) => error?.code === 'FIT_RUN_EVIDENCE_RESULT_NOT_CURRENT',
  );
});

test('FIT run evidence detects audit and engineering canonical drift', async () => {
  const state = await currentBenchmarkState();
  const auditDrift = { ...state.runSnapshot, canonicalInput: '{"tampered":true}' };
  await assert.rejects(
    () => buildVibrationIntegrityRunEvidence({ ...state, runSnapshot: auditDrift }),
    (error) => error?.code === 'FIT_RUN_EVIDENCE_SNAPSHOT_DRIFT',
  );

  const engineeringDrift = { ...state.runSnapshot, engineeringCanonicalInput: '{"tampered":true}' };
  await assert.rejects(
    () => buildVibrationIntegrityRunEvidence({ ...state, runSnapshot: engineeringDrift }),
    (error) => error?.code === 'FIT_RUN_EVIDENCE_SNAPSHOT_DRIFT',
  );
});

test('FIT run evidence cryptographically rejects altered snapshot hashes', async () => {
  const state = await currentBenchmarkState();
  const runSnapshot = { ...state.runSnapshot, engineeringInputHash: '0'.repeat(64) };
  await assert.rejects(
    () => buildVibrationIntegrityRunEvidence({ ...state, runSnapshot }),
    (error) => error?.code === 'FIT_RUN_EVIDENCE_HASH_MISMATCH',
  );
});
