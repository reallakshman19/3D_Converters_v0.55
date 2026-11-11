import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertMetadataOnlyMasterConfig,
  compactMasterConfig,
  masterConfigDatasetFields,
} from '../tabs/xml-cii-2019-standalone/workers/master-dataset-config.js';

test('compact master config removes large dataset arrays without mutating source authority fields', () => {
  const rows = Array.from({ length: 100_000 }, (_, index) => ({ id: index, marker: `ROW-${index}` }));
  const source = {
    general: { units: 'metric' },
    linelist: { fieldMap: { lineKey1: 'Service' }, masterRows: rows, policy: 'governed' },
    pipingClass: { fieldMap: { class: 'Spec' }, masterRows: rows },
    material: { fieldMap: { code: 'Code' }, mapRows: rows },
    weight: { fieldMap: { weight: 'Mass' }, masterRows: rows },
  };

  const compact = compactMasterConfig(source);
  assert.deepEqual(masterConfigDatasetFields(compact), []);
  assert.equal(compact.linelist.fieldMap.lineKey1, 'Service');
  assert.equal(compact.linelist.policy, 'governed');
  assert.equal(compact.general.units, 'metric');
  assert.equal(source.linelist.masterRows, rows);
  assert.equal(source.material.mapRows, rows);
  assert.ok(JSON.stringify(compact).length < 10_000);
  assert.equal(assertMetadataOnlyMasterConfig(compact), compact);
});

test('metadata-only assertion fails closed when a master dataset array is present', () => {
  const config = { linelist: { masterRows: [{ id: 1 }] }, material: { mapRows: [] } };
  assert.deepEqual(masterConfigDatasetFields(config), ['linelist.masterRows', 'material.mapRows']);
  assert.throws(() => assertMetadataOnlyMasterConfig(config), /linelist\.masterRows, material\.mapRows/);
});
