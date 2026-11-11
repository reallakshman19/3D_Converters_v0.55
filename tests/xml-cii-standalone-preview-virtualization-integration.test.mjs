import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const PATH = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js', import.meta.url);
test('master Preview uses virtual windowing and does not truncate search results to 150 rows', async () => {
  const source = await readFile(PATH, 'utf8');
  assert.match(source, /buildMatchingRowIndexes/);
  assert.match(source, /replaceVirtualPreviewRows/);
  assert.match(source, /addEventListener\('scroll'/);
  assert.doesNotMatch(source, /filtered\.slice\(0,\s*150\)/);
  assert.match(source, /virtualized/);
});
