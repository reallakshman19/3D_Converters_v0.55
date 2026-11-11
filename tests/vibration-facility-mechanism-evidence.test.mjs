import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAivFacilityScenarioExecutionPlan } from '../converters/vibration/aiv/aiv-facility-scenario-plan.js';
import {
  VIBRATION_OPERATING_SCENARIO_DECLARATION, assembleVibrationIntegrityDataset, buildVibrationOperatingScenario,
} from '../converters/vibration/dataset/index.js';
import {
  VIBRATION_FACILITY_MECHANISM_EVIDENCE_AUTHORITY,
  VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCHEMA,
  buildVibrationFacilityMechanismEvidence,
} from '../converters/vibration/facility/mechanism-evidence.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';
import { createVibrationFacilityScenarioHandoff } from '../converters/vibration/facility/scenario-handoff.js';
import { mechanicalFacilityScope, mechanicalFacilityScopeId } from '../converters/vibration/mechanical/facility.js';
import { sbcFacilityScopeId } from '../converters/vibration/sbc/facility.js';
import { VIBRATION_TABLE_EXCHANGE_INTEGRITY, VIBRATION_TABLE_EXCHANGE_SCHEMA } from '../converters/vibration/exchange/schema.js';

function exchange(datasetId = 'plant-a') {
  return {
    schema: VIBRATION_TABLE_EXCHANGE_SCHEMA, completeExchange: true,
    integrityStatus: VIBRATION_TABLE_EXCHANGE_INTEGRITY.DECLARED_NOT_REVERIFIED,
    authority: {
      canonicalHash: `sha256:${datasetId}-canonical`, projectionHash: `sha256:${datasetId}-projection`,
      sourceHash: `sha256:${datasetId}-source`, datasetId, datasetVersion: 'rev-1',
    },
    sourceFileName: `${datasetId}.xlsx`,
    elements: [
      { canonicalId: 'RV-101', line: 'L-SOURCE', type: 'VALVE' },
      { canonicalId: 'CAN-1', line: 'L-ASSESS', type: 'PIPE' },
    ],
  };
}

function operatingCases(sourceFlow = 100, assessmentFlow = 80) {
  return [
    {
      caseId: 'NORMAL', line: 'L-SOURCE', phase: 'GAS', source: 'HMB-1', sourceRevision: 'A',
      recordId: 'HMB-SOURCE-NORMAL', massFlow: { value: sourceFlow, unit: 'kg/s' },
      pressure: { value: 20, unit: 'barg', reference: 'gauge' },
    },
    {
      caseId: 'NORMAL', line: 'L-ASSESS', phase: 'GAS', source: 'HMB-1', sourceRevision: 'A',
      recordId: 'HMB-ASSESS-NORMAL', massFlow: { value: assessmentFlow, unit: 'kg/s' },
      pressure: { value: 15, unit: 'barg', reference: 'gauge' },
    },
  ];
}

function dataset(sourceFlow = 100, assessmentFlow = 80) {
  return assembleVibrationIntegrityDataset({ exchange: exchange(), operatingCases: operatingCases(sourceFlow, assessmentFlow), enrichment: [] });
}

function scenarios(sourceFlow = 100, assessmentFlow = 80) {
  const source = dataset(sourceFlow, assessmentFlow);
  return ['L-SOURCE', 'L-ASSESS'].map((line) => buildVibrationOperatingScenario(source, {
    line, caseId: 'NORMAL', coherenceDeclaration: VIBRATION_OPERATING_SCENARIO_DECLARATION,
  }));
}

function executionBasis(scenario) {
  return Object.freeze({
    schema: 'VibrationScenarioExecutionBasis.v1', scenarioId: scenario.scenarioId,
    scenarioSnapshotHash: scenario.snapshotHash, datasetId: scenario.datasetId,
    line: scenario.line, caseId: scenario.caseId,
  });
}

