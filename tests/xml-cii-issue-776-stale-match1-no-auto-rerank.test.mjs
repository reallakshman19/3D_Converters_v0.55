import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Execute independent saved-weight/changed-basis fixtures at the current release
// boundary, including 57.25kg becoming stale after length, Rating or master change.
import './xml-cii-weight-output-authority.test.mjs';

const source = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js', import.meta.url), 'utf8');

const authority = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-weight-output-authority.js', import.meta.url), 'utf8');
assert.match(source, /prepareStandaloneRigidWeightAuthority\(parity, sourceText/);
assert.match(source, /supportConfigJson: JSON\.stringify\(deferStandaloneRigidWeights\(supportConfig\)\)/);
assert.match(source, /applyStandaloneAcceptedRigidWeights\(/);
assert.match(authority, /dryRun: true, skipAutoWeightMatch: true/);
assert.match(authority, /rigidWeightMatch1: validated\.validation\.validWeights/);
assert.doesNotMatch(source, /const auto = nr\.weightMatch/);

const run = source.slice(source.indexOf('export async function enrichStandaloneXmlForRun'));
const validateIndex = run.indexOf('const validated = prepareStandaloneRigidWeightAuthority');
const enrichIndex = run.indexOf('const enriched = await parity.enrichXmlForCii2019');
const releaseIndex = run.indexOf('applyStandaloneAcceptedRigidWeights');
assert.ok(validateIndex >= 0 && enrichIndex > validateIndex && releaseIndex > enrichIndex,
  'saved weights must be validated before deferred enrichment and accepted-only release');

console.log('Issue #776 stale Match-1 cannot silently auto-rerank during standalone CII run.');
