import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { compactDatasetBackedConfig } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';

test('dataset-backed config compaction removes only worker-owned row payloads', () => {
  const lineRows = [{ lineNo: 'L-1' }];
  const classRows = [{ class: 'A1' }];
  const materialRows = [{ material: 'CS' }];
  const weightRows = [{ weight: 9 }];
  const config = {
    linelist: { fieldMap: { lineNo: 'Line' }, masterRows: lineRows },
    pipingClass: { fieldMap: { pipingClass: 'Class' }, masterRows: classRows },
    material: { fieldMap: { material: 'Material' }, mapRows: materialRows },
    weight: { fieldMap: { weight: 'Weight' }, masterRows: weightRows, masterRevision: 1, masterFingerprint: 'old' },
    supportPositionMatch: { toleranceMm: 20 },
  };
  const context = {
    datasetRefs: {
      lineList: { datasetId: 'line-ds', fieldMap: { lineNo: 'Line' } },
      weight: { datasetId: 'weight-ds', fieldMap: { weight: 'Weight' }, masterFingerprint: '2:fnv1a:abc' },
    },
    appliedMappingRevision: { lineList: 3, weight: 7 },
  };

  const compact = compactDatasetBackedConfig(config, context);
  assert.equal('masterRows' in compact.linelist, false);
  assert.equal('masterRows' in compact.weight, false);
  assert.deepEqual(compact.pipingClass.masterRows, classRows, 'legacy non-worker rows remain compatible');
  assert.deepEqual(compact.material.mapRows, materialRows, 'unmigrated material rows remain compatible');
  assert.equal(compact.weight.masterRevision, 7);
  assert.equal(compact.weight.masterFingerprint, '2:fnv1a:abc');
  assert.equal(compact.supportPositionMatch.toleranceMm, 20);
  assert.equal(config.linelist.masterRows, lineRows, 'helper must not mutate calculation config');
  assert.equal(config.weight.masterRows, weightRows, 'helper must not strip transient calculation rows');
});

test('Weight Match persistence compacts enriched config before supportConfigJson write', async () => {
  const source = await fs.readFile(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', import.meta.url), 'utf8');
  assert.ok(source.includes("compactDatasetBackedConfig(config, stateRef.current.masterContext || {})"));
  assert.ok(source.includes("supportConfigJson: JSON.stringify(compactConfig, null, 2)"));
  assert.equal(source.includes("supportConfigJson: JSON.stringify(config, null, 2)"), false);
});
