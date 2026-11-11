import {
  AIV_ASSUMPTION_PROFILE_SCHEMA,
  AIV_DEFAULT_ASSUMPTION_PROFILE,
  validateAivAssumptionProfile,
} from './aiv-assumption-profile.js';
import {
  AIV_LINE_AGGREGATION_RULE,
  AIV_LINE_AGGREGATION_RULE_ID,
} from './aiv-line-aggregation.js';

export const AIV_POST_DISCONTINUITY_EVIDENCE_GATE_SCHEMA = 'AivPostDiscontinuityEvidenceGate.v2';
export const AIV_POST_DISCONTINUITY_GATE_STATUS = Object.freeze({
  BLOCKED_INVALID_ASSUMPTION_PROFILE: 'BLOCKED_INVALID_ASSUMPTION_PROFILE',
  REDUCTION_RULE_IMPLEMENTED_INVENTORY_UNVERIFIED: 'REDUCTION_RULE_IMPLEMENTED_INVENTORY_UNVERIFIED',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildAivPostDiscontinuityEvidenceGate({
  assumptionProfile = AIV_DEFAULT_ASSUMPTION_PROFILE,
} = {}) {
  const validation = validateAivAssumptionProfile(assumptionProfile);
  const benchmark = assumptionProfile?.benchmark ?? {};
  const scopeConfigured = assumptionProfile?.schema === AIV_ASSUMPTION_PROFILE_SCHEMA
    && benchmark.lineAggregationMode === 'SEPARATE_RESULT_SCOPES'
    && benchmark.assessmentMode === 'BENCHMARK_COMPARE_ONLY'
    && numeric(benchmark.d23FirstDiscontinuityLof) !== null;
  const ready = validation.valid && scopeConfigured;

  return deepFreeze({
    schema: AIV_POST_DISCONTINUITY_EVIDENCE_GATE_SCHEMA,
    methodId: 'VIB.AIV.ACOUSTIC',
    stageIds: ['AGGREGATE_LINE_CASE_RESULT', 'ASSESS_RESULT'],
    status: ready
      ? AIV_POST_DISCONTINUITY_GATE_STATUS.REDUCTION_RULE_IMPLEMENTED_INVENTORY_UNVERIFIED
      : AIV_POST_DISCONTINUITY_GATE_STATUS.BLOCKED_INVALID_ASSUMPTION_PROFILE,
    readyForCandidateImplementation: ready,
    reductionRuleImplemented: ready,
    humanEvidenceRequired: false,
    assumptionProfileValidation: validation,
    reductionRule: {
      ruleId: AIV_LINE_AGGREGATION_RULE_ID,
      qualification: AIV_LINE_AGGREGATION_RULE.qualification.reductionRule,
      source: AIV_LINE_AGGREGATION_RULE.source,
    },
    scopeBoundary: {
      sourceResultScope: 'SOURCE',
      firstDiscontinuityScope: 'ASSESSMENT',
      derivedReportScope: 'LINE_CASE_SUMMARY',
      d23FirstDiscontinuityLof: numeric(benchmark.d23FirstDiscontinuityLof),
      workedExampleReliefLineLof: numeric(benchmark.workedExampleReliefLineLof),
      workedExampleReliefLineLofRole: 'BENCHMARK_ORACLE_ONLY',
      lineAggregationMode: benchmark.lineAggregationMode ?? null,
      assessmentMode: benchmark.assessmentMode ?? null,
      valuesAreNotInterchangeable: true,
      aggregationMustNotBeInferredFromSingleFirstDiscontinuity: true,
      assessmentInventoryCompleteness: 'UNVERIFIED',
      assessmentInventoryRequiredExtent: 'ALL_RELEVANT_WELDED_DISCONTINUITIES_DOWNSTREAM_TO_FIRST_MAJOR_VESSEL',
    },
    assessmentBoundary: {
      benchmarkComparisonOnly: true,
      assumptionsAreUserConfigurable: true,
      universalPassSafeClassificationForbidden: true,
      genericScreeningAuthorityClaimed: false,
    },
    authority: {
      authorityTransitionApplied: false,
      calculationState: ready ? 'IMPLEMENTED' : 'BLOCKED',
      qualificationState: ready ? 'QUALIFIED_REDUCTION_RULE' : 'BLOCKED',
      engineeringAuthority: ready ? 'DERIVED_CANDIDATE_ONLY' : 'NONE',
      productionEquationAuthorized: false,
      screeningAuthority: 'NOT_AUTHORIZED',
      screeningAuthorityBlocker: ready
        ? 'AIV_WELDED_DISCONTINUITY_INVENTORY_COMPLETENESS_UNPROVEN'
        : 'INVALID_ASSUMPTION_PROFILE',
      designAuthority: false,
    },
    notes: [
      'Stage 9 derives a line/case candidate from the greatest calculated discontinuity-location LOF for that line/case.',
      'The worked-example relief-line LOF remains a benchmark oracle and is not a runtime line-result input.',
      'Derived line/case screening authority remains blocked until the relevant welded-discontinuity inventory is proven complete.',
    ],
  });
}
