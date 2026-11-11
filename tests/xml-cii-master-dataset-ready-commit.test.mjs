import test from 'node:test';
import assert from 'node:assert/strict';

import { commitDatasetReadyMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-commit.js';

const preview = Array.from({ length: 150 }, (_, index) => ({ convertedBore: index + 1, weight: index + 2 }));
const mapping = Array.from({ length: 150 }, (_, index) => ({ Bore: index + 1, Weight: index + 2 }));

test('DATASET_READY commit keeps full Weight rows off main-thread state while preserving metadata authority', () => {
  const result = commitDatasetReadyMaster({
    context: {
      config: { weight: { fieldMap: { weight: 'OldWeight' } } },
      weightMasterRows: [{ stale: true }],
      rawRows: { weight: [{ stale: true }] },
      mappingRows: {}, previewRows: {}, rowCounts: {}, datasetRefs: {},
      appliedMappingRevision: { weight: 4 },
    },
    config: { weight: { fieldMap: { weight: 'OldWeight' } }, supportPositionMatch: { toleranceMm: 20 } },
    key: 'weight',
    ready: {
      metadata: {
        datasetId: 'weight-ds-r5', masterKey: 'weight', rowCount: 100000,
        fileName: 'weights.xlsx', sheetName: 'Weights', fieldMap: { weight: 'Weight' },
        masterFingerprint: '100000:fnv1a:test',
      },
      previewRows: preview,
      mappingRows: mapping,
    },
    sourceMetadata: { key: 'weight', source: 'weights.xlsx', sourceType: 'worker-import', status: 'loaded', rowCount: 100000 },
  });

  assert.deepEqual(result.context.weightMasterRows, []);
  assert.deepEqual(result.context.rawRows.weight, []);
  assert.equal(result.context.mappingRows.weight.length, 150);
  assert.equal(result.context.previewRows.weight.length, 150);
  assert.equal(result.context.rowCounts.weight, 100000);
  assert.equal(result.context.datasetRefs.weight.datasetId, 'weight-ds-r5');
  assert.equal(result.context.datasetRefs.weight.masterFingerprint, '100000:fnv1a:test');
  assert.equal(result.context.appliedMappingRevision.weight, 5);
  assert.equal('masterRows' in result.config.weight, false);
  assert.equal(result.config.weight.masterRevision, 5);
  assert.equal(result.config.weight.masterFingerprint, '100000:fnv1a:test');
  assert.equal(result.config.supportPositionMatch.toleranceMm, 20);
});

test('piping-class DATASET_READY commit clears a stale resident index', () => {
  const result = commitDatasetReadyMaster({
    context: { config: {}, pipingClassIndex: new Map([['STALE', []]]), appliedMappingRevision: { pipingClass: 1 } },
    config: {}, key: 'pipingClass',
    ready: {
      metadata: { datasetId: 'class-ds-r2', masterKey: 'pipingClass', rowCount: 50000, fieldMap: { pipingClass: 'Class' } },
      previewRows: [{ pipingClass: 'A1' }], mappingRows: [{ Class: 'A1' }],
    },
  });
  assert.equal(result.context.pipingClassIndex, null);
  assert.deepEqual(result.context.pipingClassRows, []);
  assert.equal(result.context.rowCounts.pipingClass, 50000);
});
