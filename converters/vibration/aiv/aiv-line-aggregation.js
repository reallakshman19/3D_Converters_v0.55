import { verifyAivInventoryCompletenessForLineCase } from './aiv-inventory-completeness.js';

export const AIV_LINE_AGGREGATION_RULE_ID = 'EI_AVIFF_T2_7_GREATEST_DISCONTINUITY_LOCATION_LOF';
export const AIV_LINE_CASE_SUMMARY_SCHEMA = 'AivLineCaseSummary.v1';

export const AIV_LINE_AGGREGATION_RULE = Object.freeze({
  ruleId: AIV_LINE_AGGREGATION_RULE_ID,
  methodId: 'VIB.AIV.ACOUSTIC',
  methodRevision: 'ei-aviff2-aiv-line-reduction-v1',
  source: Object.freeze({
    publication: 'Energy Institute AVIFF 2nd Edition',
    technicalModule: 'T2',
    sectionId: 'T2.7',
    flowchartId: 'T2-5',
    ruleBasis: 'GREATEST_DISCONTINUITY_LOCATION_LOF_UP_TO_LOCATION',
    repositorySourceBindingStatus: 'RECONCILIATION_REQUIRED',
  }),
  qualification: Object.freeze({
    reductionRule: 'QUALIFIED_FOR_DERIVATION',
    assessmentInventoryCompletenessRequiredForScreening: true,
    authorityPromotionApplied: false,
    screeningAuthority: 'NOT_AUTHORIZED_WITHOUT_COMPLETE_ASSESSMENT_INVENTORY',
    designAuthority: false,
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string.`);
  return value.trim();
}

function finiteNonNegative(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite non-negative number.`);
  }
  return value;
}

function assertAssessmentResult(result, qualificationMode) {
  if (result?.schema !== 'AivAssessmentResult.v1'
      || result?.resultScope !== 'ASSESSMENT'
      || result?.calculationId !== 'VIB.AIV.ACOUSTIC') {
    throw new TypeError('AIV line aggregation requires AivAssessmentResult.v1 assessment-scope results.');
  }
  const expectedStatus = qualificationMode === 'screening' ? 'SCREENING_CALCULATED' : 'BENCHMARK_CALCULATED';
  if (result.status !== expectedStatus) {
    throw new Error(`AIV_LINE_AGGREGATION_RESULT_STATUS_INVALID:${result.assessmentCanonicalId ?? 'UNKNOWN'}`);
  }
  const authority = result.authority ?? {};
  const expectedQualification = qualificationMode === 'screening' ? 'SCREENING' : 'BENCHMARK_ONLY';
  if (authority.calculationState !== 'IMPLEMENTED'
      || authority.qualificationState !== expectedQualification
      || authority.designAuthority !== false) {
    throw new Error(`AIV_LINE_AGGREGATION_RESULT_AUTHORITY_INVALID:${result.assessmentCanonicalId ?? 'UNKNOWN'}`);
  }
  if (qualificationMode === 'screening' && authority.screeningAuthority !== 'AUTHORIZED') {
    throw new Error(`AIV_LINE_AGGREGATION_SCREENING_AUTHORITY_REQUIRED:${result.assessmentCanonicalId ?? 'UNKNOWN'}`);
  }
  requiredText(result.line, 'assessmentResult.line');
  requiredText(result.caseId, 'assessmentResult.caseId');
  requiredText(result.assessmentCanonicalId, 'assessmentResult.assessmentCanonicalId');
  finiteNonNegative(result.lof, 'assessmentResult.lof');
  return result;
}

function lineCaseKey(result) {
  return JSON.stringify([result.line.trim(), result.caseId.trim()]);
}

function controllingAssessment(results) {
  return [...results].sort((left, right) => (
    right.lof - left.lof
      || left.assessmentCanonicalId.localeCompare(right.assessmentCanonicalId)
  ))[0];
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function lineCaseSummary(results, qualificationMode, context) {
  const controlling = controllingAssessment(results);
  const assessmentIds = uniqueSorted(results.map((item) => item.assessmentCanonicalId));
  const sourceIds = uniqueSorted(results.flatMap((item) => item.contributingSourceCanonicalIds ?? []));
  const inventoryVerification = verifyAivInventoryCompletenessForLineCase({
    attestations: context.inventoryCompletenessAttestations,
    topology: context.topology,
    line: controlling.line,
    caseId: controlling.caseId,
    sourceCanonicalIds: sourceIds,
    assessmentCanonicalIds: assessmentIds,
    currentInputRevision: context.engineeringInputRevision,
  });
  const inventoryVerified = inventoryVerification.verifiedComplete === true;
  return deepFreeze({
    schema: AIV_LINE_CASE_SUMMARY_SCHEMA,
    resultScope: 'LINE_CASE_SUMMARY',
    calculationId: 'VIB.AIV.ACOUSTIC',
    status: qualificationMode === 'screening' ? 'SCREENING_DERIVED_CANDIDATE' : 'BENCHMARK_DERIVED_CANDIDATE',
    line: controlling.line.trim(),
    caseId: controlling.caseId.trim(),
    lof: controlling.lof,
    maxAssessmentLof: controlling.lof,
    assessmentCount: results.length,
    assessmentCanonicalIds: assessmentIds,
    sourceCanonicalIds: sourceIds,
    controllingAssessmentCanonicalId: controlling.assessmentCanonicalId,
    controllingSourceCanonicalIds: uniqueSorted(controlling.contributingSourceCanonicalIds ?? []),
    aggregationBasis: AIV_LINE_AGGREGATION_RULE_ID,
    aggregationRuleQualification: AIV_LINE_AGGREGATION_RULE.qualification.reductionRule,
    assessmentInventoryCompleteness: inventoryVerified ? 'VERIFIED_COMPLETE' : 'UNVERIFIED',
    assessmentInventoryRequiredExtent: inventoryVerification.requiredExtent,
    assessmentInventoryVerification: inventoryVerification,
    valuesAreNotInterchangeable: true,
    authoritativeForScreening: false,
    screeningAuthorityBlocker: inventoryVerified
      ? 'AIV_LINE_CASE_SCREENING_AUTHORITY_NOT_PROMOTED'
      : 'AIV_WELDED_DISCONTINUITY_INVENTORY_COMPLETENESS_UNPROVEN',
    authority: {
      calculationState: 'IMPLEMENTED',
      qualificationState: 'QUALIFIED_REDUCTION_RULE',
      engineeringAuthority: 'DERIVED_CANDIDATE_ONLY',
      screeningAuthority: 'NOT_AUTHORIZED',
      authorityPromotionApplied: false,
      designAuthority: false,
    },
    provenance: {
      ruleId: AIV_LINE_AGGREGATION_RULE_ID,
      methodRevision: AIV_LINE_AGGREGATION_RULE.methodRevision,
      source: AIV_LINE_AGGREGATION_RULE.source,
      inputAssessmentResultIds: assessmentIds,
      inventoryVerificationSchema: inventoryVerification.schema,
      inventoryEvidenceVerified: inventoryVerified,
    },
  });
}

export function aggregateAivAssessmentResultsToLineCases(assessmentResults = [], {
  qualificationMode = 'benchmark',
  topology = null,
  inventoryCompletenessAttestations = [],
  engineeringInputRevision = null,
} = {}) {
  if (!['benchmark', 'screening'].includes(qualificationMode)) {
    throw new RangeError('AIV line aggregation qualificationMode must be benchmark or screening.');
  }
  if (!Array.isArray(assessmentResults)) throw new TypeError('AIV line aggregation assessmentResults must be an array.');
  if (!Array.isArray(inventoryCompletenessAttestations)) {
    throw new TypeError('AIV line aggregation inventoryCompletenessAttestations must be an array.');
  }
  const groups = new Map();
  for (const input of assessmentResults) {
    const result = assertAssessmentResult(input, qualificationMode);
    const key = lineCaseKey(result);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(result);
  }
  const context = { topology, inventoryCompletenessAttestations, engineeringInputRevision };
  return deepFreeze([...groups.values()]
    .map((results) => lineCaseSummary(results, qualificationMode, context))
    .sort((left, right) => left.line.localeCompare(right.line) || left.caseId.localeCompare(right.caseId)));
}
