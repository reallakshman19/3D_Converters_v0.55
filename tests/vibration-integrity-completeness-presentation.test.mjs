import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VIBRATION_COMPLETENESS_PRESENTATION_SCHEMA,
  buildVibrationCompletenessPresentation,
  summarizeVisibleVibrationCompleteness,
} from '../tabs/vibration-integrity-completeness-presentation.js';

function completeness(overrides = {}) {
  return {
    state: 'INCOMPLETE', requiredCount: 2, completeCount: 1, incompleteCount: 1,
    notApplicableCount: 0, unresolvedIdentificationCount: 0, missingIdentificationCount: 0,
    ...overrides,
  };
}

test('incomplete family state makes a current screening value explicitly partial evidence', () => {
  const result = buildVibrationCompletenessPresentation({
    completeness: completeness(), screeningGoverning: { lof: 0.34 },
  });
  assert.equal(result.schema, VIBRATION_COMPLETENESS_PRESENTATION_SCHEMA);
  assert.equal(result.headline, 'EI ASSESSMENT INCOMPLETE');
  assert.equal(result.coverageSummary, '1 required assessment incomplete');
  assert.equal(result.screening.state, 'PARTIAL_FAMILY_EVIDENCE');
  assert.match(result.screening.label, /Partial screening evidence/u);
  assert.match(result.screening.label, /assessment incomplete/u);
});

test('missing mechanism identification is presented before downstream assessment counts', () => {
  const result = buildVibrationCompletenessPresentation({
    completeness: completeness({ missingIdentificationCount: 4, incompleteCount: 0 }),
  });
  assert.equal(result.coverageSummary, '4 mechanism identifications missing');
  assert.equal(result.screening.state, 'NO_CURRENT_SCREENING_RESULT');
});

test('complete required coverage does not invent design, pass, safe, or code authority wording', () => {
  const result = buildVibrationCompletenessPresentation({
    completeness: completeness({ state: 'COMPLETE', requiredCount: 3, completeCount: 3, incompleteCount: 0 }),
    screeningGoverning: { lof: 0.6 }, candidateGoverning: { lof: 0.8 },
  });
  assert.equal(result.headline, 'EI ASSESSMENT COMPLETE');
  assert.equal(result.coverageSummary, '3/3 required assessments complete');
  assert.equal(result.screening.state, 'CURRENT_WITH_COMPLETE_COVERAGE');
  assert.equal(result.candidate.label, 'Candidate evidence · not screening authority');
  assert.doesNotMatch(JSON.stringify(result), /\bPASS\b|\bSAFE\b|DESIGN AUTHORITY|CODE COMPLIANCE/iu);
});

test('not-applicable presentation requires no synthetic screening result', () => {
  const result = buildVibrationCompletenessPresentation({
    completeness: completeness({
      state: 'NOT_APPLICABLE', requiredCount: 0, completeCount: 0,
      incompleteCount: 0, notApplicableCount: 5,
    }),
  });
  assert.equal(result.headline, 'EI ASSESSMENT NOT_APPLICABLE');
  assert.equal(result.coverageSummary, '5 mechanisms evidenced not applicable');
  assert.equal(result.screening.state, 'NO_CURRENT_SCREENING_RESULT');
});

test('visible-row overview fails closed when any visible assessment remains incomplete', () => {
  const result = summarizeVisibleVibrationCompleteness([
    completeness({ state: 'COMPLETE', requiredCount: 2, completeCount: 2, incompleteCount: 0 }),
    completeness({ missingIdentificationCount: 3 }),
  ]);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.visibleRows, 2);
  assert.equal(result.completeRows, 1);
  assert.equal(result.incompleteRows, 1);
  assert.equal(result.missingIdentificationCount, 3);
  assert.equal(result.incompleteRequiredCount, 1);
});

test('empty visible-row summary remains incomplete instead of implying completion', () => {
  const result = summarizeVisibleVibrationCompleteness([]);
  assert.equal(result.state, 'INCOMPLETE');
  assert.equal(result.visibleRows, 0);
  assert.equal(result.completeRows, 0);
});
