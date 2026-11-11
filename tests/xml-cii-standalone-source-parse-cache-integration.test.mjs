import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const MODE = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-source-mode.js', import.meta.url);
const PREVIEW = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-source-preview.js', import.meta.url);

test('validity and hierarchy both consume shared source context and no longer own DOMParser', async () => {
  const [mode, preview] = await Promise.all([readFile(MODE, 'utf8'), readFile(PREVIEW, 'utf8')]);
  for (const [name, source] of [['source-mode', mode], ['source-preview', preview]]) {
    assert.match(source, /getSourceDocumentContext/, `${name} must use shared source context`);
    assert.doesNotMatch(source, /new\s+DOMParser\s*\(/, `${name} must not parse source independently`);
  }
});

test('real empty-source Source Mode render explicitly evicts the derived document cache', async () => {
  const mode = await readFile(MODE, 'utf8');
  assert.match(mode, /resetSourceDocumentContextCache/);
  assert.match(mode, /if \(!state\.sourceText\) resetSourceDocumentContextCache\(\);/);
});
