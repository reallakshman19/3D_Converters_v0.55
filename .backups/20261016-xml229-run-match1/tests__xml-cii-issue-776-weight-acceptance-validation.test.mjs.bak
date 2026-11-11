import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const validation = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js', import.meta.url), 'utf8');

assert.match(renderer, /Proposed.*not engineering authority/s);
assert.match(renderer, /Accepted · Match-1/);
assert.match(renderer, /data-wm-accepted/);
assert.match(renderer, /xml-cii-weight-validator-ready/);
assert.match(validation, /Proposed — not accepted/);
for (const code of ['UNKNOWN_TYPE_DESC','INVALID_RATING','INVALID_SIZE','A1_MODEL_NOT_FOUND','OUTSIDE_VALIDATED_SIZE_RANGE']) {
  assert.match(validation, new RegExp(code));
}
assert.match(validation, /Unavailable code\(s\)/);

console.log('Issue #776 Weight Match acceptance/validation semantics verified.');
