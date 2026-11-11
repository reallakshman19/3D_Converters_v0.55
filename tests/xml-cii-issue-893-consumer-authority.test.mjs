import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { createMasterDatasetService } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-service.js';
import { createMasterDatasetImportCoordinator } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js';
import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js';
import { materializeXmlCiiDatasetBackedConfig } from '../tabs/xml-cii-2019-standalone/xml-cii-dataset-backed-config.js';
import { materializeRegexSmartMasterContext } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js';
import { assertWeightDatasetResultAuthority } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js';

function serviceWith(rowsById, metadataById) {
  return createMasterDatasetService({
    getXlsx: async () => { throw new Error('xlsx not required'); },
    store: {
      async persistDataset() {},
      async getMetadata(id) { return metadataById[id] || null; },
      async getRows(id) { return rowsById[id] || null; },
    },
    prepareDataset: (_masterKey, rows) => ({
      fieldMap: {},
      rows,
      searchCorpus: rows.map((row) => JSON.stringify(row).toLowerCase()),
    }),
    buildSearchCorpus: (rows) => rows.map((row) => JSON.stringify(row).toLowerCase()),
    searchCorpusIndexes: () => [],
  });
}

function coordinatorWith(resultsById) {
  const client = {
    async getRows(datasetId) {
      const result = resultsById[datasetId];
      if (!result) throw new Error('unknown test dataset ' + datasetId);
      return structuredClone(result);
    },
    async getRowsByIndexes(datasetId, indexes) {
      const result = resultsById[datasetId];
      if (!result) throw new Error('unknown test dataset ' + datasetId);
      return { ...structuredClone(result), indexes, rows: indexes.map((index) => result.rows[index]).filter(Boolean) };
    },
    dispose() {},
  };
  return createMasterDatasetImportCoordinator({ client });
}

test('C05.6.2 worker row results expose actual dataset authority', async () => {
  const id = 'issue893:pipingClass:r5';
  const service = serviceWith(
    { [id]: [{ Class: 'A1', Bore: 80 }] },
    { [id]: { datasetId: id, datasetRevision: 5, masterKey: 'pipingClass', rowCount: 1, masterFingerprint: '' } },
  );

  const result = await service.handle({
    type: MASTER_DATASET_COMMAND.GET_ROWS,
    requestId: 'rows-authority',
    datasetId: id,
    offset: 0,
    limit: 1,
  });

  assert.equal(result.type, MASTER_DATASET_EVENT.ROWS_RESULT);
  assert.equal(result.datasetId, id);
  assert.equal(result.masterKey, 'pipingClass');
  assert.equal(result.datasetRevision, 5);
  assert.equal(result.masterFingerprint, '');
});

test('C05.6.2 coordinator fails closed on cross-master dataset substitution', async () => {
  const materialId = 'issue893:materialMap:r3';
  const coordinator = coordinatorWith({
    [materialId]: {
      type: MASTER_DATASET_EVENT.ROWS_RESULT,
      datasetId: materialId,
      masterKey: 'materialMap',
      datasetRevision: 3,
      masterFingerprint: '',
      rowCount: 1,
      rows: [{ Material: 'CS' }],
    },
  });
  try {
    await assert.rejects(
      () => coordinator.materializeRows(
        'pipingClass',
        1,
        materialId,
        { datasetId: materialId, datasetRevision: 3, rowCount: 1, masterKey: 'materialMap' },
      ),
      /Dataset authority mismatch for pipingClass: dataset belongs to materialMap/,
    );
  } finally {
    coordinator.dispose();
  }
});

test('C05.6.2 coordinator fails closed on stale same-key revision', async () => {
  const id = 'issue893:pipingClass:r5';
  const coordinator = coordinatorWith({
    [id]: {
      type: MASTER_DATASET_EVENT.ROWS_RESULT,
      datasetId: id,
      masterKey: 'pipingClass',
      datasetRevision: 5,
      masterFingerprint: '',
      rowCount: 1,
      rows: [{ Class: 'A1' }],
    },
  });
  try {
    await assert.rejects(
      () => coordinator.materializeRows(
        'pipingClass',
        1,
        id,
        { datasetId: id, datasetRevision: 4, rowCount: 1, masterKey: 'pipingClass' },
      ),
      /Dataset revision mismatch for pipingClass: expected 4, received 5/,
    );
  } finally {
    coordinator.dispose();
  }
});

