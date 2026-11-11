import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const path of [
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js',
  '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js',
]) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  assert.match(source, /function staleMatch1Notice\(issue\)/);
  assert.match(source, /Prior Match-1 .* invalidated/);
  assert.match(source, /changedFields/);
  assert.match(source, /data-stale-match1/);
}

console.log('Issue #776 final review explicitly surfaces stale Match-1 invalidation.');
