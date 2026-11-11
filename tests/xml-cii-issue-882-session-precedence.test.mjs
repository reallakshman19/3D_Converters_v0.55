import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { hydratePersistedMasterDatasets } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';

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

const SPECS = Object.freeze([
  Object.freeze({
    key: 'pipingClass',
    configKey: 'pipingClass',
    rowsKey: 'pipingClassRows',
    source: 'Piping_class_master.json',
  }),
  Object.freeze({
    key: 'materialMap',
    configKey: 'material',
    rowsKey: 'materialMapRows',
    source: 'PCF_MAT_MAP.TXT',
  }),
  Object.freeze({
    key: 'weight',
    configKey: 'weight',
    rowsKey: 'weightMasterRows',
    source: 'wtValveweights.json',
  }),
]);

function activeState(spec) {
  const activeRows = [
    { Marker: `ACTIVE-${spec.key}-1` },
    { Marker: `ACTIVE-${spec.key}-2` },
  ];
  const fieldMap = { marker: 'Marker' };
  const section = {
    fieldMap,
    ...(spec.key === 'weight'
      ? { masterRevision: 21, masterFingerprint: 'active-weight-fp' }
      : {}),
  };
  const config = { [spec.configKey]: section };
  const context = {
    config,
    rawRows: { [spec.key]: [{ Raw: `ACTIVE-RAW-${spec.key}` }] },
    mappingRows: { [spec.key]: [{ Marker: `ACTIVE-MAP-${spec.key}` }] },
    datasetRefs: {
      [spec.key]: {
        datasetId: `session:${spec.key}:r9`,
        datasetRevision: 9,
        rowCount: activeRows.length,
        masterKey: spec.key,
        fileName: spec.source,
        fieldMap,
        ...(spec.key === 'weight' ? { masterFingerprint: 'active-weight-fp' } : {}),
        persistence: 'session',
      },
    },
    rowCounts: { [spec.key]: activeRows.length },
    previewRows: { [spec.key]: activeRows.map((row) => ({ ...row })) },
    sourceMetadata: {
      [spec.key]: {
        key: spec.key,
        source: `active-session-${spec.source}`,
        sourceType: 'worker-import',
        status: 'loaded',
        rowCount: activeRows.length,
      },
    },
    appliedMappingRevision: { [spec.key]: 21 },
    [spec.rowsKey]: activeRows.map((row) => ({ ...row })),
  };
  return {
    current: {
      supportConfigJson: JSON.stringify(config),
      masterContext: context,
      importMastersWriteBackStatus: 'Active session master loaded.',
    },
  };
}

function snapshotActive(stateRef, spec) {
  const context = stateRef.current.masterContext;
  const supportConfig = JSON.parse(stateRef.current.supportConfigJson || '{}');
  return {
    datasetRef: structuredClone(context.datasetRefs[spec.key]),
    rows: structuredClone(context[spec.rowsKey]),
    rawRows: structuredClone(context.rawRows[spec.key]),
    mappingRows: structuredClone(context.mappingRows[spec.key]),
    rowCount: context.rowCounts[spec.key],
    previewRows: structuredClone(context.previewRows[spec.key]),
    sourceMetadata: structuredClone(context.sourceMetadata[spec.key]),
    appliedRevision: context.appliedMappingRevision[spec.key],
    contextConfig: structuredClone(context.config[spec.configKey]),
    supportConfig: structuredClone(supportConfig[spec.configKey]),
  };
}

function staleCustody(spec) {
  return {
    source: `stale-${spec.source}`,
    datasetId: `persisted:${spec.key}:r2`,
    datasetRevision: 2,
    rowCount: 2,
    fieldMap: { marker: 'Marker' },
    appliedRevision: 2,
    persistenceMode: 'indexeddb',
    ...(spec.key === 'weight' ? { masterFingerprint: 'stale-weight-fp' } : {}),
  };
}

function siblingCustody() {
  return {
    source: 'sibling-lines.xlsx',
    datasetId: 'persisted:lineList:r1',
    rowCount: 2,
    fieldMap: { lineNo: 'Line' },
    appliedRevision: 4,
    persistenceMode: 'indexeddb',
  };
}

function storeFor(spec, { corruptSameKey = false } = {}) {
  const siblingRows = [{ Line: 'L-1' }, { Line: 'L-2' }];
  const staleRows = [{ Marker: `STALE-${spec.key}-1` }, { Marker: `STALE-${spec.key}-2` }];
  return {
    async getMetadata(id) {
      if (id === 'persisted:lineList:r1') {
        return {
          datasetId: id,
          rowCount: siblingRows.length,
          fileName: 'sibling-lines.xlsx',
          mappingRows: siblingRows,
        };
      }
      if (id === `persisted:${spec.key}:r2`) {
        if (corruptSameKey) return null;
        return {
          datasetId: id,
          datasetRevision: 2,
          rowCount: staleRows.length,
          fileName: `stale-${spec.source}`,
          mappingRows: staleRows,
          ...(spec.key === 'weight' ? { masterFingerprint: 'stale-weight-fp' } : {}),
        };
      }
      return null;
    },
    async getRowsRange(id, offset, limit) {
      if (id === 'persisted:lineList:r1') return siblingRows.slice(offset, offset + limit);
      if (id === `persisted:${spec.key}:r2`) return staleRows.slice(offset, offset + limit);
      return null;
    },
    async getRows(id) {
      if (id === 'persisted:lineList:r1') return siblingRows;
      if (id === `persisted:${spec.key}:r2`) return staleRows;
      return null;
    },
  };
}