function fixture(sourceFlow = 100, assessmentFlow = 80, runId = 'FIT-RUN-1') {
  const operatingScenarios = scenarios(sourceFlow, assessmentFlow);
  const handoff = createVibrationFacilityScenarioHandoff({ operatingScenarios, runId });
  const assessmentScenario = operatingScenarios.find((item) => item.line === 'L-ASSESS');
  const row = Object.freeze({
    line: 'L-ASSESS', caseId: 'NORMAL', canonicalId: 'CAN-1', scenarioSetKey: handoff.scenarioSetKey,
    scenarioExecutionBasis: executionBasis(assessmentScenario),
  });
  const runBasis = createVibrationFacilityRunBasis({ runId, datasetId: 'plant-a', scenarioSetKey: handoff.scenarioSetKey });
  return { operatingScenarios, handoff, row, runBasis };
}

function readiness() {
  return {
    schema: 'AivReadinessTableEnvelope.v2', readiness: { rows: [{
      rowKey: JSON.stringify(['RV-101', 'CAN-1', 'NORMAL']), status: 'READY_FOR_QUALIFICATION',
      sourceCanonicalId: 'RV-101', assessmentCanonicalId: 'CAN-1', sourceLine: 'L-SOURCE',
      assessmentLine: 'L-ASSESS', caseId: 'NORMAL',
    }] },
  };
}

function mechanical(base, scenarioBasis = base.row.scenarioExecutionBasis, runBasis = base.runBasis) {
  return Object.freeze({
    schema: 'MechanicalFacilityScreeningResult.v1', status: 'CALCULATED_SCREENING',
    scope: mechanicalFacilityScope(base.row), sourceKeys: Object.freeze(['ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW']),
    governingLof: 0.4, governingSourceKey: 'ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW', rows: Object.freeze([]),
    provenance: Object.freeze({}), methodId: 'VIB.MECHANICAL.T2_3.BASELINE', methodRevision: 'test',
    authority: Object.freeze({
      engineeringAuthority: 'SCREENING', screeningAuthority: 'AUTHORIZED',
      authorityScope: 'DIRECT_TABLE_T2_3_BASELINE_ONLY', dynamicReductionAuthorized: false,
      sharedSupportTransferAuthorized: false, designAuthority: false,
    }),
    scenarioExecutionBasis: scenarioBasis, facilityRunBasis: runBasis,
  });
}

function sbc(base, scenarioBasis = base.row.scenarioExecutionBasis, runBasis = base.runBasis) {
  return Object.freeze({
    schema: 'SbcType3Candidate.v1', ok: true, status: 'CALCULATED_CANDIDATE',
    scopeId: sbcFacilityScopeId(base.row), lof: 0.7,
    authority: Object.freeze({
      engineeringAuthority: 'NONE', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false, masterDataAuthority: false,
    }),
    scenarioExecutionBasis: scenarioBasis, facilityRunBasis: runBasis,
  });
}

function linkedAivSession(handoff, lof = 0.42, resultState = 'CURRENT_RESULT') {
  const plan = buildAivFacilityScenarioExecutionPlan({ handoff, readinessEnvelope: readiness() });
  return Object.freeze({
    schema: 'AivScreeningSessionEvidence.v1', executionContext: 'FACILITY_LINKED', resultState,
    scenarioExecutionPlan: plan,
    screeningResult: Object.freeze({ outputs: Object.freeze({ assessmentResults: Object.freeze([Object.freeze({
      schema: 'AivAssessmentResult.v1', status: 'SCREENING_CALCULATED', assessmentCanonicalId: 'CAN-1',
      line: 'L-ASSESS', caseId: 'NORMAL', lof,
      authority: Object.freeze({ engineeringAuthority: 'SCREENING', screeningAuthority: 'AUTHORIZED', designAuthority: false }),
    })]) }) }),
  });
}

function build(options = {}) {
  const base = options.base ?? fixture();
  return buildVibrationFacilityMechanismEvidence({
    runId: options.runId ?? base.runBasis.runId, datasetId: 'plant-a', scenarioSetKey: base.handoff.scenarioSetKey,
    registerRows: options.registerRows ?? [base.row], operatingScenarios: options.operatingScenarios ?? base.operatingScenarios,
    mechanicalResultsByScope: options.mechanicalResultsByScope ?? {},
    sbcResultsByScope: options.sbcResultsByScope ?? {}, aivSession: options.aivSession ?? null,
  });
}

