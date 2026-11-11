import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceModel = await readFile(new URL('../converters/xml-cii2019-core/weight-match-model.js', import.meta.url), 'utf8');
const docsModel = await readFile(new URL('../docs/converters/xml-cii2019-core/weight-match-model.js', import.meta.url), 'utf8');
const sourceRenderer = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const docsRenderer = await readFile(new URL('../docs/tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const standaloneUi = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match.js', import.meta.url), 'utf8');
const docsStandaloneUi = await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match.js', import.meta.url), 'utf8');

assert.equal(sourceModel, docsModel, 'weight-match model source/docs mirrors must remain byte-identical');
assert.equal(sourceRenderer, docsRenderer, 'weight-match renderer source/docs mirrors must remain byte-identical');
assert.equal(standaloneUi, docsStandaloneUi, 'Standalone Weight Match source/docs mirrors must remain byte-identical');

assert.match(sourceModel, /export function isXmlCiiWeightReviewConnectionEligible\(node\)/);
assert.match(sourceModel, /return !connectionType \|\| isXmlCiiRigidNode\(node\)/);
assert.match(sourceModel, /if \(!isXmlCiiWeightReviewConnectionEligible\(node\)\) return;/);
assert.doesNotMatch(sourceModel, /if \(connectionType\) return;/);

for (const ui of [sourceRenderer, standaloneUi]) {
  assert.match(ui, /non-empty ConnectionType/);
  assert.match(ui, /physical RIGID \/ Rigid=2 weight owner/);
}

console.log('Issue #821 rigid ConnectionType weight-review eligibility contract passed.');
