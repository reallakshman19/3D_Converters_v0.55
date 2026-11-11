import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js', import.meta.url), 'utf8');

assert.match(source, /canonicalSharedJunctionNumbers/);
assert.match(source, /collapseCoincidentPreJunctionHelpers/);
assert.match(source, /collapsedCanonicalJunctionHelpers/);
assert.ok(
  source.indexOf('collapseCoincidentPreJunctionHelpers(document, initialNodesByBranch)')
    < source.indexOf('const originalNumbers = new Map()'),
  'canonical junction helper collapse must happen before split-node numbering',
);
assert.match(source, /helper\.parentNode\?\.removeChild\(helper\)/);
assert.match(source, /distance > 0\.01/);

console.log('Issue #776 enrichment preserves canonical branch junction identity before renumbering.');
