import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-consolidated-easy-weight-ui.js', import.meta.url), 'utf8');
assert.match(source, /row\.weightSource='weight-match-1'/);
assert.match(source, /textContent='Match-1'/);
assert.match(source, /textContent='ACCEPTED'/);
assert.doesNotMatch(source, /row\.weightSource='override'/);

console.log('Issue #776 Mode-A accepted weights are labelled as Match-1 authority.');
