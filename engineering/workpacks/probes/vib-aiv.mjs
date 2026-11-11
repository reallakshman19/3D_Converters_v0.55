import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolveRepositoryPath } from '../framework/path-utils.mjs';

async function importFromRoot(context, path) {
  return import(pathToFileURL(resolveRepositoryPath(context.root, path)).href);
}

async function definitionFrom(context) {
  const module = await importFromRoot(context, context.workpack.adapter.path);
  return module[context.workpack.adapter.exportName];
}

async function profileFrom(context) {
  const module = await importFromRoot(context, context.workpack.assumptionProfile.path);
  return module[context.workpack.assumptionProfile.exportName];
}

async function lineAggregationRuleFrom(context) {
  const module = await importFromRoot(context, context.workpack.lineAggregation.path);
  return module[context.workpack.lineAggregation.exportName];
}

async function inventoryCompletenessFrom(context) {
  return importFromRoot(context, context.workpack.inventoryCompleteness.path);
}

async function benchmarksFrom(context) {
  const spec = context.workpack.benchmarks.independentEvidence;
  const module = await importFromRoot(context, spec.path);
  return module[spec.exportName];
}

async function sourceFrom(context, path) {
  return readFile(resolveRepositoryPath(context.root, path), 'utf8');
}

function benchmarkById(benchmarks, id) {
  return benchmarks.find((item) => item.benchmarkId === id);
}

export async function verifyAuthorityState(context) {
  const definition = await definitionFrom(context);
  const expected = context.workpack.authority;
  const ok = definition?.authority?.calculationState === expected.calculationState
    && definition?.authority?.qualificationState === expected.qualificationState;
  return { ok, detail: 'calculation/qualification state matches current machine Work Pack' };
}

export async function verifyScreeningScope(context) {
  const source = await sourceFrom(context, context.workpack.calculator.path);
  const authority = context.workpack.authority;
  const ok = authority.engineeringAuthority === 'SCREENING'
    && authority.screeningAuthority === 'AUTHORIZED'
    && authority.screeningResultScope === 'ASSESSMENT'
    && source.includes("screeningResultScope: 'ASSESSMENT'");
  return { ok, detail: 'screening authority remains assessment-scoped' };
}

export async function verifyLineCaseSummaryBoundary(context) {
  const calculator = await sourceFrom(context, context.workpack.calculator.path);
  const reducer = await sourceFrom(context, context.workpack.lineAggregation.path);
  const ok = context.workpack.authority.lineCaseSummaryAuthoritativeForScreening === false
    && calculator.includes('lineCaseSummaryAuthoritativeForScreening: false')
    && reducer.includes('authoritativeForScreening: false')
    && reducer.includes("assessmentInventoryCompleteness: inventoryVerified ? 'VERIFIED_COMPLETE' : 'UNVERIFIED'")
    && reducer.includes("? 'AIV_LINE_CASE_SCREENING_AUTHORITY_NOT_PROMOTED'");
  return { ok, detail: 'line/case candidate may carry verified inventory evidence while screening authority remains false' };
}

export async function verifyLineAggregationQualification(context) {
  const rule = await lineAggregationRuleFrom(context);
  const expected = context.workpack.lineAggregation;
  const ok = rule?.ruleId === expected.ruleId
    && rule?.methodRevision === expected.methodRevision
    && rule?.qualification?.reductionRule === expected.reductionRuleQualification
    && rule?.qualification?.assessmentInventoryCompletenessRequiredForScreening === true
    && rule?.qualification?.screeningAuthority === 'NOT_AUTHORIZED_WITHOUT_COMPLETE_ASSESSMENT_INVENTORY'
    && rule?.qualification?.designAuthority === false;
  return { ok, detail: 'EI T2.7 greatest-discontinuity reduction rule remains qualified separately from line screening authority' };
}

export async function verifyInventoryCompletenessEvidenceBoundary(context) {
  const module = await inventoryCompletenessFrom(context);
  const source = await sourceFrom(context, context.workpack.inventoryCompleteness.path);
  const expected = context.workpack.inventoryCompleteness;
  const ok = module?.AIV_INVENTORY_ATTESTATION_SCHEMA === expected.attestationSchema
    && module?.AIV_INVENTORY_VERIFICATION_SCHEMA === expected.verificationSchema
    && module?.AIV_INVENTORY_REQUIRED_EXTENT === expected.requiredExtent
    && module?.AIV_INVENTORY_TERMINAL_ROLE === expected.terminalBoundaryRole
    && expected.engineeringInputRevisionRequired === true
    && expected.humanAttestationRequired === true
    && expected.uniqueDirectedSourceToBoundaryPathRequired === true
    && expected.offPageWithinExtentAllowed === false
    && expected.exactAssessmentSetRequired === true
    && expected.screeningAuthorityPromotionApplied === false
    && expected.designAuthority === false
    && source.includes('ENGINEERING_INPUT_REVISION_STALE')
    && source.includes('SOURCE_TO_BOUNDARY_AMBIGUOUS')
    && source.includes('OFF_PAGE_BOUNDARY_IN_SCOPE')
    && source.includes('TOPOLOGY_ASSESSMENT_SET_MISMATCH')
    && source.includes('screeningAuthorityPromotionApplied: false')
    && source.includes('lineCaseAuthoritativeForScreening: false');
  return { ok, detail: 'inventory completeness requires exact-revision human evidence plus fail-closed machine topology checks and does not promote line authority' };
}

