import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { weightMatchAuthorityPresentation } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js';

const renderer = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const validation = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-validation-report.js', import.meta.url), 'utf8');

assert.match(renderer, /Proposed.*not engineering authority/s);
assert.match(renderer, /Accepted · Match-1 · Suggested/);
assert.match(renderer, /Accepted · Match-1 · Manual/);
assert.match(renderer, /input\.dataset\.wmAccepted\s*=\s*'true'/);
assert.match(renderer, /input\.dataset\.wmSelectionOrigin\s*===\s*'candidate'/);
assert.match(renderer, /acceptCandidate\(input, selection\.weight\)/);
assert.match(renderer, /data-wm-accepted/);
for(const statusText of ['Accepted · Match-1 · Suggested', 'Accepted · Match-1 · Manual']) {
  const presentation = weightMatchAuthorityPresentation({accepted:true,statusText,candidateWeight:35});
  assert.equal(presentation.state, 'MATCH1_ACCEPTED',
    'Explicitly accepted Match-1 must not appear as generic source authority');
  assert.equal(presentation.detailLabel, 'Engineering authority: Match-1');
}
const proposal = weightMatchAuthorityPresentation({accepted:false,
  statusText:'Proposed · valve ranking',candidateWeight:35,candidateMethod:'candidate'});
assert.equal(proposal.state,'CANDIDATE_NOT_ACCEPTED');
assert.equal(proposal.actionPrefix,'Accept as Match-1');
assert.match(renderer, /xml-cii-weight-validator-ready/);
assert.match(validation, /Proposed — not accepted/);
for (const code of ['UNKNOWN_TYPE_DESC','INVALID_RATING','INVALID_SIZE','A1_MODEL_NOT_FOUND','OUTSIDE_VALIDATED_SIZE_RANGE']) {
  assert.match(validation, new RegExp(code));
}
assert.match(validation, /Unavailable code\(s\)/);

console.log('Issue #776 Weight Match acceptance/validation semantics verified.');
