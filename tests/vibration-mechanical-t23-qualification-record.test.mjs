import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  MECHANICAL_T23_CONTROLLED_SOURCE,
  MECHANICAL_T23_DIRECT_BASELINE_ROWS,
  MECHANICAL_T23_DYNAMIC_REDUCTION_RULE,
  MECHANICAL_T23_SHARED_SUPPORT_RULE,
  evaluateMechanicalT23DirectBaseline,
} from '../converters/vibration/mechanical/t23-method.js';

const recordUrl = new URL('../ValidationRecords/VibrationIntegrity/mechanical-t23-direct-screening-qualification-v1.json', import.meta.url);
const retainedUrl = new URL('../ValidationRecords/VibrationIntegrity/ei-aviff-multimechanism-validation-v1.json', import.meta.url);
const methodUrl = new URL('../converters/vibration/mechanical/t23-method.js', import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

test('Mechanical T2.3 qualification record is closed to direct Table T2-3 screening authority', async () => {
  const record = await json(recordUrl);
  assert.equal(record.schema, 'MechanicalT23DirectScreeningQualification.v1');
  assert.equal(record.methodId, 'VIB.MECHANICAL.T2_3.BASELINE');
  assert.equal(record.methodRevision, 'ei-aviff2-t2-3-direct-baseline-v1');
  assert.deepEqual(record.qualificationDecision, {
    state: 'SCREENING',
    engineeringAuthority: 'SCREENING',
    screeningAuthority: 'AUTHORIZED',
    authorityScope: 'DIRECT_TABLE_T2_3_BASELINE_ONLY',
    designAuthority: false,
    ownerAuthorization: {
      pullRequest: 640,
      mergeCommit: 'd6524db920641d45f7e9536c2024a8eae5f290be',
      decision: 'BOUND_DIRECT_TABLE_T2_3_SCREENING_ONLY',
    },
  });
  assert.equal(record.validationPolicy.repositoryNativeFocusedTests, 'REQUIRED_AT_RELEASE_GATE');
  assert.equal(record.validationPolicy.fullRepositoryNodeSuite, 'REQUIRED_AT_RELEASE_GATE');
  assert.equal(record.validationPolicy.benchmarkedChromiumJourney, 'REQUIRED_AT_RELEASE_GATE');
  assert.equal(record.validationPolicy.missingExecutionEvidence, 'NOT_FROZEN');
});

test('qualification custody matches the controlled source and all nine production direct baselines', async () => {
  const record = await json(recordUrl);
  assert.equal(record.controlledSource.publisher, MECHANICAL_T23_CONTROLLED_SOURCE.publisher);
  assert.equal(record.controlledSource.publication, MECHANICAL_T23_CONTROLLED_SOURCE.publication);
  assert.equal(record.controlledSource.edition, MECHANICAL_T23_CONTROLLED_SOURCE.edition);
  assert.equal(record.controlledSource.gitBlobSha1, MECHANICAL_T23_CONTROLLED_SOURCE.gitBlobSha1);
  assert.equal(record.controlledSource.sectionId, MECHANICAL_T23_CONTROLLED_SOURCE.sectionId);
  assert.equal(record.controlledSource.tableId, MECHANICAL_T23_CONTROLLED_SOURCE.tableId);
  assert.equal(record.controlledSource.printedPage, MECHANICAL_T23_CONTROLLED_SOURCE.printedPage);
  assert.deepEqual(
    record.directTableBaselines.map(({ sourceKey, expectedLof }) => ({ sourceKey, expectedLof })),
    MECHANICAL_T23_DIRECT_BASELINE_ROWS.map(({ sourceKey, baselineLof }) => ({ sourceKey, expectedLof: baselineLof })),
  );
});

test('VIB-MECH-PROC-ORACLE-01 is independent custody and production reproduces D2.4 exactly', async () => {
  const record = await json(recordUrl);
  const retained = await json(retainedUrl);
  const oracle = record.independentOracle;
  assert.equal(oracle.id, 'VIB-MECH-PROC-ORACLE-01');
  assert.equal(oracle.absoluteTolerance, 0);

  const retainedMechanical = retained.cases.filter((item) => item.mechanism === 'MECHANICAL_EXCITATION');
  assert.equal(retainedMechanical.length, 4);
  for (const item of retainedMechanical) {
    assert.equal(item.status, 'PASS');
    assert.equal(item.steps.find((step) => step.id === 'governingLof')?.expected, 0.4);
    assert.equal(item.steps.find((step) => step.id === 'governingLof')?.actual, 0.4);
  }

  const result = evaluateMechanicalT23DirectBaseline(oracle.inputs.map((item) => item.sourceKey));
  assert.deepEqual(result.rows.map(({ sourceKey, baselineLof }) => ({ sourceKey, expectedLof: baselineLof })), oracle.inputs);
  assert.equal(result.governingLof, oracle.expectedGoverningLof);
  assert.equal(result.governingSourceKey, oracle.expectedGoverningSourceKey);
  assert.equal(result.authority.screeningAuthority, 'AUTHORIZED');
  assert.equal(result.authority.authorityScope, 'DIRECT_TABLE_T2_3_BASELINE_ONLY');
});

test('shared-support and post-dynamic-analysis reduction are quantified exclusions, not hidden production branches', async () => {
  const record = await json(recordUrl);
  assert.equal(record.excludedRules.sharedSupportTransfer.sourceKey, MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey);
  assert.equal(record.excludedRules.sharedSupportTransfer.adjacentLofThreshold, MECHANICAL_T23_SHARED_SUPPORT_RULE.adjacentLofThreshold);
  assert.equal(record.excludedRules.sharedSupportTransfer.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(MECHANICAL_T23_SHARED_SUPPORT_RULE.screeningAuthority, 'NOT_AUTHORIZED');

  assert.deepEqual(record.excludedRules.postDynamicAnalysisReduction.applicableSourceKeys, MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.applicableSourceKeys);
  assert.equal(record.excludedRules.postDynamicAnalysisReduction.reducedLof, 0.4);
  assert.equal(record.excludedRules.postDynamicAnalysisReduction.reducedLof, MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.reducedLof);
  assert.equal(record.excludedRules.postDynamicAnalysisReduction.prerequisite, MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.prerequisite);
  assert.equal(record.excludedRules.postDynamicAnalysisReduction.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(MECHANICAL_T23_DYNAMIC_REDUCTION_RULE.screeningAuthority, 'NOT_AUTHORIZED');

  assert.throws(
    () => evaluateMechanicalT23DirectBaseline([MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey]),
    /MECHANICAL_T23_SHARED_SUPPORT_REQUIRES_ADJACENT_LOF/u,
  );
  const reciprocating = evaluateMechanicalT23DirectBaseline(['RECIP_PD_COMPRESSOR_OR_PUMP']);
  assert.equal(reciprocating.governingLof, 0.9);
  assert.equal(reciprocating.authority.dynamicReductionAuthorized, false);
});

test('production Mechanical method does not import qualification-record or benchmark custody', async () => {
  const methodSource = await readFile(methodUrl, 'utf8');
  assert.doesNotMatch(methodSource, /ValidationRecords/u);
  assert.doesNotMatch(methodSource, /VIB-MECH-PROC-ORACLE-01/u);
  assert.doesNotMatch(methodSource, /ei-aviff-multimechanism-validation-v1/u);
});
