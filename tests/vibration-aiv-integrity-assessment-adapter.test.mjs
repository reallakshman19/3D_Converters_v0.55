import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAivVibrationMechanismAssessmentSet } from '../converters/vibration/mechanisms/aiv.js';
import { reduceVibrationMechanismAssessmentSetToLineResult } from '../converters/vibration/mechanisms/reducers.js';

function screeningResult(overrides = {}) {
  const assessment = {
    schema: 'AivAssessmentResult.v1',
    resultScope: 'ASSESSMENT',
    calculationId: 'VIB.AIV.ACOUSTIC',
    status: 'SCREENING_CALCULATED',
    assessmentCanonicalId: 'CAN-AIV-1',
    assessmentType: 'WELDED_DISCONTINUITY',
    line: 'L-100',
    caseId: 'NORMAL',
    contributingSourceCanonicalIds: ['RV-101'],
    lof: 0.42,
    authority: {
      calculationState: 'IMPLEMENTED',
      qualificationState: 'SCREENING',
      engineeringAuthority: 'SCREENING',
      productionEquationAuthorized: true,
      screeningAuthority: 'AUTHORIZED',
      designAuthority: false,
    },
    ...overrides.assessment,
  };
  return {
    ok: true,
    calculationId: 'VIB.AIV.ACOUSTIC',
    outputs: {
      screeningResultScope: 'ASSESSMENT',
      assessmentResults: [assessment],
      lineCaseSummaries: [{
        schema: 'AivLineCaseSummary.v1',
        line: 'L-100', caseId: 'NORMAL', lof: 0.77,
        aggregationBasis: 'CONFIGURED_LINE_SCOPE_REFERENCE',
        authoritativeForScreening: false,
      }],
      ...overrides.outputs,
    },
    assessment: {
      resultScope: 'ASSESSMENT_SCREENING',
      screeningAuthority: 'AUTHORIZED',
      lineCaseSummaryAuthoritativeForScreening: false,
      designAuthority: false,
      ...overrides.containerAssessment,
    },
  };
}

const row = Object.freeze({ line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-AIV-1' });

test('qualified current AIV assessment maps by exact line/case/canonical identity', () => {
  const set = buildAivVibrationMechanismAssessmentSet({
    row,
    screeningResult: screeningResult(),
    resultState: 'CURRENT_RESULT',
  });
  assert.equal(set.mechanismId, 'aiv');
  assert.deepEqual(set.cardinality, { count: 1, kind: 'ONE' });
  const item = set.items[0];
  assert.equal(item.child.key, 'CAN-AIV-1');
  assert.equal(item.implementationState, 'IMPLEMENTED_SCREENING');
  assert.equal(item.assessmentState, 'CALCULATED');
  assert.equal(item.resultState, 'CURRENT_RESULT');
  assert.equal(item.qualification.effective, 'SCREENING');
  assert.equal(item.result.assessmentLof, 0.42);
  assert.equal(item.result.governingLof, null);
  assert.equal(item.result.aggregationEligible, false);
});

test('configured AIV line summary is not consumed as a mechanism governing result', () => {
  const set = buildAivVibrationMechanismAssessmentSet({
    row,
    screeningResult: screeningResult(),
    resultState: 'CURRENT_RESULT',
  });
  const lineResult = reduceVibrationMechanismAssessmentSetToLineResult(set);
  assert.equal(lineResult.state, 'INCOMPLETE');
  assert.equal(lineResult.governingLof, null);
  assert.equal(lineResult.aggregationEligible, false);
  assert.ok(lineResult.reasons.some((reason) => reason.includes('VALID_GOVERNING_LOF_REQUIRED')));
});

test('AIV adapter does not use line-only matches or a different canonical assessment', () => {
  const set = buildAivVibrationMechanismAssessmentSet({
    row: { ...row, canonicalId: 'CAN-OTHER' },
    screeningResult: screeningResult(),
    resultState: 'CURRENT_RESULT',
  });
  assert.deepEqual(set.cardinality, { count: 0, kind: 'ZERO' });
});

test('screening result currency must be explicit and cannot default to current', () => {
  assert.throws(
    () => buildAivVibrationMechanismAssessmentSet({ row, screeningResult: screeningResult() }),
    /AIV_INTEGRITY_RESULT_CURRENCY_REQUIRED:UNRUN/u,
  );
});

test('unauthorized or design-authority AIV evidence fails closed', () => {
  assert.throws(
    () => buildAivVibrationMechanismAssessmentSet({
      row,
      screeningResult: screeningResult({ containerAssessment: { designAuthority: true } }),
      resultState: 'CURRENT_RESULT',
    }),
    /AIV_INTEGRITY_SCREENING_AUTHORITY_INVALID/u,
  );
  assert.throws(
    () => buildAivVibrationMechanismAssessmentSet({
      row,
      screeningResult: screeningResult({ assessment: { authority: {
        calculationState: 'IMPLEMENTED', qualificationState: 'BENCHMARK_ONLY',
        engineeringAuthority: 'BENCHMARK_ONLY', screeningAuthority: 'NOT_AUTHORIZED', designAuthority: false,
      } } }),
      resultState: 'CURRENT_RESULT',
    }),
    /AIV_INTEGRITY_ASSESSMENT_RESULT_INVALID/u,
  );
});
