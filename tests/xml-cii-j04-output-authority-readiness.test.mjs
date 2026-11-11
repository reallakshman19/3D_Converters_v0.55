import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOutputRunChecklist } from '../tabs/xml-cii-2019-standalone/xml-cii-output-run-readiness.js';
import { xmlCiiSourceDigest } from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';

const branches = ['BR-LN1-PC1', 'BR-LN2-PC2'];
const sourceText = '<Plant>' + branches.map(name =>
  '<Branch><Branchname>' + name + '</Branchname></Branch>').join('') + '</Plant>';

const config = {
  regexTester: {
    formats: [
      { lineKey: { regex: '(LN1)' }, pipingClass: { regex: '(PC1)' } },
      { lineKey: { regex: '(LN2)' }, pipingClass: { regex: '(PC2)' } },
      { lineKey: { regex: '(LN2)' }, pipingClass: { regex: '(PC)' } },
    ],
  },
};

function authorityRow(selection, overrideConfig = config) {
  const rows = buildOutputRunChecklist({
    sourceKind: 'xml',
    sourceText,
    supportConfigJson: JSON.stringify(overrideConfig),
    options: { outputMode: 'both' },
    branchSelection: selection,
  });
  return rows.find(row => row.id === 'branch-format-authority');
}

test('configured format conflict warns for conversion but never grants engineering authority', () => {
  const row = authorityRow();
  assert.equal(row.blocking, false);
  assert.equal(row.status, 'unresolved-enrichment');
  assert.match(row.message, /1 of 2 selected branch occurrences/);
  const failures = JSON.parse(row.detail);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].branchName, 'BR-LN2-PC2');
  assert.equal(failures[0].status, 'AMBIGUOUS');
  assert.match(failures[0].branchOccurrenceId, /::BR-0002$/);
});

test('readiness scopes full occurrence audit to the user selected source branch', () => {
  const row = authorityRow({
    sourceDigest: xmlCiiSourceDigest(sourceText),
    selectionIdentity: 'name',
    selectedBranchNames: [branches[0]],
  });
  assert.equal(row.status, 'ready');
  assert.equal(row.blocking, false);
  assert.match(row.message, /1 selected branch occurrences/);
});

test('legacy config does not opt into the new multi-format hard gate', () => {
  assert.equal(authorityRow(undefined, { rating: { pipingClassTokenIndex: 5 } }), undefined);
});
