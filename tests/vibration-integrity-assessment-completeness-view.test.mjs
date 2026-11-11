import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const viewSource = fs.readFileSync(
  new URL('../tabs/vibration-integrity-view.js', import.meta.url),
  'utf8',
);
const fitRegisterSource = fs.readFileSync(
  new URL('../converters/vibration/facility/fit-register.js', import.meta.url),
  'utf8',
);

test('FIT register completenessStatus remains subordinate to family EI assessment completeness', () => {
  assert.match(fitRegisterSource, /function completenessStatus\(status\)/u);
  assert.match(fitRegisterSource, /if \(calculatedStatus\(status\)\) return 'CALCULATED'/u);
  assert.match(viewSource, /<th>EI assessment status<\/th><th>FIT row state<\/th>/u);
  assert.match(viewSource, /assessmentCompletenessCell\(matrix\)/u);
  assert.doesNotMatch(viewSource, /<th>FIT row state<\/th><th>Assessment completeness<\/th>/u);
  assert.doesNotMatch(
    viewSource,
    /<label>Completeness<select data-vi-filter="completeness"/u,
  );
});

test('family completeness is the primary visible result and remains fail-closed', () => {
  assert.match(viewSource, /Completeness is the primary assessment result/u);
  assert.match(viewSource, /EI assessment completeness is primary/u);
  assert.match(viewSource, /Family completion requires governed identification plus every required assessment/u);
  assert.match(viewSource, /\['IDENTIFICATION_EVIDENCE_MISSING'\]/u);
  assert.match(viewSource, /FIT row state/u);
  assert.match(viewSource, /FIT status/u);
  assert.doesNotMatch(viewSource, /coverage:\s*state\./u);
});

test('screening and candidate outputs are published as evidence rather than family completion', () => {
  assert.match(viewSource, /<th>Current screening evidence<\/th>/u);
  assert.match(viewSource, /<th>Candidate evidence<\/th>/u);
  assert.match(viewSource, /presentation\.screening\.label/u);
  assert.match(viewSource, /presentation\.candidate\.label/u);
  assert.doesNotMatch(viewSource, /<th>Screening governing<\/th>/u);
  assert.doesNotMatch(viewSource, /<th>Candidate governing<\/th>/u);
});

test('presentation consumes existing backend completeness without mutating engineering calculation paths', () => {
  assert.match(viewSource, /buildVibrationMechanismMatrixRow\(row, context\)/u);
  assert.match(viewSource, /matrix\.assessmentCompleteness/u);
  assert.match(viewSource, /matrix\.screeningGoverning/u);
  assert.match(viewSource, /matrix\.candidateGoverning/u);
  assert.doesNotMatch(viewSource, /evaluateVibrationAssessmentCompleteness/u);
  assert.doesNotMatch(viewSource, /evaluateEiMainLineAggregation/u);
});
