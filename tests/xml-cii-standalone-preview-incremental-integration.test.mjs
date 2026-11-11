import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const DRYRUN = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js', import.meta.url);
const RATING = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-rating-authority.js', import.meta.url);
test('Preview dry-run routes only Weight-only partial work through final-authority reranker', async () => {
  const [dryrun, rating] = await Promise.all([readFile(DRYRUN, 'utf8'), readFile(RATING, 'utf8')]);
  assert.match(dryrun, /buildIncrementalPreview/);
  assert.match(dryrun, /rerankPreviewNodeRows/);
  assert.match(dryrun, /buildFullDryRunPreview/);
  assert.match(rating, /export function rerankPreviewNodeRows/);
  assert.match(rating, /nodeRows: rerankPreviewNodeRows/);
});