export async function verifyDesignAuthority(context) {
  const definition = await definitionFrom(context);
  const ok = context.workpack.authority.designAuthority === false
    && definition?.applicability?.limitations?.some((item) => /no design authority/iu.test(item));
  return { ok, detail: 'designAuthority=false remains explicit' };
}

export async function verifyAssumptionProvenance(context) {
  const profile = await profileFrom(context);
  const source = await sourceFrom(context, context.workpack.assumptionProfile.path);
  const ok = profile?.policy?.assumptionsMustBeVisible === true
    && profile?.policy?.assumptionsMustBeEditable === true
    && profile?.policy?.assumptionsMustBeExportedWithResults === true
    && source.includes("reason: 'MISSING_INPUT_DEFAULTED'");
  return { ok, detail: 'assumption-derived values retain visible/exported provenance' };
}

export async function verifyAssumptionAuthorityBoundary(context) {
  const profile = await profileFrom(context);
  const source = await sourceFrom(context, context.workpack.assumptionProfile.path);
  const ok = profile?.policy?.screeningAuthorityImplied === false
    && source.includes("provenanceSource: 'USER_CONFIGURABLE_ASSUMPTION'");
  return { ok, detail: 'assumptions do not masquerade as project truth or create authority' };
}

export async function verifyBoundedMethodCustody(context) {
  const profile = await profileFrom(context);
  const source = await sourceFrom(context, context.workpack.calculator.path);
  const lineReference = context.workpack.boundedMethod.dependencies
    .find((item) => item.path === 'benchmark.workedExampleReliefLineLof');
  const ok = profile?.benchmark?.stage8Model === 'CONFIGURED_D23_INTERMEDIATES'
    && source.includes('AIV stage 8 supports CONFIGURED_D23_INTERMEDIATES only.')
    && context.workpack.boundedMethod.dependencies
      .every((item) => item.classification !== 'UNRESTRICTED_PROJECT_AUTHORITY')
    && lineReference?.classification === 'BENCHMARK_ORACLE_ONLY'
    && /not a runtime line-result input/iu.test(lineReference?.runtimeRole ?? '');
  return { ok, detail: 'configured D.2.3 dependencies remain explicitly bounded and the 1.48 line reference is oracle-only' };
}

export async function verifyIndependentBenchmarks(context) {
  const benchmarks = await benchmarksFrom(context);
  const failures = [];
  for (const expected of context.workpack.benchmarks.independentVectors) {
    const actual = benchmarkById(benchmarks, expected.id);
    if (!actual) {
      failures.push(`missing ${expected.id}`);
      continue;
    }
    if (actual.productionAuthority !== false) failures.push(`${expected.id}: productionAuthority drift`);
    for (const [field, value] of Object.entries(expected.expected)) {
      if (actual.expected?.[field] !== value) failures.push(`${expected.id}: expected.${field} drift`);
    }
  }
  return {
    ok: failures.length === 0,
    detail: failures.join('; ') || 'controlled independent benchmark vectors match frozen identities',
  };
}

export async function verifyBenchmarkIndependence(context) {
  const benchmarks = await benchmarksFrom(context);
  const source = await sourceFrom(context, context.workpack.benchmarks.independentEvidence.path);
  const ok = !source.includes("from './aiv-calculator.js'")
    && !source.includes("from './aiv-kernel-candidate.js'")
    && benchmarks.every((item) => item.productionAuthority === false);
  return { ok, detail: 'independent expected values are not populated from production execution' };
}

export async function verifyProductFreezeOwnership(context) {
  const freeze = context.workpack.productFreeze;
  const ok = freeze.programOwnerIssue === 513
    && freeze.overallFrozen === 'NOT_INFERRED_HERE'
    && freeze.qualificationIndependent === true;
  return { ok, detail: 'Product Freeze remains externally owned by issue #513' };
}

export async function verifyOverlapClassification(context) {
  const overlap = context.workpack.activeOverlap ?? [];
  const ok = overlap.some((item) => item.ref === 'PR#517')
    && overlap.some((item) => item.ref === 'PR#506')
    && overlap.every((item) => item.classification);
  return { ok, detail: 'active AIV overlap is explicitly classified before mutation' };
}