test('C05.6.2 coordinator fails closed on Weight fingerprint substitution', async () => {
  const id = 'issue893:weight:r2';
  const coordinator = coordinatorWith({
    [id]: {
      type: MASTER_DATASET_EVENT.ROWS_RESULT,
      datasetId: id,
      masterKey: 'weight',
      datasetRevision: 2,
      masterFingerprint: '2:fnv1a:actual',
      rowCount: 1,
      rows: [{ Bore: 100 }],
    },
  });
  try {
    await assert.rejects(
      () => coordinator.materializeRows(
        'weight',
        1,
        id,
        { datasetId: id, datasetRevision: 2, rowCount: 1, masterKey: 'weight', masterFingerprint: '2:fnv1a:stale' },
      ),
      /Dataset fingerprint mismatch for weight/,
    );
  } finally {
    coordinator.dispose();
  }
});

test('C05.6.2 generic downstream config binds each master key to its own restored ref and preserves applied revisions', async () => {
  const state = {
    masterContext: {
      config: {
        pipingClass: { fieldMap: { pipingClass: 'Class' } },
        material: { fieldMap: { material: 'Material' } },
        weight: { fieldMap: { weight: 'Weight' }, masterRevision: 13, masterFingerprint: 'fp-weight' },
      },
      pipingClassRows: [],
      materialMapRows: [],
      weightMasterRows: [],
      datasetRefs: {
        pipingClass: { datasetId: 'pc-r4', datasetRevision: 4, rowCount: 1, masterKey: 'pipingClass' },
        materialMap: { datasetId: 'mat-r6', datasetRevision: 6, rowCount: 1, masterKey: 'materialMap' },
        weight: { datasetId: 'wt-r9', datasetRevision: 9, rowCount: 1, masterKey: 'weight', masterFingerprint: 'fp-weight' },
      },
      appliedMappingRevision: { pipingClass: 8, materialMap: 11, weight: 13 },
    },
  };
  const beforeRevisions = structuredClone(state.masterContext.appliedMappingRevision);
  const seen = [];
  const config = await materializeXmlCiiDatasetBackedConfig({}, state, {
    async materializeRows(masterKey, ref) {
      seen.push([masterKey, ref.datasetId, ref.datasetRevision]);
      if (masterKey === 'pipingClass') return [{ Class: 'A1' }];
      if (masterKey === 'materialMap') return [{ Material: 'CS', Code: 'A106B' }];
      if (masterKey === 'weight') return [{ Weight: 9 }];
      throw new Error('unexpected key ' + masterKey);
    },
  });

  assert.deepEqual(seen, [
    ['pipingClass', 'pc-r4', 4],
    ['materialMap', 'mat-r6', 6],
    ['weight', 'wt-r9', 9],
  ]);
  assert.equal(config.pipingClass.masterRows[0].Class, 'A1');
  assert.equal(config.material.mapRows[0].Code, 'A106B');
  assert.equal(config.weight.masterRows[0].Weight, 9);
  assert.equal(config.weight.masterRevision, 13);
  assert.equal(config.weight.masterFingerprint, 'fp-weight');
  assert.deepEqual(state.masterContext.appliedMappingRevision, beforeRevisions);
});

