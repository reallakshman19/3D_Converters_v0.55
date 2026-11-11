export const VIBRATION_COMPLETENESS_PRESENTATION_SCHEMA = 'VibrationCompletenessPresentation.v1';

const COMPLETENESS_STATES = new Set(['COMPLETE', 'INCOMPLETE', 'NOT_APPLICABLE']);

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function plural(count, singular, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

function normalizedCompleteness(value = {}) {
  const state = COMPLETENESS_STATES.has(value?.state) ? value.state : 'INCOMPLETE';
  return Object.freeze({
    state,
    requiredCount: nonNegativeInteger(value?.requiredCount),
    completeCount: nonNegativeInteger(value?.completeCount),
    incompleteCount: nonNegativeInteger(value?.incompleteCount),
    notApplicableCount: nonNegativeInteger(value?.notApplicableCount),
    unresolvedIdentificationCount: nonNegativeInteger(value?.unresolvedIdentificationCount),
    missingIdentificationCount: nonNegativeInteger(value?.missingIdentificationCount),
  });
}

function incompleteSummary(value) {
  if (value.missingIdentificationCount) {
    return `${value.missingIdentificationCount} mechanism ${plural(value.missingIdentificationCount, 'identification')} missing`;
  }
  if (value.unresolvedIdentificationCount) {
    return `${value.unresolvedIdentificationCount} unresolved mechanism ${plural(value.unresolvedIdentificationCount, 'identification')}`;
  }
  if (value.incompleteCount) {
    return `${value.incompleteCount} required ${plural(value.incompleteCount, 'assessment')} incomplete`;
  }
  return 'Required assessment coverage is incomplete';
}

function coverageSummary(value) {
  if (value.state === 'COMPLETE') {
    return `${value.completeCount}/${value.requiredCount} required assessments complete`;
  }
  if (value.state === 'NOT_APPLICABLE') {
    return `${value.notApplicableCount} ${plural(value.notApplicableCount, 'mechanism')} evidenced not applicable`;
  }
  return incompleteSummary(value);
}

function screeningPresentation(screeningGoverning, state) {
  if (!screeningGoverning) {
    return Object.freeze({ state: 'NO_CURRENT_SCREENING_RESULT', label: 'No current screening result' });
  }
  if (state === 'COMPLETE') {
    return Object.freeze({ state: 'CURRENT_WITH_COMPLETE_COVERAGE', label: 'Current screening evidence · required coverage complete' });
  }
  return Object.freeze({ state: 'PARTIAL_FAMILY_EVIDENCE', label: 'Partial screening evidence · EI assessment incomplete' });
}

export function buildVibrationCompletenessPresentation(input = {}) {
  const completeness = normalizedCompleteness(input.completeness);
  return Object.freeze({
    schema: VIBRATION_COMPLETENESS_PRESENTATION_SCHEMA,
    state: completeness.state,
    headline: `EI ASSESSMENT ${completeness.state}`,
    coverageSummary: coverageSummary(completeness),
    completeness,
    screening: screeningPresentation(input.screeningGoverning ?? null, completeness.state),
    candidate: Object.freeze({
      state: input.candidateGoverning ? 'CANDIDATE_EVIDENCE' : 'NO_CANDIDATE_RESULT',
      label: input.candidateGoverning ? 'Candidate evidence · not screening authority' : 'No current candidate result',
    }),
  });
}

export function summarizeVisibleVibrationCompleteness(completenesses = []) {
  if (!Array.isArray(completenesses)) throw new TypeError('completenesses must be an array.');
  const values = completenesses.map(normalizedCompleteness);
  const completeRows = values.filter((item) => item.state === 'COMPLETE').length;
  const incompleteRows = values.filter((item) => item.state === 'INCOMPLETE').length;
  const notApplicableRows = values.filter((item) => item.state === 'NOT_APPLICABLE').length;
  const state = incompleteRows ? 'INCOMPLETE' : completeRows ? 'COMPLETE' : notApplicableRows ? 'NOT_APPLICABLE' : 'INCOMPLETE';
  return Object.freeze({
    schema: 'VibrationVisibleCompletenessSummary.v1',
    state,
    headline: `EI ASSESSMENT ${state}`,
    visibleRows: values.length,
    completeRows,
    incompleteRows,
    notApplicableRows,
    missingIdentificationCount: values.reduce((sum, item) => sum + item.missingIdentificationCount, 0),
    incompleteRequiredCount: values.reduce((sum, item) => sum + item.incompleteCount, 0),
  });
}
