import assert from 'node:assert/strict';
import {
  buildXmlCiiRigidWeightMatch1Provenance,
  buildXmlCiiValidatedRigidWeightLegacyView,
  withXmlCiiRigidWeightMatch1,
} from '../converters/xml-cii2019-core/rigid-weight-authority.js';
import { readFile } from 'node:fs/promises';

const key = '/BWWA/B1::70';
const issue = {
  key,
  branchName: '/BWWA/B1',
  nodeNumber: '70',
  endpoint: '2',
  componentType: 'RIGID',
  componentRefNo: '=67133086/210',
  boreMm: 80,
  rating: '300',
  lengthMm: 84.37,
  elementLengthSource: 'staged ComponentRefNo',
};
const base = {
  weight: { masterRevision: 1, masterRows: [{ convertedBore: 80, rating: 300, lengthMm: 80, weight: 9, type: 'FLAN' }] },
  overrides: { rigidWeight: { [key]: 77 } },
};
const provenance = buildXmlCiiRigidWeightMatch1Provenance(issue, base, null, { weightKg: 9.492, acceptanceMethod: 'manual' });
const accepted = withXmlCiiRigidWeightMatch1(base, { [key]: 9.492 }, { [key]: provenance });

const valid = buildXmlCiiValidatedRigidWeightLegacyView(accepted, [issue]);
assert.equal(valid.config.overrides.rigidWeight[key], 9.492, 'valid Match-1 must outrank legacy');

const stale = buildXmlCiiValidatedRigidWeightLegacyView(accepted, [{ ...issue, lengthMm: 168.74 }]);
assert.equal(stale.validation.stale[key].reason, 'basis-changed');
assert.equal(stale.config.overrides.rigidWeight[key], undefined, 'stale Match-1 must force review instead of silently falling back to weaker legacy evidence');
assert.deepEqual(stale.validation.suppressedLegacyKeys, [key]);

const adapter = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js', import.meta.url), 'utf8');
assert.doesNotMatch(adapter, /JSON\.stringify\(withXmlCiiEffectiveRigidWeightLegacyView\(config\)/);

const runner = await readFile(new URL('../tabs/model-converters/converters/xmltocii2019_runner.js', import.meta.url), 'utf8');
assert.match(runner, /buildXmlCiiValidatedRigidWeightLegacyView\(enriched\.config, weightBasisRows\)/);
const releaseIndex = runner.indexOf('enriched.config = validatedWeightView.config');
assert.ok(
  releaseIndex >= 0 && releaseIndex < runner.indexOf('applySavedRigidWeightOverridesToEnriched(enriched)', releaseIndex),
  'stale Match-1 must be rejected before saved weights are written into enriched XML',
);

const activeReview = await readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-run-workflow-atta-default.js', import.meta.url), 'utf8');
assert.match(activeReview, /collectModeARigidWeightReviewIssues\(state, config\)/);
assert.doesNotMatch(activeReview, /const effectiveConfig = withXmlCiiEffectiveRigidWeightLegacyView\(config\)/);

const authority = await readFile(new URL('../tabs/xml-cii-2019-standalone/xml-cii-weight-output-authority.js', import.meta.url), 'utf8');
assert.match(authority, /buildXmlCiiValidatedRigidWeightLegacyView\(basisConfig, basisRows\)/);
assert.match(authority, /Accepted weight has no output node/);

console.log('Issue #776 downstream Match-1 validation regression passed.');
