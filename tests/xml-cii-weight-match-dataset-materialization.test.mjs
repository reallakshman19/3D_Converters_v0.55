import test from 'node:test';
import assert from 'node:assert/strict';

import { weightMatchConfigFromState } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js';

const workerRows = [
  { convertedBore: 80, rating: 300, type: 'FLAN', lengthMm: 80, weight: 9 },
  { convertedBore: 100, rating: 600, type: 'VALV', lengthMm: 120, weight: 14 },
];

test('Weight Match materializes dataset rows when resident compatibility rows are absent', async () => {
  const calls = [];
  const state = {
    supportConfigJson: JSON.stringify({
      weight: { masterRevision: 5, masterFingerprint: '2:fnv1a:test' },
      supportPositionMatch: { toleranceMm: 20 },
    }),
    masterContext: {
      weightMasterRows: [],
      datasetRefs: {
        weight: { datasetId: 'weight-ds', rowCount: workerRows.length, masterFingerprint: '2:fnv1a:test' },
      },
      appliedMappingRevision: { weight: 5 },
    },
  };

  const config = await weightMatchConfigFromState(state, {
    materializeRows: async (masterKey, datasetRef) => {
      calls.push([masterKey, datasetRef.datasetId, datasetRef.rowCount]);
      return workerRows.map((row) => ({ ...row }));
    },
  });

  assert.deepEqual(calls, [['weight', 'weight-ds', 2]]);
  assert.deepEqual(config.weight.masterRows, workerRows);
  assert.equal(config.weight.masterRevision, 5);
  assert.equal(config.weight.masterFingerprint, '2:fnv1a:test');
  assert.deepEqual(state.masterContext.weightMasterRows, [], 'transient materialization must not repopulate long-lived state');
  assert.equal('masterRows' in JSON.parse(state.supportConfigJson).weight, false);
});

test('Weight Match preserves legacy resident-row path without worker materialization', async () => {
  let called = false;
  const resident = [{ convertedBore: 50, rating: 150, weight: 4 }];
  const state = {
    supportConfigJson: '{}',
    masterContext: { weightMasterRows: resident, datasetRefs: {}, appliedMappingRevision: { weight: 3 } },
  };
  const config = await weightMatchConfigFromState(state, {
    materializeRows: async () => { called = true; return []; },
  });
  assert.equal(called, false);
  assert.deepEqual(config.weight.masterRows, resident);
  assert.equal(config.weight.masterRevision, 3);
});
