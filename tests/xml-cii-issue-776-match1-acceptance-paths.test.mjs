import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildXmlCiiRigidWeightMatch1Provenance,
  buildXmlCiiValidatedRigidWeightLegacyView,
  validateXmlCiiRigidWeightMatch1,
  withXmlCiiRigidWeightFinal,
  withXmlCiiRigidWeightMatch1,
} from '../converters/xml-cii2019-core/rigid-weight-authority.js';

const renderer = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_helper/weight-match-renderer.js', import.meta.url), 'utf8');
const standalone = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', import.meta.url), 'utf8');
const actions = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-weight-actions.js', import.meta.url), 'utf8');
const bulk = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-mode-a-bulk-weight.js', import.meta.url), 'utf8');

assert.match(renderer, /buildXmlCiiRigidWeightMatch1Provenance/);
assert.match(renderer, /rigidWeightProposalMeta/);
assert.match(renderer, /data-wm-row-index/);
assert.match(renderer, /buildXmlCiiValidatedRigidWeightLegacyView/);
assert.match(standalone, /withXmlCiiRigidWeightMatch1\(clean, \{ \.\.\.candidates, \.\.\.manual \}, proposalMeta\)/);
assert.match(standalone, /proposalMeta\[key\]\?\.acceptanceMethod === 'manual'/);
// Match-1 candidate/manual acceptance is not an automatic Final (Match-2) decision.
assert.doesNotMatch(standalone, /withXmlCiiRigidWeightFinal\s*\(/);
assert.match(standalone, /const changes = changedWeightMap\(nextConfig, baseline\)/);
assert.match(standalone, /persistConfig\(stateRef, staged\)/);
assert.match(renderer, /const initial = issue\.weight && issue\.weight > 0 \? issue\.weight : ''/);
assert.match(renderer, /input\.dataset\.wmSelectionOrigin = 'candidate'/);
assert.match(renderer, /input\.dataset\.wmAccepted = 'true'/);
assert.match(renderer, /input\.dataset\.wmSelectionOrigin === 'candidate' \? 'candidate' : 'manual'/);
assert.match(actions, /buildXmlCiiRigidWeightMatch1Provenance\(change, config/);
assert.match(actions, /rigidWeightMatch1Provenance/);
for (const field of ['componentRefNo','boreMm','rating','lengthMm','elementLengthSource']) {
  assert.match(bulk, new RegExp(field));
}


// Execute the actual shared lifecycle contract, not retired source-call spellings.
const candidateKey = '/AUTH-CANDIDATE/B1::70';
const manualKey = '/AUTH-MANUAL/B1::71';
const weightMaster = [{
  convertedBore: 80,
  rating: 300,
  type: 'FLAN',
  typeDesc: 'WELDING NECK FLANGE',
  lengthMm: 80,
  weight: 9,
}];
const config = {
  weight: { masterRevision: 7, masterRows: weightMaster },
  overrides: { rigidWeight: { [candidateKey]: 77, [manualKey]: 88 } },
};
const issueFor = (key, nodeNumber) => ({
  key,
  branchName: key.split('::')[0],
  nodeNumber,
  endpoint: '2',
  componentType: 'RIGID',
  componentRefNo: '=67133086/210',
  lengthMm: 84.37,
  elementLengthSource: 'staged ComponentRefNo',
  boreMm: 80,
  rating: '300',
});
const candidateIssue = issueFor(candidateKey, '70');
const manualIssue = issueFor(manualKey, '71');
const candidate = {
  type: 'FLAN',
  typeDesc: 'WELDING NECK FLANGE',
  rowBore: 80,
  rowRating: '300',
  rowLength: 80,
  masterWeight: 9,
  selectedWeight: 9.492,
  weightMethod: 'flange-length-extrapolated',
  rowData: weightMaster[0],
};
const candidateProvenance = buildXmlCiiRigidWeightMatch1Provenance(candidateIssue, config, candidate, {
  weightKg: 9.492, acceptanceMethod: 'candidate',
});
const manualProvenance = buildXmlCiiRigidWeightMatch1Provenance(manualIssue, config, null, {
  weightKg: 12.75, acceptanceMethod: 'manual',
});
assert.equal(candidateProvenance.acceptanceMethod, 'candidate');
assert.equal(manualProvenance.acceptanceMethod, 'manual');
assert.equal(candidateProvenance.candidate.masterWeightKg, 9);
assert.equal(manualProvenance.candidate, null);

// Merely computing a proposal never creates engineering-approved Match-1.
const unaccepted = withXmlCiiRigidWeightMatch1(config, {}, {});
assert.equal(validateXmlCiiRigidWeightMatch1(unaccepted, [candidateIssue, manualIssue]).validCount, 0);

// Explicit candidate click and typed manual input both enter Match-1 and retain
// their separate provenance; neither grants final-review authority.
const accepted = withXmlCiiRigidWeightMatch1(
  config,
  { [candidateKey]: 9.492, [manualKey]: 12.75 },
  { [candidateKey]: candidateProvenance, [manualKey]: manualProvenance },
);
assert.deepEqual(accepted.overrides.rigidWeightMatch1, {
  [candidateKey]: 9.492, [manualKey]: 12.75,
});
assert.equal(accepted.overrides.rigidWeightFinal?.[candidateKey], undefined);
assert.equal(accepted.overrides.rigidWeightFinal?.[manualKey], undefined);
const valid = validateXmlCiiRigidWeightMatch1(accepted, [candidateIssue, manualIssue]);
assert.equal(valid.validCount, 2);
assert.equal(valid.staleCount, 0);
const effective = buildXmlCiiValidatedRigidWeightLegacyView(accepted, [candidateIssue, manualIssue]);
assert.equal(effective.config.overrides.rigidWeight[candidateKey], 9.492);
assert.equal(effective.config.overrides.rigidWeight[manualKey], 12.75);

// Changed original geometry, Rating or weight master invalidates prior accepted
// values and cannot fall back to legacy 77/88kg or silently re-rank.
const changedLength = { ...candidateIssue, lengthMm: 168.74 };
const staleLength = buildXmlCiiValidatedRigidWeightLegacyView(accepted, [changedLength, manualIssue]);
assert.equal(staleLength.validation.stale[candidateKey].reason, 'basis-changed');
assert.ok(staleLength.validation.stale[candidateKey].changedFields.includes('lengthMm'));
assert.equal(staleLength.config.overrides.rigidWeight[candidateKey], undefined);
assert.equal(staleLength.config.overrides.rigidWeight[manualKey], 12.75);
const changedRating = validateXmlCiiRigidWeightMatch1(accepted, [
  candidateIssue, { ...manualIssue, rating: '600' },
]);
assert.ok(changedRating.stale[manualKey].changedFields.includes('rating'));
const changedMaster = {
  ...accepted,
  weight: { ...accepted.weight, masterRevision: 8 },
};
const staleMaster = validateXmlCiiRigidWeightMatch1(changedMaster, [candidateIssue, manualIssue]);
assert.equal(staleMaster.validCount, 0);
assert.equal(staleMaster.staleCount, 2);

// Final is an explicit later review, never produced by Match-1 save.
const finalReviewed = withXmlCiiRigidWeightFinal(accepted, { [candidateKey]: 11 });
assert.equal(finalReviewed.overrides.rigidWeightFinal[candidateKey], 11);
assert.equal(accepted.overrides.rigidWeightFinal?.[candidateKey], undefined);

console.log('Issue #776 Match-1 acceptance paths carry provenance.');
