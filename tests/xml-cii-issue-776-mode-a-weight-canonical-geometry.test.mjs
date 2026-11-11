import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated.js', import.meta.url), 'utf8');

assert.match(source, /const collector = runtime.collector \|\| collectModeARigidWeightReviewIssues/);
assert.match(source, /await collector\(entry.state, config\)/);
assert.match(source, /staleMatch1Count: sourceRows.filter/);
const review = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-rigid-review-mode-a.js', import.meta.url), 'utf8');
assert.match(review, /materializeXmlCiiDatasetBackedConfig\(config, state\)/);
assert.match(review, /prepareStandaloneWeightReviewXml\(state, effectiveConfig\)/);
assert.match(review, /prepared.weightAuthority/);

console.log('Issue #776 Mode-A Weight Match uses canonical prepared geometry.');
