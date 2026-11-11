import assert from 'node:assert/strict';
import {
  buildWeightCandidateRows,
  runStandaloneWeightMatch,
} from '../tabs/xml-cii-2019-standalone/xml-cii-weight-match.js';

function norm(value) { return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ''); }
function numeric(value) {
  const parsed = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}
function numScore(a, b, points, tolerance) {
  if (a === null || b === null) return 0;
  const spread = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / spread <= tolerance ? points : 0;
}
function referenceRows(input) {
  const candidates = input.masterContext.weightMasterRows
    .map((row, index) => ({
      candidateId: String(row.id || `candidate-${index + 1}`),
      componentType: norm(row.componentType),
      bore: numeric(row.bore),
      rating: norm(row.rating),
      length: numeric(row.length),
      candidateWeight: numeric(row.weight),
      raw: row,
    }))
    .filter((row) => row.candidateWeight !== null && row.candidateWeight > 0);
  const issues = input.componentRows
    .map((row, index) => ({
      issueId: String(row.id || `issue-${index + 1}`),
      componentType: norm(row.componentType),
      bore: numeric(row.bore),
      rating: norm(row.rating),
      length: numeric(row.length),
      currentWeight: numeric(row.weight),
      raw: row,
    }))
    .filter((row) => row.currentWeight === null || row.currentWeight <= 0);
  return issues.flatMap((issue) => candidates.map((candidate) => {
    const boreScore = numScore(issue.bore, candidate.bore, 25, 0.02);
    const ratingScore = issue.rating && candidate.rating && issue.rating === candidate.rating ? 25 : 0;
    const lengthScore = numScore(issue.length, candidate.length, 25, 0.05);
    const componentTypeScore = issue.componentType && candidate.componentType && issue.componentType === candidate.componentType ? 25 : 0;
    return {
      issueId: issue.issueId,
      candidateId: candidate.candidateId,
      componentType: candidate.componentType,
      bore: candidate.bore,
      rating: candidate.rating,
      length: candidate.length,
      candidateWeight: candidate.candidateWeight,
      boreScore,
      ratingScore,
      lengthScore,
      componentTypeScore,
      totalScore: boreScore + ratingScore + lengthScore + componentTypeScore,
      issue,
      raw: candidate.raw,
    };
  }).sort((a, b) => b.totalScore - a.totalScore).slice(0, 5));
}

function fixture(masterCount = 300, issueCount = 18) {
  const masterRows = Array.from({ length: masterCount }, (_, index) => ({
    id: `C${String(index).padStart(5, '0')}`,
    componentType: ['VALVE', 'FLANGE', 'TEE', 'ELBOW'][index % 4],
    bore: [50, 80, 100, 150, 200][index % 5],
    rating: ['150', '300', '600'][index % 3],
    length: 100 + ((index * 17) % 19) * 10,
    weight: index % 37 === 0 ? 0 : 5 + (index % 97),
  }));
  const componentRows = Array.from({ length: issueCount }, (_, index) => ({
    id: `I${index}`,
    componentType: ['VALVE', 'FLANGE', 'TEE', 'ELBOW'][index % 4],
    bore: [50, 80, 100, 150, 200][(index * 2) % 5],
    rating: ['150', '300', '600'][(index * 2) % 3],
    length: 100 + ((index * 7) % 19) * 10,
    weight: 0,
  }));
  return { masterContext: { weightMasterRows: masterRows }, componentRows };
}

{
  const input = fixture();
  assert.deepEqual(buildWeightCandidateRows(input), referenceRows(input));
}

{
  const ties = Array.from({ length: 12 }, (_, index) => ({
    id: `T${index}`,
    componentType: 'VALVE', bore: 100, rating: '300', length: 250, weight: index + 1,
  }));
  const input = {
    masterContext: { weightMasterRows: ties },
    componentRows: [{ id: 'tie-issue', componentType: 'VALVE', bore: 100, rating: '300', length: 250, weight: 0 }],
  };
  assert.deepEqual(buildWeightCandidateRows(input).map((row) => row.candidateId), ['T0', 'T1', 'T2', 'T3', 'T4']);
  assert.deepEqual(buildWeightCandidateRows(input), referenceRows(input));
}

{
  const input = fixture(10000, 100);
  const originalSort = Array.prototype.sort;
  let maxSortedLength = 0;
  let sortCalls = 0;
  Array.prototype.sort = function (...args) {
    sortCalls += 1;
    maxSortedLength = Math.max(maxSortedLength, this.length);
    return originalSort.apply(this, args);
  };
  try {
    const result = runStandaloneWeightMatch(input);
    assert.equal(result.candidateRows.length, 500);
  } finally {
    Array.prototype.sort = originalSort;
  }
  assert.ok(sortCalls > 0, 'finalization should still sort bounded per-issue candidate lists');
  assert.ok(maxSortedLength <= 5, `no sort may receive more than five rows; observed ${maxSortedLength}`);
}

{
  const input = fixture(80, 4);
  input.weightMatchOverrides = { I0: 'C00007' };
  const result = runStandaloneWeightMatch(input);
  const expectedCandidates = referenceRows(input);
  assert.deepEqual(result.candidateRows, expectedCandidates);
  const expected = expectedCandidates.filter((row) => row.issueId === 'I0');
  const overridden = result.finalizedRows[0];
  const selected = expected.find((row) => row.candidateId === 'C00007') || expected[0] || null;
  assert.equal(overridden.selectedCandidateId, selected?.candidateId || 'C00007');
  assert.equal(overridden.finalizedWeight, selected?.candidateWeight ?? null);
}

console.log('XML CII legacy Weight Match bounded top-five checks passed.');
