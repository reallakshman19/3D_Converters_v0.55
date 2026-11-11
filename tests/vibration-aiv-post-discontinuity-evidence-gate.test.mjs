import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AIV_DEFAULT_ASSUMPTION_PROFILE,
  updateAivAssumptionProfile,
} from '../converters/vibration/aiv/aiv-assumption-profile.js';
import { AIV_LINE_AGGREGATION_RULE_ID } from '../converters/vibration/aiv/aiv-line-aggregation.js';
import {
  AIV_POST_DISCONTINUITY_GATE_STATUS,
  buildAivPostDiscontinuityEvidenceGate,
} from '../converters/vibration/aiv/aiv-post-discontinuity-evidence-gate.js';

test('default configuration exposes the implemented qualified reduction rule without line screening authority', () => {
  const gate = buildAivPostDiscontinuityEvidenceGate();
  assert.equal(gate.status, AIV_POST_DISCONTINUITY_GATE_STATUS.REDUCTION_RULE_IMPLEMENTED_INVENTORY_UNVERIFIED);
  assert.equal(gate.readyForCandidateImplementation, true);
  assert.equal(gate.reductionRuleImplemented, true);
  assert.equal(gate.reductionRule.ruleId, AIV_LINE_AGGREGATION_RULE_ID);
  assert.equal(gate.reductionRule.qualification, 'QUALIFIED_FOR_DERIVATION');
  assert.equal(gate.authority.qualificationState, 'QUALIFIED_REDUCTION_RULE');
  assert.equal(gate.authority.screeningAuthority, 'NOT_AUTHORIZED');
});

test('scope boundary keeps D.2.3 first-discontinuity and full-line benchmark references separate', () => {
  const gate = buildAivPostDiscontinuityEvidenceGate();
  assert.equal(gate.scopeBoundary.firstDiscontinuityScope, 'ASSESSMENT');
  assert.equal(gate.scopeBoundary.derivedReportScope, 'LINE_CASE_SUMMARY');
  assert.equal(gate.scopeBoundary.d23FirstDiscontinuityLof, 0.29);
  assert.equal(gate.scopeBoundary.workedExampleReliefLineLof, 1.48);
  assert.equal(gate.scopeBoundary.workedExampleReliefLineLofRole, 'BENCHMARK_ORACLE_ONLY');
  assert.equal(gate.scopeBoundary.valuesAreNotInterchangeable, true);
  assert.equal(gate.scopeBoundary.aggregationMustNotBeInferredFromSingleFirstDiscontinuity, true);
});

test('line candidate remains fail-closed until welded-discontinuity inventory completeness is proven', () => {
  const gate = buildAivPostDiscontinuityEvidenceGate();
  assert.equal(gate.scopeBoundary.assessmentInventoryCompleteness, 'UNVERIFIED');
  assert.equal(
    gate.scopeBoundary.assessmentInventoryRequiredExtent,
    'ALL_RELEVANT_WELDED_DISCONTINUITIES_DOWNSTREAM_TO_FIRST_MAJOR_VESSEL',
  );
  assert.equal(
    gate.authority.screeningAuthorityBlocker,
    'AIV_WELDED_DISCONTINUITY_INVENTORY_COMPLETENESS_UNPROVEN',
  );
  assert.equal(gate.authority.designAuthority, false);
});

test('invalid result-scope configuration blocks the reduction gate without requesting human review', () => {
  const profile = updateAivAssumptionProfile(AIV_DEFAULT_ASSUMPTION_PROFILE, 'benchmark.lineAggregationMode', 'INVALID');
  const gate = buildAivPostDiscontinuityEvidenceGate({ assumptionProfile: profile });
  assert.equal(gate.status, AIV_POST_DISCONTINUITY_GATE_STATUS.BLOCKED_INVALID_ASSUMPTION_PROFILE);
  assert.equal(gate.readyForCandidateImplementation, false);
  assert.equal(gate.reductionRuleImplemented, false);
  assert.equal(gate.humanEvidenceRequired, false);
});

test('worked-example line reference no longer gates runtime reduction implementation', () => {
  const profile = updateAivAssumptionProfile(
    AIV_DEFAULT_ASSUMPTION_PROFILE,
    'benchmark.workedExampleReliefLineLof',
    '',
  );
  const gate = buildAivPostDiscontinuityEvidenceGate({ assumptionProfile: profile });
  assert.equal(gate.reductionRuleImplemented, true);
  assert.equal(gate.scopeBoundary.workedExampleReliefLineLof, null);
  assert.equal(gate.authority.screeningAuthority, 'NOT_AUTHORIZED');
});
