import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { combineSbcType3Terms } from '../converters/vibration/sbc/type3-combination.js';

const custodyUrl = new URL(
  '../ValidationRecords/VibrationSBC/ProductionFreeze/SBC-PF-007-benchmark-custody.json',
  import.meta.url,
);
const priorHarnessUrl = new URL(
  '../ValidationRecords/VibrationSBC/ProductionFreeze/SBC-PF-006-browser-harness.json',
  import.meta.url,
);
const sourceTraceUrl = new URL('../docs/vibration/SBC-source-trace-register-v1.md', import.meta.url);
const combinationUrl = new URL('../converters/vibration/sbc/type3-combination.js', import.meta.url);
const masterCandidateUrl = new URL('../converters/vibration/sbc/type3-master-assisted-candidate.js', import.meta.url);

async function json(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

function closeEnough(actual, expected, tolerance) {
  return Math.abs(Number(actual) - Number(expected)) <= Number(tolerance);
}

function independentD7(vector) {
  const firstGeometryLof = Math.max(vector.c, vector.d, vector.e);
  const firstModifier = Math.min(firstGeometryLof, vector.firstLocationLof);
  const subsequentGeometryLof = Math.max(vector.f, vector.g);
  const subsequentModifier = Math.min(subsequentGeometryLof, 1);
  const overallModifier = Math.max(firstModifier, subsequentModifier);
  const mainlineAdjustedLof = vector.mainlineLof * vector.mainlineMultiplier;
  const finalLof = Math.min(mainlineAdjustedLof, overallModifier);
  return {
    firstGeometryLof,
    firstModifier,
    subsequentGeometryLof,
    subsequentModifier,
    overallModifier,
    mainlineAdjustedLof,
    finalLof,
  };
}

test('VIB-SBC-PROC-ORACLE-01 is candidate reproducibility custody only', async () => {
  const record = await json(custodyUrl);
  assert.equal(record.schema, 'VibrationSbcType3CandidateBenchmarkCustody.v1');
  assert.equal(record.oracle.id, 'VIB-SBC-PROC-ORACLE-01');
  assert.equal(record.oracle.referenceCase, 'EI-D7-SBC-TYPE3');
  assert.equal(record.oracle.purpose, 'CANDIDATE_REPRODUCIBILITY_ORACLE_ONLY');
  assert.equal(record.oracle.independentEngineeringQualification, false);
  assert.equal(record.oracle.calibrationUseAllowed, false);
  assert.deepEqual(record.authority, {
    engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    masterDataAuthority: false,
    sourceQualification: 'NOT_ESTABLISHED',
    candidateOnly: true,
  });
  assert.equal(record.validationPolicy.benchmarkParityDoesNotAuthorizeScreening, true);
  assert.equal(record.validationPolicy.missingExecutionEvidence, 'NOT_FROZEN');
});

test('SBC benchmark custody exactly retains the prior EI-D7 browser oracle', async () => {
  const record = await json(custodyUrl);
  const retained = await json(priorHarnessUrl);
  const vector = record.combinationVector;
  const oracle = retained.oracle;
  assert.equal(oracle.id, 'EI-D7-SBC-TYPE3');
  assert.deepEqual(
    {
      c: vector.c,
      d: vector.d,
      e: vector.e,
      f: vector.f,
      g: vector.g,
      firstLocationLof: vector.firstLocationLof,
      mainlineMultiplier: vector.mainlineMultiplier,
      finalLof: vector.expected.finalLof,
    },
    {
      c: oracle.c,
      d: oracle.d,
      e: oracle.e,
      f: oracle.f,
      g: oracle.g,
      firstLocationLof: oracle.firstLocationLof,
      mainlineMultiplier: oracle.mainlineMultiplier,
      finalLof: oracle.finalLof,
    },
  );
  assert.equal(retained.authority.engineeringAuthority, 'NONE');
  assert.equal(retained.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(retained.authority.masterDataAuthority, false);
});

test('independent D7 arithmetic reproduces every retained Type-3 combination intermediate', async () => {
  const record = await json(custodyUrl);
  const vector = record.combinationVector;
  const expected = vector.expected;
  const actual = independentD7(vector);
  for (const key of Object.keys(expected)) {
    assert.equal(
      closeEnough(actual[key], expected[key], vector.absoluteTolerance),
      true,
      `${key}: expected ${expected[key]}, got ${actual[key]}`,
    );
  }
  assert.equal(actual.finalLof, 0.7);
});

test('production Type-3 combination kernel reproduces VIB-SBC-PROC-ORACLE-01 without authority promotion', async () => {
  const record = await json(custodyUrl);
  const vector = record.combinationVector;
  const result = combineSbcType3Terms({
    hasMass: vector.firstSpanHasUnsupportedMass,
    c: vector.c,
    d: vector.d,
    e: vector.e,
    firstLocation: vector.firstLocationLof,
    f: vector.f,
    g: vector.g,
    mainlineLof: vector.mainlineLof,
    multiplier: vector.mainlineMultiplier,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'CALCULATED');
  assert.equal(closeEnough(result.firstSpan.geometryLof, vector.expected.firstGeometryLof, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.firstSpan.modifier, vector.expected.firstModifier, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.subsequentSpans.geometryLof, vector.expected.subsequentGeometryLof, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.subsequentSpans.modifier, vector.expected.subsequentModifier, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.overallModifier, vector.expected.overallModifier, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.mainline.adjustedLof, vector.expected.mainlineAdjustedLof, vector.absoluteTolerance), true);
  assert.equal(closeEnough(result.lof, vector.expected.finalLof, vector.absoluteTolerance), true);
});

test('D7 source/curve quarantine remains explicit and production cannot import benchmark custody', async () => {
  const record = await json(custodyUrl);
  const trace = await readFile(sourceTraceUrl, 'utf8');
  const combination = await readFile(combinationUrl, 'utf8');
  const masterCandidate = await readFile(masterCandidateUrl, 'utf8');

  assert.match(trace, /D7 is an oracle, never calibration data/u);
  assert.match(trace, /T3 curves remain `BLOCKED_SOURCE_DATA_CONFLICT`/u);
  assert.equal(record.curveCustody.runtimeCurveActivation, false);
  assert.equal(record.curveCustody.masterPublicationAuthorized, false);
  for (const term of ['d', 'f', 'g']) {
    assert.equal(record.curveCustody[term].evidenceOrigin, 'USER_PROJECT_EXACT_CURVE_READ');
    assert.equal(record.curveCustody[term].publicationState, 'BLOCKED_SOURCE_DATA_CONFLICT');
  }
  assert.doesNotMatch(combination, /SBC-PF-007-benchmark-custody/u);
  assert.doesNotMatch(masterCandidate, /SBC-PF-007-benchmark-custody/u);
  assert.doesNotMatch(combination, /VIB-SBC-PROC-ORACLE-01/u);
  assert.doesNotMatch(masterCandidate, /VIB-SBC-PROC-ORACLE-01/u);
});
