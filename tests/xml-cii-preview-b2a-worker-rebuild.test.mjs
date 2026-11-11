import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const path='tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-renderer.js';
const code=()=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('class transaction rebuild is worker/basis fenced and must propagate failure for rollback',async()=>{
  const s=await code();
  const classCallback=s.match(/rebuildPreview:\s*async\s*\(\{\s*hydrationResult,[\s\S]*?\n\s*\},\n\s*\}\)\.catch/);
  assert.ok(classCallback,'atomic class transaction callback absent');
  assert.match(classCallback[0],/await xmlCiiRebuildPreviewThroughWorker\(rootEl, xmlText, config, options\)/);
  assert.doesNotMatch(classCallback[0],/await xmlCiiBuildAndRenderPreview\(/);
  assert.match(s,/export async function xmlCiiRebuildPreviewThroughWorker/);
  assert.match(s,/if \(!rendered\)\s*\{\s*throw Object.assign/);
  assert.match(s,/skipLegacyCache:\s*true/);
  assert.match(s,/precomputedPreview:\s*result/);
});
test('branch-map rebuild cannot fire unobserved synchronous enrichment',async()=>{
  const s=await code();
  const cb=s.match(/onRebuildPreview:\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*\}\n\s*\}\);/);
  assert.ok(cb,'line map callback missing');
  assert.match(cb[0],/void xmlCiiRebuildPreviewThroughWorker\([\s\S]*?\.catch\(/);
  assert.doesNotMatch(cb[0],/void xmlCiiBuildAndRenderPreview\(/);
});
test('renderer deployment mirror is exact',async()=>{
  const a=await code();
  const b=await readFile(new URL('../docs/'+path,import.meta.url),'utf8');
  assert.equal(a,b);
});