test('C05.6.2 Piping Class regex bounded evidence uses the restored keyed ref, not full row materialization', async () => {
  const state = {
    regexTesterResult: { branchSamples: [
      { branchName: '/LINE12345-C1234M1' },
    ] },
    masterContext: {
      config: { pipingClass: { fieldMap: { pipingClass: 'Class' } } },
      lineRows: [],
      pipingClassRows: [],
      datasetRefs: {
        pipingClass: { datasetId: 'pc-cold-r7', datasetRevision: 7, rowCount: 2, masterKey: 'pipingClass' },
      },
      rowCounts: { pipingClass: 2 },
      appliedMappingRevision: { pipingClass: 12 },
    },
  };
  const searched = [];
  const retrieved = [];
  const hydrated = await materializeRegexSmartMasterContext(state, {
    async materializeRows() {
      throw new Error('UNBOUNDED_FULL_DATASET_MATERIALIZATION_IS_FORBIDDEN');
    },
    async search(masterKey, datasetId, query) {
      searched.push({ masterKey, datasetId, query });
      assert.equal(masterKey, 'pipingClass');
      assert.equal(datasetId, 'pc-cold-r7');
      return { indexes: [0, 1] };
    },
    async getRowsByIndexes(masterKey, datasetId, indexes, datasetRef) {
      retrieved.push({ masterKey, datasetId, indexes, datasetRef });
      return { rows: [{ Class: 'A1' }, { Class: 'B2' }] };
    },
    maxIndexesPerQuery: 4,
    maxTotalIndexes: 8,
  });

  assert.ok(searched.length > 0, 'original branch samples must cause a bounded source-indexed query');
  assert.equal(retrieved.length, 1);
  assert.equal(retrieved[0].masterKey, 'pipingClass');
  assert.equal(retrieved[0].datasetId, 'pc-cold-r7');
  assert.deepEqual(retrieved[0].indexes, [0, 1]);
  assert.equal(retrieved[0].datasetRef.datasetRevision, 7);
  assert.equal(hydrated.pipingClassRowCount, 2);
  assert.equal(hydrated.masterContext.pipingClassRows.length, 2);
  assert.equal(state.masterContext.pipingClassRows.length, 0,
    'bounded evidence is transient and must never retain full master rows');
  assert.match(hydrated.evidenceBasis, /pc-cold-r7/);
  assert.match(hydrated.evidenceBasis, /"mappingRevision":12/);
  assert.equal(hydrated.boundedEvidence?.mode, 'BOUNDED_MASTER_EVIDENCE');
});

test('C05.6.2 Weight Match result authority validates datasetId revision and fingerprint', () => {
  const ref = {
    datasetId: 'wt-cold-r5',
    datasetRevision: 5,
    masterFingerprint: '1595:fnv1a:test',
  };
  const result = {
    datasetId: 'wt-cold-r5',
    datasetRevision: 5,
    masterFingerprint: '1595:fnv1a:test',
    issues: [],
  };
  assert.equal(assertWeightDatasetResultAuthority(result, ref), result);
  assert.throws(
    () => assertWeightDatasetResultAuthority({ ...result, datasetId: 'mat-r5' }, ref),
    /Weight Match dataset authority mismatch/,
  );
  assert.throws(
    () => assertWeightDatasetResultAuthority({ ...result, datasetRevision: 4 }, ref),
    /Weight Match dataset revision mismatch/,
  );
  assert.throws(
    () => assertWeightDatasetResultAuthority({ ...result, masterFingerprint: 'stale' }, ref),
    /Weight Match dataset fingerprint mismatch/,
  );
});

test('C05.6.2 changed source/docs mirrors remain byte-identical and cache chain is coherent', async () => {
  const version = '20261007-c05-6-2-consumer-authority-1';
  const successorModeB = '20261008-p0-mode-b-parity-1';
  const mirrorPaths = [
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-import-coordinator.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-runtime.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-client.js',
    'tabs/xml-cii-2019-standalone/xml-cii-dataset-backed-config.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-evidence.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-regex-smart-ui.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-smart.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-phase-panels-mode-a.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js',
    'tabs/xml-cii-2019-standalone-tab.js',
    'tabs/xml-cii-2019-standalone/xml-cii-workflow-ui-adapter.js',
  ];
  for (const sourcePath of mirrorPaths) {
    const source = await fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8');
    const docs = await fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8');
    assert.equal(source, docs, sourcePath);
  }

  const cachePaths = mirrorPaths.filter((path) => !path.endsWith('master-dataset-service.js'));
  for (const sourcePath of cachePaths) {
    const source = await fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8');
    // The entrypoint was advanced by P0 Mode-B on 2026-10-08 after C05.6.2.
    // Demand the successor cache generation there, while retaining C05.6.2
    // import-chain custody in its remaining modules and byte-identical docs.
    const expectedGeneration = sourcePath === 'tabs/xml-cii-2019-standalone-tab.js'
      ? successorModeB : version;
    assert.ok(source.includes(expectedGeneration),
      sourcePath + ' missing current documented consumer-authority cache generation');
  }
});
