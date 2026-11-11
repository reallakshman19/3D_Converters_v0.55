import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const moduleUrl = new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js', import.meta.url).href;
const { weightMatchAuthorityPresentation } = await import(moduleUrl);

const suggested = weightMatchAuthorityPresentation({
  accepted: false,
  statusText: 'Proposed · Suggested',
  candidateWeight: 59,
  candidateMethod: 'Suggested',
});
assert.equal(suggested.state, 'CANDIDATE_NOT_ACCEPTED');
assert.equal(suggested.statusLabel, 'Candidate matched ✓');
assert.equal(suggested.detailLabel, 'Engineering status: NOT ACCEPTED');
assert.equal(suggested.actionPrefix, 'Accept as Match-1');
assert.equal(suggested.suggestedWeightLabel, 'Suggested weight: 59 kg');

const acceptedMatch1 = weightMatchAuthorityPresentation({
  accepted: true,
  statusText: 'Accepted · Match-1',
  candidateWeight: 59,
});
assert.equal(acceptedMatch1.state, 'MATCH1_ACCEPTED');
assert.equal(acceptedMatch1.statusLabel, 'Accepted Match-1 ✓');
assert.equal(acceptedMatch1.detailLabel, 'Engineering authority: Match-1');
assert.equal(acceptedMatch1.actionPrefix, '');

const acceptedOtherAuthority = weightMatchAuthorityPresentation({
  accepted: true,
  statusText: 'Accepted · rigidWeightFinal',
  candidateWeight: 59,
});
assert.equal(acceptedOtherAuthority.state, 'RESOLVED_AUTHORITY');
assert.equal(acceptedOtherAuthority.statusLabel, 'Accepted · rigidWeightFinal');
assert.notEqual(acceptedOtherAuthority.statusLabel, 'Accepted Match-1 ✓');

const unresolved = weightMatchAuthorityPresentation({ accepted: false, statusText: 'Unresolved' });
assert.equal(unresolved.state, 'UNRESOLVED');
assert.equal(unresolved.detailLabel, 'Engineering status: NOT ACCEPTED');

const adapter = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', import.meta.url), 'utf8');
assert.ok(adapter.includes('installWeightMatchAuthorityPresentation'));
assert.ok(adapter.includes('withXmlCiiRigidWeightMatch1'));

const authority = await readFile(new URL('../converters/xml-cii2019-core/rigid-weight-authority.js', import.meta.url), 'utf8');
assert.ok(authority.includes("final: 'rigidWeightFinal'"));
assert.ok(authority.includes("match1: 'rigidWeightMatch1'"));
assert.ok(authority.includes('buildXmlCiiRigidWeightMatch1Provenance'));

const runtimeHelper = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js', import.meta.url), 'utf8');
const docsHelper = await readFile(new URL('../docs/tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-authority-ui.js', import.meta.url), 'utf8');
assert.equal(docsHelper, runtimeHelper, 'docs mirror drift for Weight Match authority presentation helper');

console.log('Issue #781 Weight Match authority presentation qualification passed.');
