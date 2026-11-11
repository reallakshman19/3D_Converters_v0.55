import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildXmlCiiRigidWeightMatch1Provenance,
  validateXmlCiiRigidWeightMatch1,
  withXmlCiiRigidWeightMatch1,
  xmlCiiWeightMasterRevision,
  xmlCiiWeightMasterRowsFingerprint,
} from '../converters/xml-cii2019-core/rigid-weight-authority.js';
import {
  commitAppliedMaster,
  persistChangedMasterDetailed,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';

const rows = [
  { convertedBore: 80, rating: 300, type: 'FLAN', lengthMm: 80, weight: 9 },
  { convertedBore: 100, rating: 600, type: 'VALV', lengthMm: 120, weight: 14 },
];
const issue = {
  key: 'branch::70', branchName: 'branch', nodeNumber: '70', endpoint: '2',
  componentType: 'RIGID', componentRefNo: '=REF-1', lengthMm: 84.37,
  elementLengthSource: 'prepared', boreMm: 80, rating: '300',
};

function installStorage(entries = {}) {
  const previous = globalThis.localStorage;
  const values = new Map(Object.entries(entries));
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

test('compact Weight metadata preserves the exact Match-1 master authority basis', () => {
  const masterFingerprint = xmlCiiWeightMasterRowsFingerprint(rows);
  const full = { weight: { masterRevision: 7, masterRows: rows }, overrides: {} };
  const compact = { weight: { masterRevision: 7, masterFingerprint }, overrides: {} };
  assert.equal(xmlCiiWeightMasterRevision(compact), xmlCiiWeightMasterRevision(full));

  const provenance = buildXmlCiiRigidWeightMatch1Provenance(issue, full, null, {
    weightKg: 9.5,
    acceptanceMethod: 'manual',
  });
  const acceptedFull = withXmlCiiRigidWeightMatch1(full, { [issue.key]: 9.5 }, { [issue.key]: provenance });
  const acceptedCompact = { ...compact, overrides: acceptedFull.overrides };
  assert.deepEqual(validateXmlCiiRigidWeightMatch1(acceptedCompact, [issue]).validWeights, { [issue.key]: 9.5 });

  const inconsistent = { weight: { masterRevision: 7, masterRows: rows, masterFingerprint: 'wrong' } };
  assert.equal(xmlCiiWeightMasterRevision(inconsistent), xmlCiiWeightMasterRevision(full), 'actual rows must outrank stale metadata');
});

test('dataset-backed Weight commit stores fingerprint/revision metadata without masterRows', () => {
  const storage = installStorage();
  try {
    const committed = commitAppliedMaster({
      context: { config: {}, appliedMappingRevision: { weight: 4 } },
      config: {}, key: 'weight', fieldMap: { weight: 'Weight' }, rawRows: rows,
      normalizedRows: rows,
      datasetMetadata: { datasetId: 'weight-ds', rowCount: rows.length, masterKey: 'weight', fileName: 'weights.xlsx' },
      sourceMetadata: { source: 'weights.xlsx' },
    });
    assert.equal('masterRows' in committed.config.weight, false);
    assert.equal(committed.config.weight.masterRevision, 5);
    assert.equal(committed.config.weight.masterFingerprint, xmlCiiWeightMasterRowsFingerprint(rows));
    assert.equal(committed.context.datasetRefs.weight.masterFingerprint, committed.config.weight.masterFingerprint);

    persistChangedMasterDetailed('weight', committed.context);
    const custody = JSON.parse(storage.values.get('xml-cii-master-source-weight'));
    assert.equal(custody.masterFingerprint, committed.config.weight.masterFingerprint);
  } finally {
    storage.restore();
  }
});

test('startup restore reconstructs legacy missing Weight fingerprint while keeping compact config', async () => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'weights.xlsx', datasetId: 'weight-ds', rowCount: rows.length,
      persistenceMode: 'indexeddb', fieldMap: { weight: 'Weight' }, appliedRevision: 5,
    }),
  });
  const stateRef = {
    current: {
      supportConfigJson: JSON.stringify({ weight: { fieldMap: { weight: 'Weight' } }, supportPositionMatch: { toleranceMm: 20 } }),
      masterContext: { config: { weight: { fieldMap: { weight: 'Weight' } }, supportPositionMatch: { toleranceMm: 20 } }, rawRows: {}, mappingRows: {}, datasetRefs: {}, rowCounts: {}, previewRows: {}, sourceMetadata: {}, appliedMappingRevision: {} },
    },
  };
  const store = {
    async getMetadata(id) { return id === 'weight-ds' ? { datasetId: id, rowCount: rows.length, fileName: 'weights.xlsx' } : null; },
    async getRows(id) { return id === 'weight-ds' ? rows.map((row) => ({ ...row })) : null; },
  };
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, { store }), true);
    const cfg = JSON.parse(stateRef.current.supportConfigJson);
    assert.equal('masterRows' in cfg.weight, false);
    assert.equal(cfg.weight.masterRevision, 5);
    assert.equal(cfg.weight.masterFingerprint, xmlCiiWeightMasterRowsFingerprint(rows));
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.masterFingerprint, cfg.weight.masterFingerprint);
    assert.equal(cfg.supportPositionMatch.toleranceMm, 20);
  } finally {
    storage.restore();
  }
});
