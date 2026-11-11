import assert from 'node:assert/strict';
import test from 'node:test';
import { installWeightBasisXmlDom } from '../tabs/xml-cii-2019-standalone/workers/weight-basis-xml-dom.js';
import { applyPreviewBoreWallAuthority } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js';
import { rerankPreviewNodeRows } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-rating-authority.js';
import { buildStrictLineAuthorityCorePreview } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js';
import { createStandaloneRunParityEvidence } from '../tabs/xml-cii-2019-standalone/xml-cii-run-parity-evidence.js';

installWeightBasisXmlDom(globalThis);
const NAME = '/ASIM-1885-PL-10"-S8810105-HOT-01/B3';
const REF = '=1006649755/1750';
const branch = (bore) => '<Pipe><Branch><Branchname>' + NAME + '</Branchname>'
  + '<Node><NodeNumber>200010</NodeNumber><ComponentRefNo>' + REF
  + '</ComponentRefNo><Endpoint>1</Endpoint><Position>803427 -1140678 98762.35</Position>'
  + '<ComponentType>BRAN</ComponentType><BoreMm>' + bore + '</BoreMm></Node>'
  + '</Branch></Pipe>';
const combined = (a, b) => '<PipeStressExport>' + branch(a) + branch(b) + '</PipeStressExport>';
const baseBranches = [
  { branchName: NAME, pipingClass: 'S8810105', rating: '1500', sizeMm: 300 },
  { branchName: NAME, pipingClass: 'S8810105', rating: '900', sizeMm: 300 },
];
const rows = [0, 1].map(branchOccurrenceIndex => ({
  key: NAME + '::200010', branchName: NAME, branchOccurrenceIndex,
  nodeOrdinal: 0, nodeNumber: '200010', componentRefNo: REF,
  endpoint: '1', rating: branchOccurrenceIndex ? '900' : '1500',
  boreMm: 300, lengthMm: 'unresolved',
}));

test('repeated node keys can retain distinct legitimate bores with exact occurrence', () => {
  const result = applyPreviewBoreWallAuthority({
    xmlText: combined(300, 250), stagedJsonText: '', config: {},
    result: { branchRows: baseBranches, nodeRows: rows },
  });
  assert.deepEqual(result.nodeBoreWallRows.map(r => r.boreMm), [300, 250]);
  assert.deepEqual(result.nodeRows.map(r => r.boreMm), [300, 250]);
  assert.deepEqual(result.nodeRows.map(r => r.branchOccurrenceIndex), [0, 1]);
});

test('inaccurate node ordinal with valid duplicate-name key must hard block', () => {
  const displaced = [{ ...rows[0], nodeOrdinal: 1 }, rows[1]];
  assert.throws(() => applyPreviewBoreWallAuthority({
    xmlText: combined(300, 250), stagedJsonText: '', config: {},
    result: { branchRows: baseBranches, nodeRows: displaced },
  }), /node occurrence identity drift/);
});

test('reranked weights use their own repeated branch rating, not last-name rating', () => {
  const revised = rerankPreviewNodeRows(rows, baseBranches, {});
  assert.deepEqual(revised.map(r => r.rating), ['1500', '900']);
  assert.throws(() => rerankPreviewNodeRows([{ ...rows[0], branchOccurrenceIndex: 9 }], baseBranches, {}),
    /branch occurrence drift/);
});

test('run-parity internal rating checks remain occurrence-specific', () => {
  const pass = createStandaloneRunParityEvidence({
    xmlText: combined(300, 250), expectedEntries: [],
    branchRows: baseBranches, nodeRows: rows,
  });
  assert.equal(pass.ok, true, JSON.stringify(pass.mismatches));
  const corrupt = createStandaloneRunParityEvidence({
    xmlText: combined(300, 250), expectedEntries: [],
    branchRows: baseBranches, nodeRows: [{ ...rows[0], rating: '900' }, rows[1]],
  });
  assert.equal(corrupt.ok, false);
  assert.ok(corrupt.mismatches.some(m => m.type === 'weight-match-rating-parity'));
  const ambiguous = createStandaloneRunParityEvidence({
    xmlText: combined(300, 250), expectedEntries: [], branchRows: baseBranches,
    nodeRows: [{ ...rows[0], branchOccurrenceIndex: undefined }],
  });
  assert.equal(ambiguous.ok, false);
  assert.ok(ambiguous.mismatches.some(m => m.type === 'weight-match-rating-ambiguous-owner'));
});

test('strict line correction replaces only its own repeated-name node occurrence', () => {
  const core = () => ({
    branchRows: [
      { ...baseBranches[0], lineKeyMethod: 'similar-linekey' },
      { ...baseBranches[1], lineKeyMethod: 'exact' },
    ],
    nodeRows: rows,
  });
  const rebuilt = buildStrictLineAuthorityCorePreview(combined(300, 250), {}, '', {
    buildCorePreview: (xmlText) => xmlText === '<fragment>'
      ? { branchRows: [{ ...baseBranches[0] }], nodeRows: [{ ...rows[0], branchOccurrenceIndex: 0 }] }
      : core(),
    branchFragments: () => [{ xmlText: '<fragment>' }, { xmlText: '<fragment>' }],
  });
  assert.equal(rebuilt.nodeRows.length, 2);
  assert.deepEqual(rebuilt.nodeRows.map(r => r.branchOccurrenceIndex).sort(), [0, 1]);
  assert.equal(rebuilt.branchRows[0].lineKeyMethod, 'none');
  assert.equal(rebuilt.branchRows[1].lineKeyMethod, 'exact');
});
