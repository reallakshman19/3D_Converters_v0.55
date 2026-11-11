import { resolveVibrationRoadmapSourceBinding } from '../converters/vibration/source/registry.js';

export const VIBRATION_ROADMAP_MECHANISM_SUMMARY_SCHEMA = 'VibrationRoadmapMechanismSummary.v1';

export const VIBRATION_ROADMAP_MECHANISM_SUMMARY_AUTHORITY = Object.freeze({
  purpose: 'SELECTED_SCOPE_MECHANISM_SUMMARY_GUIDANCE_ONLY',
  dispositionSource: 'RequiredAssessmentSet.v1',
  coverageSource: 'MechanismCoverage.v1',
  completenessSource: 'AssessmentCompleteness.v1',
  sourceIdentitySource: 'VibrationEngineeringSourceRegistry.v1',
  guidanceOnly: true,
  determinesApplicability: false,
  determinesCompleteness: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
  authorityGate: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
});

function frozen(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) frozen(child);
  return Object.freeze(value);
}

function mapByMechanism(values = []) {
  return new Map(values.map((item) => [item.mechanismId, item]));
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function incompleteState(reason) {
  const states = {
    NOT_IMPLEMENTED: ['REQUIRED_NOT_IMPLEMENTED', 'Method/source qualification required'],
    MISSING_ASSESSMENT_SET: ['REQUIRED_NOT_READY', 'Assessment implementation required'],
    ZERO_CARDINALITY_NOT_APPLICABLE_NOT_PROVEN: ['REQUIRED_NOT_READY', 'Assessment implementation required'],
    APPLICABLE_INCOMPLETE: ['INPUTS_REQUIRED', 'Complete mechanism inputs'],
    NOT_EVALUATED: ['NOT_EVALUATED', 'Run qualified assessment when ready'],
    STALE_RESULT: ['STALE_RESULT', 'Rerun required assessment'],
    CANDIDATE_OR_UNQUALIFIED_RESULT: ['CANDIDATE_ONLY', 'Complete qualification before coverage can close'],
    FAILED_OR_REVIEW_REQUIRED: ['REVIEW_REQUIRED', 'Review failed assessment evidence'],
    APPLICABILITY_UNKNOWN: ['APPLICABILITY_UNKNOWN', 'Resolve mechanism applicability'],
    READY_OR_NOT_EXECUTED: ['READY_NOT_EXECUTED', 'Run required assessment'],
    REQUIRED_ASSESSMENT_REPORTED_NOT_APPLICABLE: ['CONTRADICTION', 'Resolve required-versus-N/A contradiction'],
  };
  return states[reason] ?? ['REQUIRED_INCOMPLETE', 'Complete required assessment'];
}

function dispositionFor(id, indexes) {
  if (indexes.required.has(id)) return ['REQUIRED', indexes.required.get(id)];
  if (indexes.notApplicable.has(id)) return ['NOT_APPLICABLE', indexes.notApplicable.get(id)];
  if (indexes.unresolved.has(id)) return ['UNRESOLVED', indexes.unresolved.get(id)];
  if (indexes.missing.has(id)) return ['MISSING', null];
  return ['UNKNOWN', null];
}

function presentationState(disposition, coverage) {
  if (disposition === 'MISSING') return ['IDENTIFICATION_MISSING', 'Identify mechanism'];
  if (disposition === 'UNRESOLVED') return ['IDENTIFICATION_UNRESOLVED', 'Resolve T1 disposition'];
  if (disposition === 'NOT_APPLICABLE') return ['NOT_APPLICABLE', 'Review not-applicable evidence'];
  if (disposition !== 'REQUIRED') return ['IDENTIFICATION_UNKNOWN', 'Restore identification evidence'];
  if (coverage?.status === 'ASSESSMENT_COMPLETE') return ['ASSESSMENT_COMPLETE', 'Review current evidence'];
  return incompleteState(coverage?.reason);
}

function sourceProjection(mechanismId) {
  const binding = resolveVibrationRoadmapSourceBinding({ mechanismId });
  return Object.freeze({
    sourceStatus: binding.status,
    sourceLabel: binding.displayLabel,
    sourceReason: binding.reason ?? null,
  });
}

function mechanismItem(assessment, indexes) {
  const id = assessment?.mechanism?.id;
  if (!id) throw new Error('MECHANISM_SUMMARY_ASSESSMENT_ID_MISSING');
  const [disposition, evidence] = dispositionFor(id, indexes);
  const coverage = disposition === 'REQUIRED' ? evidence : null;
  const [state, nextAction] = presentationState(disposition, coverage);
  return frozen({
    mechanismId: id,
    label: assessment.mechanism.label ?? assessment.mechanism.title ?? id,
    title: assessment.mechanism.title ?? assessment.mechanism.label ?? id,
    catalogueSourceSection: assessment.mechanism.sourceSection ?? null,
    ...sourceProjection(id),
    assessmentUnitType: evidence?.assessmentUnitType ?? null,
    disposition,
    state,
    nextAction,
    coverageStatus: coverage?.status ?? null,
    coverageReason: coverage?.reason ?? null,
    implementationState: assessment.implementationState ?? null,
    qualificationState: assessment.qualificationState ?? null,
    assessmentState: assessment.assessmentState ?? null,
    resultState: assessment.resultState ?? null,
    resultScope: assessment.resultScope ?? null,
    governingEligible: assessment.governingEligible ?? null,
    lof: finiteNumber(assessment.lof),
  });
}

function indexes(matrix) {
  const coverage = matrix?.mechanismCoverage;
  if (coverage?.schema !== 'MechanismCoverage.v1') {
    throw new TypeError('Mechanism summary requires MechanismCoverage.v1.');
  }
  return {
    required: mapByMechanism(coverage.required),
    notApplicable: mapByMechanism(coverage.notApplicable),
    unresolved: mapByMechanism(coverage.unresolved),
    missing: new Set(coverage.missingIdentificationMechanismIds ?? []),
  };
}

export function buildVibrationRoadmapMechanismSummary(matrix = {}) {
  if (matrix?.assessmentCompleteness?.schema !== 'AssessmentCompleteness.v1') {
    throw new TypeError('Mechanism summary requires AssessmentCompleteness.v1.');
  }
  if (!Array.isArray(matrix.assessments)) throw new TypeError('Mechanism summary requires assessments[].');
  const lookup = indexes(matrix);
  const items = matrix.assessments.map((assessment) => mechanismItem(assessment, lookup));
  if (new Set(items.map((item) => item.mechanismId)).size !== items.length) {
    throw new Error('DUPLICATE_MECHANISM_SUMMARY_ID');
  }
  const completeness = matrix.assessmentCompleteness;
  return frozen({
    schema: VIBRATION_ROADMAP_MECHANISM_SUMMARY_SCHEMA,
    items,
    counts: {
      total: items.length,
      required: completeness.requiredCount,
      complete: completeness.completeCount,
      incomplete: completeness.incompleteCount,
      notApplicable: completeness.notApplicableCount,
      unresolved: completeness.unresolvedIdentificationCount,
      identificationMissing: completeness.missingIdentificationCount,
    },
    authority: VIBRATION_ROADMAP_MECHANISM_SUMMARY_AUTHORITY,
  });
}

export function isGovernedVibrationRoadmapMechanismSummary(value) {
  const authority = value?.authority;
  return value?.schema === VIBRATION_ROADMAP_MECHANISM_SUMMARY_SCHEMA
    && Array.isArray(value.items)
    && authority?.purpose === 'SELECTED_SCOPE_MECHANISM_SUMMARY_GUIDANCE_ONLY'
    && authority?.guidanceOnly === true
    && authority?.determinesApplicability === false
    && authority?.determinesCompleteness === false
    && authority?.blocksExecution === false
    && authority?.blocksNavigation === false
    && authority?.blocksCalculation === false
    && authority?.blocksPersistence === false
    && authority?.authorityGate === false
    && authority?.numericalAuthority === 'NONE'
    && authority?.aggregationAuthority === 'NONE'
    && authority?.persistenceAuthority === 'NONE'
    && authority?.screeningAuthority === 'NOT_AUTHORIZED'
    && authority?.designAuthority === false;
}
