import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import {
  XmlCiiAdaptedEditablePreviewTable,
  previewMaterialCodeSuggestionEvidence,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-editable-preview-table.js';
import {
  resolvePreviewMaterialCodeAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js';

const reviewRow = {
  branchName: '/TEST/B1',
  lineKey: 'P0310080',
  pipingClass: '61440',
  size: '400 mm',
  sizeMm: 400,
  material: 'ASTM A106-C',
  materialSource: 'process-linelist-material',
  materialCode: '',
  materialCodeNeedsReview: true,
  materialCodeMethod: 'none',
  materialCodeResolutionMethod: 'below-threshold',
  materialCodeConfidence: 0.5,
  materialCodeCandidates: [{
    materialCode: '106',
    matchedMaterial: 'A106-B',
    score: 0.5,
    method: 'weak-fuzzy',
    reasons: ['specification-exact'],
  }],
};

test('existing candidate evidence is presentable without becoming material-code authority', () => {
  const source = structuredClone(reviewRow);
  const evidence = previewMaterialCodeSuggestionEvidence(source);
  assert.deepEqual(evidence, {
    materialCode: '106',
    matchedMaterial: 'A106-B',
    confidence: 0.5,
    method: 'weak-fuzzy',
    reasons: ['specification-exact'],
  });
  assert.equal(source.materialCode, '');
  assert.equal(source.materialCodeNeedsReview, true);
  assert.equal(Object.hasOwn(source, 'materialCodeSuggested'), false);
});

test('authoritative material code suppresses review-only suggestion presentation', () => {
  assert.equal(previewMaterialCodeSuggestionEvidence({ ...reviewRow, materialCode: '106' }), null);
});

test('no candidate evidence produces no suggestion', () => {
  assert.equal(previewMaterialCodeSuggestionEvidence({ ...reviewRow, materialCodeCandidates: [] }), null);
});

test('Preview table renders suggestion separately while editable authority value remains blank', () => {
  const table = new XmlCiiAdaptedEditablePreviewTable({
    branchRows: [reviewRow],
    nodesByBranch: new Map(),
    matchBadgeHtmlRenderer: (method, confidence, needsReview, value) => `<span class="mc-preview-editable-val">${value || '—'}</span>`,
  });
  const html = table.renderHTML();
  assert.match(html, /data-mc-material-code-suggestion/);
  assert.match(html, /Suggested: 106 \/ A106-B/);
  assert.match(html, /review required · 50%/);
  assert.match(html, /Suggestion only; authoritative Material Code remains blank/);
  assert.match(html, /<span class="mc-preview-editable-val">—<\/span><div data-mc-material-code-suggestion/);
});

test('material resolver can retain candidate 106 while authoritative code stays blank', () => {
  const result = resolvePreviewMaterialCodeAuthority({
    lineKey: 'P0310080',
    pipingClass: '61440',
    material: 'ASTM A106-C',
    materialSource: 'linelist',
  }, {
    material: { mapRows: [{ code: '106', material: 'A106-B' }] },
  });
  assert.equal(result.materialCode, '');
  assert.equal(result.materialCodeNeedsReview, true);
  assert.equal(result.materialCodeCandidates[0]?.materialCode, '106');
  assert.equal(result.materialCodeCandidates[0]?.matchedMaterial, 'A106-B');
});

test('implementation introduces no parallel materialCodeSuggested state and docs mirror matches', async () => {
  const runtime = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-editable-preview-table.js', import.meta.url), 'utf8');
  const docs = await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-editable-preview-table.js', import.meta.url), 'utf8');
  assert.equal(docs, runtime, 'docs mirror drift for editable Preview table');
  assert.equal(runtime.includes('materialCodeSuggested'), false);
});
