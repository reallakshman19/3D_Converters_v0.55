import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSelectedBranchScope,
  buildXmlCiiBranchOccurrences,
} from '../tabs/xml-cii-2019-standalone/xml-cii-branch-scope.js';

const duplicateXml = `<PipeStressExport>
<Branch><Branchname>/LINE/B1</Branchname><Node><NodeName>FIRST</NodeName></Node></Branch>
<Branch><Branchname>/LINE/B1</Branchname><Node><NodeName>SECOND</NodeName></Node></Branch>
</PipeStressExport>`;

test('cached occurrences retain duplicate identity, exact source changes, selection, and independent rows', () => {
  const first = buildXmlCiiBranchOccurrences(duplicateXml);
  assert.deepEqual(first.map((row) => row.displayBranchName), ['/LINE/B1_1', '/LINE/B1_2']);
  assert.notEqual(first[0].branchOccurrenceId, first[1].branchOccurrenceId);
  first[0].branchName = '/CORRUPTED/B1';
  first.pop();
  const again = buildXmlCiiBranchOccurrences(duplicateXml);
  assert.equal(again.length, 2);
  assert.equal(again[0].branchName, '/LINE/B1');
  assert.notStrictEqual(first[0], again[0]);
  const selected = buildSelectedBranchScope({
    sourceText: duplicateXml,
    selectedBranchOccurrenceIds: [again[1].branchOccurrenceId],
    selectionIdentity: 'occurrence',
  });
  assert.deepEqual(selected.selectedBranchOccurrenceIds, [again[1].branchOccurrenceId]);
  assert.match(selected.filteredSourceText, /SECOND/);
  assert.doesNotMatch(selected.filteredSourceText, /FIRST/);

  const changedSource = duplicateXml.replace('SECOND', 'SECONd');
  const changed = buildXmlCiiBranchOccurrences(changedSource);
  assert.notEqual(changed[1].branchOccurrenceId, again[1].branchOccurrenceId);
  assert.equal(buildXmlCiiBranchOccurrences(duplicateXml)[1].branchOccurrenceId,
    again[1].branchOccurrenceId);
});

test('cache is bounded and parser-aware; text fallback cannot poison a browser parser result', () => {
  const previous = globalThis.DOMParser;
  let parses = 0;
  class ParserOne {
    parseFromString() {
      parses += 1;
      return {
        querySelector: () => null,
        getElementsByTagName: (tag) => tag === 'Branch'
          ? [{ childNodes: [{ nodeType: 1, localName: 'Branchname', textContent: '/DOM/B1' }] }]
          : [],
      };
    }
  }
  const source = '<Branch><Branchname>/TEXT/B1</Branchname></Branch>';
  try {
    delete globalThis.DOMParser;
    assert.equal(buildXmlCiiBranchOccurrences(source)[0].branchName, '/TEXT/B1');
    globalThis.DOMParser = ParserOne;
    assert.equal(buildXmlCiiBranchOccurrences(source)[0].branchName, '/DOM/B1');
    assert.equal(buildXmlCiiBranchOccurrences(source)[0].branchName, '/DOM/B1');
    assert.equal(parses, 1);

    for (let index = 0; index < 5; index += 1) {
      buildXmlCiiBranchOccurrences(`${source}<!-- ${index} -->`);
    }
    assert.equal(parses, 6);
    buildXmlCiiBranchOccurrences(source);
    assert.equal(parses, 7, 'The oldest entry should be evicted after five other sources');

    class ParserTwo extends ParserOne {}
    globalThis.DOMParser = ParserTwo;
    buildXmlCiiBranchOccurrences(source);
    assert.equal(parses, 8, 'Changing parser identity must invalidate the cached result');
    delete globalThis.DOMParser;
    assert.equal(buildXmlCiiBranchOccurrences(source)[0].branchName, '/TEXT/B1');
  } finally {
    if (previous === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previous;
  }
});