for (const spec of SPECS) {
  test(`C05.5.4.3 ${spec.key} session authority outranks a valid stale same-key persisted restore`, async (t) => {
    const storage = installStorage({
      'xml-cii-master-source-lineList': JSON.stringify(siblingCustody()),
      [`xml-cii-master-source-${spec.key}`]: JSON.stringify(staleCustody(spec)),
    });
    const stateRef = activeState(spec);
    const before = snapshotActive(stateRef, spec);

    try {
      assert.equal(await hydratePersistedMasterDatasets(stateRef, { store: storeFor(spec) }), true);
      const after = snapshotActive(stateRef, spec);

      assert.deepEqual(after, before);
      assert.equal(after.datasetRef.persistence, 'session');
      assert.equal(after.datasetRef.datasetId, `session:${spec.key}:r9`);
      assert.equal(after.datasetRef.datasetRevision, 9);

      const sibling = stateRef.current.masterContext.datasetRefs.lineList;
      assert.equal(sibling.datasetId, 'persisted:lineList:r1');
      assert.equal(sibling.persistence, 'indexeddb');
      assert.equal(stateRef.current.masterContext.rowCounts.lineList, 2);

      assert.equal(stateRef.current.masterRestoreFailures?.[spec.key], undefined);
      assert.equal(storage.values.has(`xml-cii-master-${spec.key}`), false);
      assert.equal(storage.values.has(`xml-cii-master-raw-${spec.key}`), false);

      t.diagnostic(JSON.stringify({
        master: spec.key,
        sessionPreserved: true,
        stalePersistedApplied: false,
        siblingRestored: true,
        sessionPersistencePreserved: true,
      }));
    } finally {
      storage.restore();
    }
  });

  test(`C05.5.4.3 ${spec.key} session authority survives corrupt same-key restore and retains failure receipt`, async () => {
    const storage = installStorage({
      'xml-cii-master-source-lineList': JSON.stringify(siblingCustody()),
      [`xml-cii-master-source-${spec.key}`]: JSON.stringify(staleCustody(spec)),
    });
    const stateRef = activeState(spec);
    const before = snapshotActive(stateRef, spec);

    try {
      assert.equal(await hydratePersistedMasterDatasets(stateRef, {
        store: storeFor(spec, { corruptSameKey: true }),
      }), true);

      assert.deepEqual(snapshotActive(stateRef, spec), before);
      assert.equal(stateRef.current.masterContext.datasetRefs.lineList.datasetId, 'persisted:lineList:r1');
      assert.deepEqual(stateRef.current.masterRestoreFailures[spec.key], {
        masterKey: spec.key,
        datasetId: `persisted:${spec.key}:r2`,
        stage: 'startup-hydration',
        name: 'Error',
        message: `Persisted ${spec.key} dataset is unavailable.`,
      });
    } finally {
      storage.restore();
    }
  });
}

test('C05.5.4.3 durable current authority remains eligible for ordinary cold replacement', async () => {
  const storage = installStorage({
    'xml-cii-master-source-materialMap': JSON.stringify({
      source: 'PCF_MAT_MAP.TXT',
      datasetId: 'persisted:materialMap:r3',
      datasetRevision: 3,
      rowCount: 1,
      fieldMap: {},
      appliedRevision: 3,
      persistenceMode: 'indexeddb',
    }),
  });
  const stateRef = {
    current: {
      supportConfigJson: '{}',
      masterContext: {
        config: {},
        rawRows: {},
        mappingRows: {},
        datasetRefs: {
          materialMap: {
            datasetId: 'older-durable',
            rowCount: 1,
            masterKey: 'materialMap',
            persistence: 'indexeddb',
          },
        },
        rowCounts: { materialMap: 1 },
        previewRows: {},
        sourceMetadata: {},
        appliedMappingRevision: { materialMap: 1 },
      },
    },
  };
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return {
            datasetId: 'persisted:materialMap:r3',
            datasetRevision: 3,
            rowCount: 1,
            fileName: 'PCF_MAT_MAP.TXT',
            mappingRows: [{ Marker: 'MAT' }],
          };
        },
        async getRowsRange() { return [{ Marker: 'MAT' }]; },
        async getRows() { return [{ Marker: 'MAT' }]; },
      },
    }), true);
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.datasetId, 'persisted:materialMap:r3');
    assert.equal(stateRef.current.masterContext.datasetRefs.materialMap.persistence, 'indexeddb');
  } finally {
    storage.restore();
  }
});

test('C05.5.4.3 startup hydration source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/workers/master-dataset-startup-hydration.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
