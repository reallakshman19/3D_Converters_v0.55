import assert from 'node:assert/strict';
import {
  buildXmlCiiRigidWeightMatch1Provenance,
  buildXmlCiiValidatedRigidWeightLegacyView,
  validateXmlCiiRigidWeightMatch1,
  withXmlCiiRigidWeightMatch1,
  xmlCiiWeightMasterRevision,
} from '../converters/xml-cii2019-core/rigid-weight-authority.js';

const key = '/BWWA-1000-3"-W1410201-31422R5-01/B1::70';
const masterRows = [{
  convertedBore: 80,
  rating: 300,
  type: 'FLAN',
  typeDesc: 'WELDING NECK FLANGE SCH 40 300#',
  lengthMm: 80,
  weight: 9,
}];
const config = { weight: { masterRevision: 7, masterRows }, overrides: {} };
const issue = {
  key,
  branchName: '/BWWA-1000-3"-W1410201-31422R5-01/B1',
  nodeNumber: '70',
  endpoint: '2',
  componentType: 'RIGID',
  componentRefNo: '=67133086/210',
  lengthMm: 84.37,
  elementLengthSource: 'staged ComponentRefNo',
  boreMm: 80,
  rating: '300',
};
const candidate = {
  type: 'FLAN',
  typeDesc: 'WELDING NECK FLANGE SCH 40 300#',
  rowBore: 80,
  rowRating: '300',
  rowLength: 80,
  masterWeight: 9,
  selectedWeight: 9.492,
  weightMethod: 'flange-length-extrapolated',
  rowData: masterRows[0],
};

const provenance = buildXmlCiiRigidWeightMatch1Provenance(issue, config, candidate, {
  weightKg: 9.492,
  acceptanceMethod: 'candidate',
});
assert.equal(provenance.acceptedWeightKg, 9.492);
assert.equal(provenance.basis.lengthMm, 84.37);
assert.equal(provenance.basis.componentRefNo, '67133086/210');
assert.equal(provenance.basis.rating, '300');
assert.match(provenance.basis.weightMasterRevision, /^7\|1:fnv1a:/);
assert.equal(provenance.candidate.masterWeightKg, 9);
assert.equal(provenance.candidate.rowLength, 80);

const accepted = withXmlCiiRigidWeightMatch1(config, { [key]: 9.492 }, { [key]: provenance });
assert.deepEqual(validateXmlCiiRigidWeightMatch1(accepted, [issue]).validWeights, { [key]: 9.492 });
const validView = buildXmlCiiValidatedRigidWeightLegacyView(accepted, [issue]);
assert.equal(validView.config.overrides.rigidWeight[key], 9.492);
assert.equal(validView.validation.staleCount, 0);

const doubledLength = { ...issue, lengthMm: 168.74 };
const staleLength = validateXmlCiiRigidWeightMatch1(accepted, [doubledLength]);
assert.equal(staleLength.validCount, 0);
assert.equal(staleLength.stale[key].reason, 'basis-changed');
assert.ok(staleLength.stale[key].changedFields.includes('lengthMm'));
assert.equal(buildXmlCiiValidatedRigidWeightLegacyView(accepted, [doubledLength]).config.overrides.rigidWeight[key], undefined);

const changedRating = validateXmlCiiRigidWeightMatch1(accepted, [{ ...issue, rating: '600' }]);
assert.ok(changedRating.stale[key].changedFields.includes('rating'));

const changedRef = validateXmlCiiRigidWeightMatch1(accepted, [{ ...issue, componentRefNo: '=DIFFERENT' }]);
assert.ok(changedRef.stale[key].changedFields.includes('componentRefNo'));

const changedBore = validateXmlCiiRigidWeightMatch1(accepted, [{ ...issue, boreMm: 100 }]);
assert.ok(changedBore.stale[key].changedFields.includes('boreMm'));

const changedMaster = {
  ...accepted,
  weight: { ...accepted.weight, masterRevision: 8, masterRows },
};
assert.notEqual(xmlCiiWeightMasterRevision(changedMaster), xmlCiiWeightMasterRevision(accepted));
assert.ok(validateXmlCiiRigidWeightMatch1(changedMaster, [issue]).stale[key].changedFields.includes('weightMasterRevision'));

const missingProvenance = withXmlCiiRigidWeightMatch1(config, { [key]: 9.492 });
assert.equal(validateXmlCiiRigidWeightMatch1(missingProvenance, [issue]).stale[key].reason, 'missing-provenance');

console.log('Issue #776 Match-1 provenance/fingerprint regression passed.');
