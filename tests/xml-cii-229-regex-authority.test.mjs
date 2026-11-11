import assert from 'node:assert/strict';
import test from 'node:test';

import { extractBranchFieldsWithFormats } from '../converters/xml-cii2019-core/branch-format-extraction.js';
import {
  createXmlCiiAdaptedWorkflowState,
  updateRegexTesterConfig,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js';
import { buildOutputRunChecklist } from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import { runStandaloneRegexTester } from '../tabs/xml-cii-2019-standalone/xml-cii-regex-tester.js';

const first = '/ASIM-1885-3-S8811000-91261M7-HC-01/B1';
const second = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B1';

function format(lineKeyRegex, lineKeyPosition = 4) {
  return {
    tokenDelimiter: '-',
    lineKey: { regex: lineKeyRegex, group: 1, tokenPosition: lineKeyPosition },
    pipingClass: { regex: '', group: 1, tokenPosition: 5 },
  };
}
function wrap(formats) { return { regexTester: { formats } }; }
function baseline() {
  return {
    ...createXmlCiiAdaptedWorkflowState(),
    regexTesterConfig: { activeFormatIndex: 0, formats: [format('(STALE)'), format('(S8822000)', 5)] },
  };
}

test('P1 click-to-map token edit wins over stale regex without deleting it', () => {
  const source = baseline();
  const changed = updateRegexTesterConfig(source, 'regex-line-key-token', '4');
  const f1 = changed.regexTesterConfig.formats[0];
  assert.equal(f1.lineKey.regex, '(STALE)');
  assert.equal(f1.lineKey.tokenPosition, '4');
  assert.equal(f1.lineKey.extractMode, 'TOKEN');
  assert.equal(source.regexTesterConfig.formats[0].lineKey.extractMode, undefined, 'no original mutation');
  assert.equal(changed.regexTesterConfig.formats[1].lineKey.extractMode, undefined, 'F2 left untouched');
  const result = extractBranchFieldsWithFormats(first, wrap([f1]));
  assert.equal(result.status, 'MATCHED');
  assert.equal(result.lineKey, 'S8811000');
  assert.equal(result.candidates[0].fieldMethods.lineKey, 'TOKEN');
});

test('P1 editing regex reselects regex mode; an unmatched explicit regex fails closed', () => {
  const clicked = updateRegexTesterConfig(baseline(), 'regex-line-key-token', '4');
  const regex = updateRegexTesterConfig(clicked, 'regex-line-key-regex', '(NEVER)');
  assert.equal(regex.regexTesterConfig.formats[0].lineKey.extractMode, 'REGEX');
  const result = extractBranchFieldsWithFormats(first, wrap([regex.regexTesterConfig.formats[0]]));
  assert.equal(result.status, 'UNMATCHED');
  assert.equal(result.candidates[0].reasons.lineKey, 'REGEX_NO_MATCH_OR_CAPTURE');
});

test('P1 removing regex returns to token mode; clearing token position fails closed', () => {
  const regex = updateRegexTesterConfig(baseline(), 'regex-line-key-regex', '(S8811000)');
  const token = updateRegexTesterConfig(regex, 'regex-line-key-regex', '');
  assert.equal(token.regexTesterConfig.formats[0].lineKey.extractMode, 'TOKEN');
  assert.equal(extractBranchFieldsWithFormats(first, wrap([token.regexTesterConfig.formats[0]])).status, 'MATCHED');
  const cleared = updateRegexTesterConfig(token, 'regex-line-key-token', '');
  assert.equal(extractBranchFieldsWithFormats(first, wrap([cleared.regexTesterConfig.formats[0]])).status, 'UNMATCHED');
});

test('P1 old unversioned regex-first rules retain existing behavior', () => {
  const failing = extractBranchFieldsWithFormats(first, wrap([format('(NEVER)')]));
  assert.equal(failing.status, 'UNMATCHED');
  assert.equal(failing.candidates[0].reasons.lineKey, 'REGEX_NO_MATCH_OR_CAPTURE');
  const matching = extractBranchFieldsWithFormats(first, wrap([format('(S8811000)', 3)]));
  assert.equal(matching.status, 'MATCHED');
  assert.equal(matching.candidates[0].fieldMethods.lineKey, 'REGEX');
});

test('P1 invalid explicit mode and explicit empty regex cannot silently resolve', () => {
  const config = format('', 4);
  config.lineKey.extractMode = 'REGEX';
  let result = extractBranchFieldsWithFormats(first, wrap([config]));
  assert.equal(result.status, 'UNMATCHED');
  assert.equal(result.candidates[0].reasons.lineKey, 'REGEX_REQUIRED');
  config.lineKey.extractMode = 'UNRECOGNIZED';
  result = extractBranchFieldsWithFormats(first, wrap([config]));
  assert.equal(result.status, 'UNMATCHED');
  assert.equal(result.candidates[0].reasons.lineKey, 'INVALID_EXTRACTION_MODE');
});

test('P1 edited Format 2 is not suppressed as untouched alternative template', () => {
  const alternative = {
    tokenDelimiter: '-',
    lineKey: { regex: '', group: 1, tokenPosition: 3, extractMode: 'TOKEN' },
    pipingClass: { regex: '', group: 1, tokenPosition: 4 },
    rating: { regex: '', group: 1, tokenPosition: 4 },
    bore: { regex: '', group: 1, tokenPosition: 2 },
  };
  const result = extractBranchFieldsWithFormats('X-A-B-C-D', wrap([format('(NOMATCH)'), alternative]));
  assert.notEqual(result.candidates[1].reasons?.format, 'UNCONFIGURED_ALTERNATIVE');
});

test('P1 new click choices are independent across F1, F2 and four roles', () => {
  let state = baseline();
  state = updateRegexTesterConfig(state, 'regex-line-key-token', '4');
  state = updateRegexTesterConfig(state, 'regex-piping-class-token', '5');
  state = updateRegexTesterConfig(state, 'regex-rating-token', '6');
  state = updateRegexTesterConfig(state, 'regex-bore-token', '7');
  for (const key of ['lineKey', 'pipingClass', 'rating', 'bore']) {
    assert.equal(state.regexTesterConfig.formats[0][key].extractMode, 'TOKEN');
    assert.notEqual(state.regexTesterConfig.formats[1][key]?.extractMode, 'TOKEN');
  }
  state = updateRegexTesterConfig(state, 'regex-active-format-index', 1);
  state = updateRegexTesterConfig(state, 'regex-line-key-token', '5');
  assert.equal(state.regexTesterConfig.formats[1].lineKey.extractMode, 'TOKEN');
  assert.equal(state.regexTesterConfig.formats[0].lineKey.tokenPosition, '4');
});

test('P1 synthetic 28 occurrence Run gate becomes ready only for real resolved extraction', () => {
  const branches = [
    ...Array.from({ length: 15 }, (_, i) => first.replace('/B1', '/B' + (i + 1))),
    ...Array.from({ length: 13 }, (_, i) => second.replace('/B1', '/B' + (i + 1))),
  ];
  const sourceText = '<Plant>' + branches.map(name =>
    '<Branch><Branchname>' + name + '</Branchname></Branch>').join('') + '</Plant>';
  const f1 = format('(NEVER)');
  const f2 = format('(NEVER)', 5);
  f1.lineKey.extractMode = 'TOKEN';
  f1.pipingClass.extractMode = 'TOKEN';
  f2.lineKey.extractMode = 'TOKEN';
  f2.pipingClass.extractMode = 'TOKEN';
  // F1 only on Format 1, F2 only on Format 2: each must have its own
  // discriminating regex for the opposite format, or overlapping formats
  // can become ambiguous. Here each uses separate regex on lineKey.
  f1.lineKey = { regex: '(S8811000)', group: 1, tokenPosition: 4, extractMode: 'REGEX' };
  f2.lineKey = { regex: '(S8822000)', group: 1, tokenPosition: 5, extractMode: 'REGEX' };
  f2.pipingClass.tokenPosition = 6;
  const rows = buildOutputRunChecklist({
    sourceKind: 'xml', sourceText,
    supportConfigJson: JSON.stringify(wrap([f1, f2])),
    regexTesterResult: { present: true },
    options: { outputMode: 'both' },
  });
  const formatRow = rows.find(row => row.id === 'branch-format-authority');
  assert.equal(formatRow.blocking, false);
  assert.match(formatRow.message, /28 selected branch occurrences/);
});

test('P1 saved canonical and legacy projections both honor token mode', () => {
  const changed = updateRegexTesterConfig(baseline(), 'regex-line-key-token', '4');
  const cfg = changed.regexTesterConfig;
  const run = runStandaloneRegexTester({ sourceText: '', sourceKind: 'xml', extractionConfig: cfg, supportConfigJson: '{}' });
  const support = JSON.parse(run.supportConfigJson);
  assert.equal(support.regexTester.formats[0].lineKey.regex, '(STALE)', 'reversible canonical rule');
  assert.equal(support.regexTester.formats[0].lineKey.extractMode, 'TOKEN');
  assert.equal(support.formats[0].lineKey.extractMode, 'TOKEN');
  assert.equal(support.linelist.branchNameRegex, '', 'legacy consumers must not reuse old regex');
  assert.equal(support.linelist.lineKeyTokenPositions, '4');
});
