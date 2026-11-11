import assert from 'node:assert/strict';
import {
  buildRegexSuggestionPreflight,
  createDefaultRegexSuggestionProfile,
  regexSuggestionCacheStats,
  resetRegexSuggestionCachesForTests,
} from '../tabs/xml-cii-2019-standalone/xml-cii-regex-smart-suggestions.js';

resetRegexSuggestionCachesForTests();
const branchSamples = [
  { branchName: '/BWWA-1000-3"-W1410201-31422R5-01/B1' },
  { branchName: '/BWWA-1000-FL-6"-W1610005(FL-03)/B1' },
];
const lineRows = Array.from({ length: 11000 }, (_, i) => ({ lineKey: i === 42 ? 'W1410201' : `L${i}` }));
const pipingClassRows = Array.from({ length: 11000 }, (_, i) => ({
  pipingClass: i === 10 ? '31422R5' : `PC${i}`,
  convertedBore: i === 10 ? 80 : 100,
}));
const extractionConfig = {
  activeFormatIndex: 0,
  formats: [{ tokenDelimiter: '-', lineKey: {}, pipingClass: {}, rating: {}, bore: {} }],
  ratingSequence: [],
};
const masterContext = {
  lineRows,
  pipingClassRows,
  rowCounts: { lineList: lineRows.length, pipingClass: pipingClassRows.length },
  appliedMappingRevision: { lineList: 7, pipingClass: 9 },
  config: { linelist: { fieldMap: {} }, pipingClass: { fieldMap: {} } },
};
const input = {
  branchSamples,
  extractionConfig,
  masterContext,
  currentResult: { matchedRows: [], rejectedRows: branchSamples },
  profile: createDefaultRegexSuggestionProfile(),
};
const first = buildRegexSuggestionPreflight(input);
const afterFirst = regexSuggestionCacheStats();
const second = buildRegexSuggestionPreflight(input);
const afterSecond = regexSuggestionCacheStats();

assert.equal(first, second, 'unchanged workbench input should reuse the preflight receipt');
assert.equal(afterFirst.lineMasterBuilds, 1);
assert.equal(afterFirst.classMasterBuilds, 1);
assert.equal(afterSecond.lineMasterBuilds, 1, '11k Line List rows must not be reindexed on repeated render');
assert.equal(afterSecond.classMasterBuilds, 1, '11k Piping Class rows must not be reindexed on repeated render');
assert.equal(afterSecond.preflightHits, 1);

const bore = first.suggestions.find((row) => row.role === 'bore');
assert.equal(bore?.tokenPositions?.[0], 3);
assert.ok((bore?.evidenceMetrics?.explicitSyntaxRate || 0) > 0);

const secondFormat = buildRegexSuggestionPreflight({
  ...input,
  extractionConfig: { ...extractionConfig, activeFormatIndex: 1 },
});
assert.equal(secondFormat.suggestions.find((row) => row.role === 'bore')?.tokenPositions?.[0], 4,
  'the FL-6-inch branch has a separate explicit bore token');
assert.equal(regexSuggestionCacheStats().lineMasterBuilds, 1);
assert.equal(regexSuggestionCacheStats().classMasterBuilds, 1);

console.log('Issue #776 Regex governed-index/cache regression passed.');