test('mechanism evidence envelope has no applicability, completeness, governing or blocking authority', () => {
  const evidence = build();
  assert.equal(evidence.schema, VIBRATION_FACILITY_MECHANISM_EVIDENCE_SCHEMA);
  assert.deepEqual(evidence.authority, VIBRATION_FACILITY_MECHANISM_EVIDENCE_AUTHORITY);
  assert.equal(evidence.summary.currentCount, 0);
  assert.equal(evidence.summary.completenessDetermined, false);
  assert.equal(evidence.summary.governingResultDetermined, false);
  assert.equal(evidence.authority.blocksExecution, false);
  assert.equal(evidence.authority.blocksNavigation, false);
});

test('exact Mechanical and SBC facility run custody is admitted while preserving authority tiers', () => {
  const base = fixture();
  const evidence = build({
    base,
    mechanicalResultsByScope: { [mechanicalFacilityScopeId(base.row)]: mechanical(base) },
    sbcResultsByScope: { [sbcFacilityScopeId(base.row)]: sbc(base) },
  });
  assert.equal(evidence.currentEvidence.length, 2);
  const mech = evidence.currentEvidence.find((item) => item.mechanismId === 'mechanicalExcitation');
  const smallBore = evidence.currentEvidence.find((item) => item.mechanismId === 'smallBoreConnections');
  assert.equal(mech.evidenceTier, 'SCREENING');
  assert.equal(mech.authority.screeningAuthority, 'AUTHORIZED');
  assert.equal(smallBore.evidenceTier, 'CANDIDATE');
  assert.equal(smallBore.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(evidence.excludedEvidence.length, 0);
});

test('stale Mechanical and SBC snapshots are excluded without retaining numerical values', () => {
  const base = fixture();
  const stale = { ...base.row.scenarioExecutionBasis, scenarioSnapshotHash: 'stale-snapshot' };
  const evidence = build({
    base,
    mechanicalResultsByScope: { [mechanicalFacilityScopeId(base.row)]: mechanical(base, stale) },
    sbcResultsByScope: { [sbcFacilityScopeId(base.row)]: sbc(base, stale) },
  });
  assert.equal(evidence.currentEvidence.length, 0);
  assert(evidence.excludedEvidence.every((item) => item.reason === 'SCENARIO_BASIS_MISMATCH'));
  assert(evidence.excludedEvidence.every((item) => item.numericalValueRetained === false));
});

test('identical facility rerun still excludes prior Mechanical and SBC results by runId', () => {
  const oldBase = fixture(100, 80, 'FIT-RUN-1');
  const newBase = fixture(100, 80, 'FIT-RUN-2');
  assert.equal(oldBase.handoff.scenarioSetKey, newBase.handoff.scenarioSetKey);
  assert.equal(oldBase.row.scenarioExecutionBasis.scenarioSnapshotHash, newBase.row.scenarioExecutionBasis.scenarioSnapshotHash);
  const evidence = build({
    base: newBase, runId: 'FIT-RUN-2',
    mechanicalResultsByScope: { [mechanicalFacilityScopeId(newBase.row)]: mechanical(newBase, newBase.row.scenarioExecutionBasis, oldBase.runBasis) },
    sbcResultsByScope: { [sbcFacilityScopeId(newBase.row)]: sbc(newBase, newBase.row.scenarioExecutionBasis, oldBase.runBasis) },
  });
  assert.equal(evidence.currentEvidence.length, 0);
  assert.equal(evidence.excludedEvidence.length, 2);
  assert(evidence.excludedEvidence.every((item) => item.reason === 'FACILITY_RUN_BASIS_MISMATCH'));
});

test('standalone AIV is excluded, not silently promoted to facility evidence', () => {
  const evidence = build({ aivSession: { schema: 'AivScreeningSessionEvidence.v1', executionContext: 'STANDALONE' } });
  assert.equal(evidence.currentEvidence.length, 0);
  assert.equal(evidence.excludedEvidence[0].reason, 'AIV_STANDALONE_NOT_FACILITY_EVIDENCE');
});

test('non-current linked AIV session is excluded even when its facility plan still matches', () => {
  const base = fixture();
  const evidence = build({ base, aivSession: linkedAivSession(base.handoff, 0.42, 'STALE_RESULT') });
  assert.equal(evidence.currentEvidence.length, 0);
  assert.equal(evidence.excludedEvidence[0].reason, 'AIV_RESULT_NOT_CURRENT');
});

test('current facility-linked AIV is admitted at assessment scope only', () => {
  const base = fixture();
  const evidence = build({ base, aivSession: linkedAivSession(base.handoff) });
  assert.equal(evidence.currentEvidence.length, 1);
  assert.equal(evidence.currentEvidence[0].evidenceTier, 'ASSESSMENT_SCREENING');
  assert.equal(evidence.currentEvidence[0].value.lof, 0.42);
  assert.equal(evidence.summary.governingResultDetermined, false);
});

test('identical rerun excludes prior AIV by facilityRunId even when scenario set is unchanged', () => {
  const oldBase = fixture(100, 80, 'FIT-RUN-1');
  const newBase = fixture(100, 80, 'FIT-RUN-2');
  const evidence = build({ base: newBase, runId: 'FIT-RUN-2', aivSession: linkedAivSession(oldBase.handoff) });
  assert.equal(evidence.currentEvidence.length, 0);
  assert.equal(evidence.excludedEvidence[0].reason, 'AIV_FACILITY_RUN_STALE');
});

test('source-line-only drift excludes linked AIV when runId is held constant', () => {
  const oldBase = fixture(100, 80, 'FIT-RUN-1');
  const newerBase = fixture(101, 80, 'FIT-RUN-1');
  assert.equal(oldBase.row.scenarioExecutionBasis.scenarioSnapshotHash, newerBase.row.scenarioExecutionBasis.scenarioSnapshotHash);
  assert.notEqual(oldBase.handoff.scenarioSetKey, newerBase.handoff.scenarioSetKey);
  const evidence = build({ base: newerBase, runId: 'FIT-RUN-1', aivSession: linkedAivSession(oldBase.handoff) });
  assert.equal(evidence.currentEvidence.length, 0);
  assert.equal(evidence.excludedEvidence[0].reason, 'AIV_FACILITY_SCENARIO_SET_STALE');
});

test('FIT-incomplete row can still admit same-run Mechanical evidence from the current OperatingScenario', () => {
  const base = fixture();
  const incomplete = Object.freeze({
    line: 'L-ASSESS', caseId: 'NORMAL', canonicalId: 'CAN-2', scenarioSetKey: base.handoff.scenarioSetKey,
  });
  const assessmentScenario = base.operatingScenarios.find((item) => item.line === 'L-ASSESS');
  const secondaryBase = { ...base, row: Object.freeze({ ...incomplete, scenarioExecutionBasis: executionBasis(assessmentScenario) }) };
  const evidence = build({
    base,
    registerRows: [incomplete],
    mechanicalResultsByScope: { [mechanicalFacilityScopeId(incomplete)]: mechanical(secondaryBase) },
  });
  assert.equal(evidence.currentEvidence.length, 1);
  assert.equal(evidence.currentEvidence[0].mechanismId, 'mechanicalExcitation');
  assert.equal(evidence.currentEvidence[0].scope.canonicalId, 'CAN-2');
});

test('register row carrying a stale scenario basis fails closed against the workflow scenario', () => {
  const base = fixture();
  const staleRow = Object.freeze({
    ...base.row,
    scenarioExecutionBasis: Object.freeze({ ...base.row.scenarioExecutionBasis, scenarioSnapshotHash: 'stale-row-basis' }),
  });
  assert.throws(
    () => build({ base, registerRows: [staleRow] }),
    (error) => error.code === 'VIBRATION_FACILITY_MECHANISM_EVIDENCE_ROW_SCENARIO_MISMATCH',
  );
});

test('base register row from another scenario set fails closed', () => {
  const oldBase = fixture(100, 80, 'FIT-RUN-1');
  const newerBase = fixture(101, 80, 'FIT-RUN-2');
  assert.throws(
    () => buildVibrationFacilityMechanismEvidence({
      runId: 'FIT-RUN-2', datasetId: 'plant-a', scenarioSetKey: newerBase.handoff.scenarioSetKey,
      registerRows: [oldBase.row], operatingScenarios: newerBase.operatingScenarios,
    }),
    (error) => error.code === 'VIBRATION_FACILITY_MECHANISM_EVIDENCE_BASE_RUN_MISMATCH',
  );
});
