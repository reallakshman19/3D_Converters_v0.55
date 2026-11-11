import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = await readFile(fileURLToPath(new URL('../tabs/model-converters/xml-cii-post-run-validator-standalone.js', import.meta.url)), 'utf8');
assert(!source.includes('WorkflowModal'), 'deprecated standalone validator must not open a modal');
assert(!source.includes("title: 'Weight Validator — Post-Run Results'"), 'obsolete all-good popup must stay removed');
assert(!source.includes('cfg.overrides.rigidWeight[key]'), 'deprecated validator must not mutate legacy weight authority');
assert(source.includes('DIAGNOSTIC_ONLY_NOT_WEIGHT_AUTHORITY'));
assert(source.includes('xml-cii-catalog-weight-validation-ready'));

console.log('xml-cii standalone deprecated weight validator UI tests: PASS');
