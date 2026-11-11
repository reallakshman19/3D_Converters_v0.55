import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIV_LINE_AGGREGATION_RULE_ID,
  aggregateAivAssessmentResultsToLineCases,
} from '../converters/vibration/aiv/aiv-line-aggregation.js';

function result({ id, lof, line = 'L-100', caseId = 'NORMAL', sources = ['SRC-1'], mode = 'screening' }) {
  const screening = mode === 'screening';
  return {
    schema: 'AivAssessmentResult.v1',
    resultScope: 'ASSESSMENT',
    calculationId: 'VIB.AIV.ACOUSTIC',
    status: screening ? 'SCREENING_CALCULATED' : 'BENCHMARK_CALCULATED',
    assessmentCanonicalId: id,
    line,
    caseId,
    contributingSourceCanonicalIds: sources,
    lof,
    authority: {
      calculationState: 'IMPLEMENTED',
      qualificationState: screening ? 'SCREENING' : 'BENCHMARK_ONLY',
      engineeringAuthority: screening ? 'SCREENING' : 'BENCHMARK_ONLY',
      screeningAuthority: screening ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
      designAuthority: false,
    },
  };
}

test('EI T2.7 line/case candidate uses the greatest discontinuity assessment LOF', () => {
  const summaries = aggregateAivAssessmentResultsToLineCases([
    result({ id: 'A-01', lof: 0.29, sources: ['S-1'] }),
    result({ id: 'A-02', lof: 0.82, sources: ['S-2'] }),
    result({ id: 'A-03', lof: 0.41, sources: ['S-3'] }),
  ], { qualificationMode: 'screening' });
  assert.equal(summaries.length, 1);
  const summary = summaries[0];
  assert.equal(summary.lof, 0.82);
  assert.equal(summary.maxAssessmentLof, 0.82);
  assert.equal(summary.controllingAssessmentCanonicalId, 'A-02');
  assert.deepEqual(summary.controllingSourceCanonicalIds, ['S-2']);
  assert.equal(summary.aggregationBasis, AIV_LINE_AGGREGATION_RULE_ID);
  assert.equal(summary.aggregationRuleQualification, 'QUALIFIED_FOR_DERIVATION');
});

test('line/case groups are isolated and controlling ties are deterministic', () => {
  const summaries = aggregateAivAssessmentResultsToLineCases([
    result({ id: 'B-02', lof: 0.5, line: 'L-200', caseId: 'CASE-B', sources: ['S-2'] }),
    result({ id: 'B-01', lof: 0.5, line: 'L-200', caseId: 'CASE-B', sources: ['S-1'] }),
    result({ id: 'A-01', lof: 0.3, line: 'L-100', caseId: 'CASE-A', sources: ['S-3'] }),
  ], { qualificationMode: 'screening' });
  assert.deepEqual(summaries.map((item) => [item.line, item.caseId]), [
    ['L-100', 'CASE-A'],
    ['L-200', 'CASE-B'],
  ]);
  assert.equal(summaries[1].controllingAssessmentCanonicalId, 'B-01');
  assert.deepEqual(summaries[1].sourceCanonicalIds, ['S-1', 'S-2']);
});

test('qualified reduction remains fail-closed for screening until discontinuity inventory completeness is proven', () => {
  const [summary] = aggregateAivAssessmentResultsToLineCases([
    result({ id: 'A-01', lof: 0.29 }),
  ], { qualificationMode: 'screening' });
  assert.equal(summary.assessmentInventoryCompleteness, 'UNVERIFIED');
  assert.equal(summary.authoritativeForScreening, false);
  assert.equal(summary.screeningAuthorityBlocker, 'AIV_WELDED_DISCONTINUITY_INVENTORY_COMPLETENESS_UNPROVEN');
  assert.equal(summary.authority.qualificationState, 'QUALIFIED_REDUCTION_RULE');
  assert.equal(summary.authority.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(summary.authority.designAuthority, false);
});

test('benchmark execution uses the same reduction rule without creating screening authority', () => {
  const [summary] = aggregateAivAssessmentResultsToLineCases([
    result({ id: 'A-01', lof: 0.29, mode: 'benchmark' }),
    result({ id: 'A-02', lof: 1.1, mode: 'benchmark' }),
  ], { qualificationMode: 'benchmark' });
  assert.equal(summary.status, 'BENCHMARK_DERIVED_CANDIDATE');
  assert.equal(summary.lof, 1.1);
  assert.equal(summary.authoritativeForScreening, false);
});

test('invalid assessment authority or numeric LOF fails closed', () => {
  const unauthorized = result({ id: 'A-01', lof: 0.29 });
  unauthorized.authority.screeningAuthority = 'NOT_AUTHORIZED';
  assert.throws(
    () => aggregateAivAssessmentResultsToLineCases([unauthorized], { qualificationMode: 'screening' }),
    /AIV_LINE_AGGREGATION_SCREENING_AUTHORITY_REQUIRED/u,
  );
  assert.throws(
    () => aggregateAivAssessmentResultsToLineCases([
      result({ id: 'A-02', lof: Number.NaN }),
    ], { qualificationMode: 'screening' }),
    /assessmentResult\.lof must be a finite non-negative number/u,
  );
});

test('reducer has no configurable worked-example line LOF input', () => {
  const [summary] = aggregateAivAssessmentResultsToLineCases([
    result({ id: 'A-01', lof: 0.29 }),
  ], { qualificationMode: 'screening' });
  assert.equal(summary.lof, 0.29);
  assert.equal(Object.hasOwn(summary, 'configuredLineLof'), false);
  assert.equal(JSON.stringify(summary).includes('workedExampleReliefLineLof'), false);
});
