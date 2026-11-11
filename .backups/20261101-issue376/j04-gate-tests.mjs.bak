import assert from 'node:assert/strict';
import test from 'node:test';

import { auditConfiguredBranchFormats } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-format-release.js';
import { runXmlCii2019WorkflowService } from '../tabs/xml-cii-2019-standalone/xml-cii-workflow-service.js';

const b1 = '/ASIM-1885-3"-S8811000-91261M7-HC-01/B1';
const b2 = '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B2';
const xml = names => '<Plant>' + names.map(name =>
  '<Branch><Branchname>' + name + '</Branchname></Branch>').join('') + '</Plant>';
const configured = {
  regexTester: { formats: [
    { lineKey: { regex: '(S8811000)' }, pipingClass: { regex: '(91261M7)' } },
    { lineKey: { regex: '(S8822000)' }, pipingClass: { regex: '(91261M7)' } },
  ] },
};
const job = (names, config = configured) => ({
  sourceKind: 'xml', sourceText: xml(names), supportConfigJson: JSON.stringify(config),
  options: { outputMode: 'both' },
});

test('a direct API conversion cannot bypass selected-population ambiguous-format custody', async () => {
  const config = structuredClone(configured);
  config.regexTester.formats.push({
    lineKey: { regex: '(S8822000)' }, pipingClass: { regex: '(S8822000)' },
  });
  let invoked = false;
  const result = await runXmlCii2019WorkflowService(job([b1, b2], config), {
    runParityEnricher: async () => { invoked = true; return null; },
  });
  assert.equal(result.ok, false);
  assert.equal(invoked, false, 'engine preflight must stop before parity/converter invocation');
  assert.match(result.error, /Configured branch identity blocked/);
  assert.equal(result.enrichedText, '');
  assert.equal(result.ciiText, null);
  assert.equal(result.diagnostics?.converterInputReleased, false);
});

test('a valid source extraction still blocks converter release when exact Line List conflicts', async () => {
  let parityCalls = 0;
  const result = await runXmlCii2019WorkflowService(job([b2]), {
    runParityEnricher: async () => {
      parityCalls += 1;
      return {
        applied: true, error: null, evidence: { ok: true, engineInputDigest: 'source-digest' },
        logs: [], stats: {}, xmlText: xml([b2]),
        branchRows: [{ branchName: b2, extractionStatus: 'AMBIGUOUS',
          lineKey: 'S8822000', pipingClass: '', branchIdentityConflict: 'EXACT_LINE_LIST_CLASS_CONFLICT' }],
      };
    },
  });
  assert.equal(parityCalls, 1);
  assert.equal(result.ok, false);
  assert.match(result.error, /Preview branch identity is not qualified/);
  assert.equal(result.diagnostics?.converterInputReleased, false);
  assert.equal(result.ciiText, null);
});

test('population counts include duplicate occurrences and cannot reuse one preview result', () => {
  const occurrences = [
    { branchName: b2, branchOccurrenceId: 'br-1' },
    { branchName: b2, branchOccurrenceId: 'br-2' },
  ];
  const audit = auditConfiguredBranchFormats(occurrences, configured, [
    { branchName: b2, extractionStatus: 'MATCHED', lineKey: 'S8822000', pipingClass: '91261M7' },
  ]);
  assert.equal(audit.checkedCount, 2);
  assert.equal(audit.blocked, true);
  assert.ok(audit.failures.some(row => row.reason === 'OCCURRENCE_MISMATCH'));
  assert.ok(audit.failures.some(row => row.reason === 'POPULATION_COUNT_MISMATCH'));
});

test('matching selected occurrences and matching Preview identities qualify release custody', () => {
  const occurrences = [{ branchName: b1 }, { branchName: b2 }];
  const previewRows = [b1, b2].map((branchName, index) => ({
    branchName, extractionStatus: 'MATCHED', lineKey: index ? 'S8822000' : 'S8811000',
    pipingClass: '91261M7', matchedFormatIndex: index,
  }));
  const audit = auditConfiguredBranchFormats(occurrences, configured, previewRows);
  assert.equal(audit.blocked, false);
  assert.equal(audit.checkedCount, 2);
  assert.deepEqual(audit.failures, []);
});


test('15 dominant + 13 alternative occurrences meet an independent engineering identity oracle', () => {
  const dominantNames = Array.from({ length: 15 }, (_, i) =>
    '/ASIM-1885-3"-S8811000-91261M7-HC-01/B' + (i + 1));
  const alternativeNames = Array.from({ length: 13 }, (_, i) =>
    '/ASIM-1885-PL-HOT-S8822000-91261M7-HC-01/B' + (i + 1));
  const names = [...dominantNames, ...alternativeNames];
  // Expected values are declared independently, not copied from the resolver or Preview.
  const expectedRows = names.map((branchName, index) => ({
    branchName, extractionStatus: 'MATCHED', matchedFormatIndex: index < 15 ? 0 : 1,
    lineKey: index < 15 ? 'S8811000' : 'S8822000', pipingClass: '91261M7',
  }));
  const occurrences = names.map((branchName, index) => ({
    branchName, branchOccurrenceId: 'ORACLE-' + (index + 1),
  }));
  const pass = auditConfiguredBranchFormats(occurrences, configured, expectedRows);
  assert.equal(pass.checkedCount, 28);
  assert.equal(pass.blocked, false, JSON.stringify(pass.failures));
  const altered = expectedRows.map(row => ({ ...row }));
  altered[16].pipingClass = 'S8822000';
  const negative = auditConfiguredBranchFormats(occurrences, configured, altered);
  assert.equal(negative.blocked, true);
  assert.deepEqual([negative.failures[0].occurrenceIndex, negative.failures[0].reason],
    [16, 'ENGINEERING_IDENTITY_MISMATCH']);
});

test('U5: 28 selected branch occurrences require full per-occurrence Preview identity', () => {
  const occurrences = Array.from({ length: 28 }, (_, i) => ({
    branchName: i < 15 ? b1 : b2, branchOccurrenceId: `branch-${i}`,
  }));
  const reviewed = occurrences.map((branch, i) => ({
    branchName: branch.branchName,
    lineKey: i < 15 ? 'S8811000' : 'S8822000',
    pipingClass: '91261M7', extractionStatus: 'MATCHED',
    matchedFormatIndex: i < 15 ? 0 : 1,
  }));
  const good = auditConfiguredBranchFormats(occurrences, configured, reviewed);
  assert.equal(good.checkedCount, 28);
  assert.equal(good.blocked, false, JSON.stringify(good.failures));
  const wrongClass = reviewed.map(row => ({ ...row }));
  wrongClass[26].pipingClass = 'S8822000';
  const bad = auditConfiguredBranchFormats(occurrences, configured, wrongClass);
  assert.equal(bad.blocked, true);
  assert.ok(bad.failures.some(f => f.occurrenceIndex === 26 && f.status === 'PREVIEW_DIVERGENCE'));
  const dropped = auditConfiguredBranchFormats(occurrences, configured, reviewed.slice(0, 27));
  assert.equal(dropped.blocked, true);
  assert.ok(dropped.failures.some(f => f.reason === 'POPULATION_COUNT_MISMATCH'));
});
