import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOutputRunChecklist } from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import { auditConfiguredBranchFormats } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js';

const a = '/ASIM-1885-3-S8811000-91261M7-HC-01';
const b = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01';
const original = [
  ...Array.from({ length: 15 }, (_, n) => a + '/B' + (n + 1)),
  ...Array.from({ length: 13 }, (_, n) => b + '/B' + (n + 1)),
];
function source(names = original) {
  return '<Plant>' + names.map(name =>
    '<Branch><Branchname>' + name + '</Branchname></Branch>').join('') + '</Plant>';
}
function checklist(config, names = original) {
  return buildOutputRunChecklist({
    sourceKind: 'xml', sourceText: source(names),
    supportConfigJson: JSON.stringify(config),
    regexTesterResult: {status:'available'},
    options: { outputMode: 'both' },
  });
}
function authority(config, names) {
  return checklist(config, names).find(row => row.id === 'branch-format-authority');
}
function formats(a, b) {
  return { regexTester: { formats: b ? [a, b] : [a] } };
}
function field(regex) { return { regex, group: 1 }; }
const valid = formats(
  { lineKey: field('(S8811000)'), pipingClass: field('(91261M7)') },
  { lineKey: field('(S8822000)'), pipingClass: field('(91261M7)') },
);

test('P2 valid 28 original occurrence identities resolve without Preview or Weight false blocking', () => {
  const all = checklist(valid);
  const row = all.find(item => item.id === 'branch-format-authority');
  assert.equal(row.blocking, false);
  assert.match(row.message, /28 selected branch occurrences/);
  assert.equal(JSON.parse(row.detail).length, 0);
  assert.equal(all.find(item => item.id === 'regex').status, 'ready');
  assert.equal(all.find(item => item.id === 'preview-audit').blocking, false);
  assert.equal(all.find(item => item.id === 'weight-match').blocking, false);
});

test('P2 28/28 UNMATCHED old regex gives exact total plus actionable per-format role diagnosis', () => {
  const config = formats({ lineKey: field('(NEVER)'), pipingClass: field('(91261M7)') });
  const row = authority(config);
  assert.equal(row.blocking, false);
  assert.equal(row.status,'unresolved-enrichment');
  assert.match(row.message, /^28 of 28 selected branch occurrences/);
  assert.match(row.message, /28 UNMATCHED; 0 AMBIGUOUS/);
  const details = JSON.parse(row.detail);
  assert.equal(details.length, 20, 'bounded display, full-count audit');
  assert.equal(details[0].status, 'UNMATCHED');
  assert.equal(details[0].formatCandidates[0].reasons.lineKey, 'REGEX_NO_MATCH_OR_CAPTURE');
  assert.equal(details[0].formatCandidates[0].fieldMethods.lineKey, 'REGEX');
  assert.equal(details[0].configOrigin, 'regexTester.formats');
  assert.match(details[19].branchOccurrenceId, /::BR-0020$/);
});

test('P2 optional Rating disagreements do not prevent extraction or conversion', () => {
  const config = formats(
    { lineKey: field('(S88\\d+)'), pipingClass: field('(91261M7)'), rating: field('(S88\\d+)') },
    { lineKey: field('(S88\\d+)'), pipingClass: field('(91261M7)'), rating: field('(91261M7)') },
  );
  const row = authority(config);
  assert.equal(row.blocking, false);
  assert.equal(row.status, 'ready');
  assert.deepEqual(JSON.parse(row.detail), []);
});

test('P2 empty authoritative nested array stays fail-closed even with working root formats', () => {
  const config = {regexTester:{formats:[]}, formats:valid.regexTester.formats};
  const row = authority(config);
  assert.equal(row.blocking, false);
  assert.equal(row.status,'unresolved-enrichment');
  assert.match(row.message, /28 UNMATCHED; 0 AMBIGUOUS/);
  const d = JSON.parse(row.detail)[0];
  assert.deepEqual(d.formatCandidates, []);
  assert.equal(d.configOrigin, 'regexTester.formats');
});

test('P2 release audit default shape remains unchanged; Preview divergence still blocked', () => {
  const branches = [{branchName:original[0],branchOccurrenceId:'owner-occ-1'}];
  const baseline = auditConfiguredBranchFormats(branches, formats({lineKey:field('(NEVER)'),pipingClass:field('(91261M7)')}));
  assert.equal(baseline.blocked,true);
  assert.equal(Object.hasOwn(baseline.failures[0], 'formatCandidates'), false);
  const configured = auditConfiguredBranchFormats(branches,valid,[{
    branchName:original[0],extractionStatus:'MATCHED',
    lineKey:'WRONG', pipingClass:'91261M7', matchedFormatIndex:0,
  }]);
  assert.equal(configured.blocked,true);
  assert.equal(configured.failures[0].status,'PREVIEW_DIVERGENCE');
});

test('P2 distinct duplicate original occurrences are never collapsed in counts', () => {
  const names=Array.from({length:28},()=>original[0]);
  const row=authority(formats({lineKey:field('(NEVER)'),pipingClass:field('(91261M7)')}),names);
  assert.match(row.message,/28 of 28/);
  const d=JSON.parse(row.detail);
  assert.equal(new Set(d.map(x=>x.branchOccurrenceId)).size,20);
  assert.equal(d[0].occurrenceIndex,0);
  assert.equal(d[19].occurrenceIndex,19);
});
