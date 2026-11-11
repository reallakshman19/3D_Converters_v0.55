import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.join(REPO, 'tabs/xml-cii-2019-standalone/ui-adapted');
const read = (name) => fs.readFileSync(path.join(UI, name), 'utf8');

test('full Preview forwards one cached raw source document through its authorities', () => {
  const wrapper = read('xml-cii-adapted-preview-dryrun.js');
  assert.match(wrapper, /getSourceDocumentContext\(xmlText\)\.document/);
  assert.match(wrapper, /buildStrictLineAuthorityCorePreview\([\s\S]*\{ sourceDocument \}/);
  assert.match(wrapper, /applyPreviewBoreWallAuthority\([\s\S]*sourceDocument/);
  assert.match(wrapper, /applyPreviewRatingAuthority\([\s\S]*sourceDocument/);
});

test('core clones raw DOM before cleanup and retains parser fallback', () => {
  const core = read('xml-cii-adapted-preview-dryrun-core.js');
  assert.match(core, /sourceDocument\.cloneNode\(true\)/);
  assert.match(core, /new DOMParser\(\)\.parseFromString/);
  assert.match(core, /xmlCiiDryRunPreview\(xmlText, config, stagedJsonText, runtime = \{\}\)/);
});

test('Bore-Wall and Rating use provided raw DOM with fail-closed parser fallbacks', () => {
  const wall = read('xml-cii-adapted-preview-bore-wall-authority.js');
  const rating = read('xml-cii-adapted-preview-rating-authority.js');
  assert.match(wall, /sourceDocumentOrParse\(xmlText, sourceDocument\)/);
  assert.match(wall, /if \(sourceDocument\)/);
  assert.match(rating, /ratingSourceDocument\(xmlText, sourceDocument\)/);
  assert.match(rating, /if \(sourceDocument\)/);
});

test('exact-source context reuses same-text DOM and invalidates on source change', async () => {
  const source = read('xml-cii-adapted-source-derived-context.js')
    .replace(/^import .*\n/, 'const perfAddMs=()=>{}; const perfCount=()=>{}; const perfNow=()=>0;\n');
  let parses = 0;
  globalThis.DOMParser = class { parseFromString(text) { parses += 1; return { text }; } };
  const mod = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}#c6b`);
  mod.resetSourceDocumentContextCache();
  const a1 = mod.getSourceDocumentContext('<A/>');
  const a2 = mod.getSourceDocumentContext('<A/>');
  assert.equal(parses, 1);
  assert.equal(a1.document, a2.document);
  mod.getSourceDocumentContext('<B/>');
  assert.equal(parses, 2);
});
