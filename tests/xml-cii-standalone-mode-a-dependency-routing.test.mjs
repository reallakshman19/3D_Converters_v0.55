import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const tempRoot = await mkdtemp(join(tmpdir(), 'xml-cii-mode-a-dependency-routing-'));
const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-state.js';
const target = join(tempRoot, sourcePath);
await mkdir(dirname(target), { recursive: true });
await copyFile(fileURLToPath(new URL(`../${sourcePath}`, import.meta.url)), target);
await writeFile(join(tempRoot, 'package.json'), '{"type":"module"}', 'utf8');

const standaloneDir = join(tempRoot, 'tabs/xml-cii-2019-standalone');
const adaptedDir = join(standaloneDir, 'ui-adapted');
await mkdir(adaptedDir, { recursive: true });
await writeFile(join(standaloneDir, 'xml-cii-mode-a-batch.js'), `
export function activateModeASource(state) { return state; }
export function createModeASourceEntry(row) { return row; }
export function normalizeModeABatchState(state) { return state; }
export function syncActiveModeASource(state) { return state; }
`, 'utf8');
await writeFile(join(adaptedDir, 'xml-cii-adapted-preview-cache-v7.js'), `
export function clearPreviewCachesV7() {}
`, 'utf8');
await writeFile(join(adaptedDir, 'xml-cii-adapted-state.js'), `
function configText(state) { return String(state?.supportConfigJson || ''); }
export function updateWorkflowState(previous, patch = {}) {
  const next = { ...previous, ...patch };
  const prior = previous?.dependencyRevisions || { sourceModelRevision: 0, supportConfigRevision: 0 };
  const sourceChanged = String(previous?.sourceText || '') !== String(next?.sourceText || '');
  const configChanged = configText(previous) !== configText(next);
  return {
    ...next,
    dependencyRevisions: {
      ...prior,
      sourceModelRevision: Number(prior.sourceModelRevision || 0) + (sourceChanged ? 1 : 0),
      supportConfigRevision: Number(prior.supportConfigRevision || 0) + (configChanged ? 1 : 0),
    },
    dependencyRevisionBasis: { config: configText(next) },
  };
}
`, 'utf8');

const modeA = await import(pathToFileURL(target).href);
after(() => rm(tempRoot, { recursive: true, force: true }));

test('normal Mode-A assignment preserves exact replacement payload and advances source revision', () => {
  const baseRef = { current: {
    sourceText: 'A', supportConfigJson: '{"x":1}', staleOnly: 'remove-me',
    dependencyRevisions: { sourceModelRevision: 2, supportConfigRevision: 3 },
  } };
  const ref = modeA.createXmlCiiModeAStateRef(baseRef);
  ref.current = { sourceText: 'B', supportConfigJson: '{"x":1}', keep: 'new' };
  assert.equal(baseRef.current.sourceText, 'B');
  assert.equal(baseRef.current.keep, 'new');
  assert.equal('staleOnly' in baseRef.current, false, 'replacement semantics must not become merge semantics');
  assert.equal(baseRef.current.dependencyRevisions.sourceModelRevision, 3);
  assert.equal(baseRef.current.dependencyRevisions.supportConfigRevision, 3);
});

test('replaceModeAState strips marker, preserves replacement payload, and advances config revision', () => {
  const baseRef = { current: {
    sourceText: 'B', supportConfigJson: '{"x":1}', staleOnly: 'remove-me',
    dependencyRevisions: { sourceModelRevision: 3, supportConfigRevision: 3 },
  } };
  const ref = modeA.createXmlCiiModeAStateRef(baseRef);
  modeA.replaceModeAState(ref, { sourceText: 'B', supportConfigJson: '{"x":2}', keep: 'replacement' });
  assert.equal(baseRef.current.supportConfigJson, '{"x":2}');
  assert.equal(baseRef.current.keep, 'replacement');
  assert.equal('__modeAReplace' in baseRef.current, false);
  assert.equal('staleOnly' in baseRef.current, false);
  assert.equal(baseRef.current.dependencyRevisions.sourceModelRevision, 3);
  assert.equal(baseRef.current.dependencyRevisions.supportConfigRevision, 4);
});
