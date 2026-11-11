import test from 'node:test';
import assert from 'node:assert/strict';

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

function activeState() {
  const activeContext = {
    config: {
      weight: {
        masterRevision: 11,
        masterFingerprint: 'active-weight-fp',
      },
    },
    datasetRefs: {
      weight: {
        datasetId: 'active:wt:r5',
        datasetRevision: 5,
        rowCount: 2,
        masterKey: 'weight',
        masterFingerprint: 'active-weight-fp',
        persistence: 'session',
      },
    },
    rowCounts: { weight: 2 },
    previewRows: { weight: [{ Marker: 'WT-1' }] },
    sourceMetadata: { weight: { source: 'active-session', status: 'loaded', rowCount: 2 } },
    appliedMappingRevision: { weight: 11 },
    rawRows: { weight: [] },
    mappingRows: { weight: [] },
  };
  return {
    current: {
      supportConfigJson: JSON.stringify(activeContext.config),
      masterContext: activeContext,
    },
  };
}

function custody(masterKey, overrides = {}) {
  const defaults = {
    source: masterKey === 'pipingClass' ? 'Piping_class_master.json' : 'PCF_MAT_MAP.TXT',
    datasetId: `issue880:${masterKey}:r3`,
    datasetRevision: 3,
    rowCount: 2,
    fieldMap: {},
    appliedRevision: 3,
    persistenceMode: 'indexeddb',
  };
  return JSON.stringify({ ...defaults, ...overrides });
}

async function expectRestoreFailure({ name, custodyEntries, store, pattern, code, stage }) {
  const storage = installStorage(custodyEntries);
  const stateRef = activeState();
  const before = JSON.parse(JSON.stringify(stateRef.current));
  const keys = Object.keys(custodyEntries);
  assert.equal(keys.length, 1, 'failure isolation fixture must target exactly one master');
  const masterKey = keys[0].replace(/^xml-cii-master-source-/, '');
  const datasetId = JSON.parse(custodyEntries[keys[0]]).datasetId;
  try {
    // C05.5.4.2–4.4 replaced global throw-on-one-bad-master with fail-closed
    // typed per-master receipts, allowing other independently valid masters.
    assert.equal(await hydratePersistedMasterDatasets(stateRef, { store }), true);
    const identity = stateRef.current.masterRestoreFailureIdentity?.[masterKey];
    assert.deepEqual(identity, {
      masterKey, datasetId, domain: 'restore-storage', code, stage,
    }, name + ': wrong storage-failure identity');
    const receipt = stateRef.current.masterRestoreFailures?.[masterKey];
    assert.equal(receipt?.masterKey, masterKey);
    assert.equal(receipt?.datasetId, datasetId);
    assert.equal(receipt?.stage, 'startup-hydration');
    assert.equal(receipt?.name, 'Error');
    assert.match(receipt.message, pattern);
    assert.equal(stateRef.current.masterContext.datasetRefs[masterKey], undefined,
      name + ': rejected persisted master cannot become active');
    assert.deepEqual(stateRef.current.masterContext, before.masterContext,
      name + ': unrelated active session Weight/config mutated by corrupt restore');
    assert.equal(stateRef.current.supportConfigJson, before.supportConfigJson);
    return {
      case: name, quarantined: true, code, stage,
      activeSessionPreserved: true, failedPersistedAuthorityAttached: false,
      message: receipt.message, failureDomain: 'RESTORE_STORAGE',
      parseFailure: false,
    };
  } finally {
    storage.restore();
  }
}

test('C05.5.4.1 successor matrix quarantines corrupt masters with typed identities', async (t) => {
  const rows = [{ Marker: 'A' }, { Marker: 'B' }];

  const results = [];

  results.push(await expectRestoreFailure({
    name: 'MISSING_METADATA',
    code: 'MISSING_DATASET',
    stage: 'metadata-validate',
    custodyEntries: {
      'xml-cii-master-source-materialMap': custody('materialMap'),
    },
    store: {
      async getMetadata() { return null; },
      async getRowsRange() { throw new Error('rows must not be read after missing metadata'); },
      async getRows() { throw new Error('rows must not be read after missing metadata'); },
    },
    pattern: /Persisted materialMap dataset is unavailable/,
  }));

  results.push(await expectRestoreFailure({
    name: 'ROW_COUNT_MISMATCH',
    code: 'ROW_COUNT_MISMATCH',
    stage: 'metadata-validate',
    custodyEntries: {
      'xml-cii-master-source-materialMap': custody('materialMap', { rowCount: 2 }),
    },
    store: {
      async getMetadata() {
        return {
          datasetId: 'issue880:materialMap:r3',
          datasetRevision: 3,
          rowCount: 3,
          fileName: 'PCF_MAT_MAP.TXT',
        };
      },
      async getRowsRange() { throw new Error('rows must not be read after row-count mismatch'); },
      async getRows() { throw new Error('rows must not be read after row-count mismatch'); },
    },
    pattern: /row count mismatch: expected 2, received 3/,
  }));

  results.push(await expectRestoreFailure({
    name: 'REVISION_MISMATCH',
    code: 'REVISION_MISMATCH',
    stage: 'metadata-validate',
    custodyEntries: {
      'xml-cii-master-source-materialMap': custody('materialMap', { datasetRevision: 3 }),
    },
    store: {
      async getMetadata() {
        return {
          datasetId: 'issue880:materialMap:r3',
          datasetRevision: 4,
          rowCount: 2,
          fileName: 'PCF_MAT_MAP.TXT',
        };
      },
      async getRowsRange() { throw new Error('rows must not be read after revision mismatch'); },
      async getRows() { throw new Error('rows must not be read after revision mismatch'); },
    },
    pattern: /dataset revision mismatch: expected 3, received 4/,
  }));

  results.push(await expectRestoreFailure({
    name: 'PREVIEW_UNAVAILABLE',
    code: 'PREVIEW_ROWS_UNAVAILABLE',
    stage: 'preview-read',
    custodyEntries: {
      'xml-cii-master-source-materialMap': custody('materialMap'),
    },
    store: {
      async getMetadata() {
        return {
          datasetId: 'issue880:materialMap:r3',
          datasetRevision: 3,
          rowCount: 2,
          fileName: 'PCF_MAT_MAP.TXT',
          mappingRows: rows,
        };
      },
      async getRowsRange() { return null; },
      async getRows() { return rows; },
    },
    pattern: /Persisted materialMap preview is unavailable/,
  }));

  t.diagnostic(JSON.stringify(results));
  assert.equal(results.length, 4);
  assert.ok(results.every((entry) => entry.quarantined));
  assert.ok(results.every((entry) => entry.activeSessionPreserved));
  assert.ok(results.every((entry) => entry.failureDomain === 'RESTORE_STORAGE'));
  assert.ok(results.every((entry) => entry.parseFailure === false));
});

test('C05.5.4.1 valid Piping sibling restores while corrupt Mat Map is isolated', async (t) => {
  const storage = installStorage({
    'xml-cii-master-source-pipingClass': custody('pipingClass', {
      datasetId: 'issue880:pipingClass:r4',
      datasetRevision: 4,
      appliedRevision: 2,
      source: 'Piping_class_master.json',
    }),
    'xml-cii-master-source-materialMap': custody('materialMap', {
      datasetId: 'issue880:materialMap:r3',
      datasetRevision: 3,
      appliedRevision: 3,
    }),
  });
  const stateRef = activeState();
  const activeWeight = structuredClone(stateRef.current.masterContext.datasetRefs.weight);
  const pipingRows = [{ Marker: 'PC-1' }, { Marker: 'PC-2' }];
  let badMapReadAttempts = 0;
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata(id) {
          if (id === 'issue880:pipingClass:r4') return {
            datasetId: id, datasetRevision: 4, rowCount: 2,
            fileName: 'Piping_class_master.json', mappingRows: pipingRows,
          };
          if (id === 'issue880:materialMap:r3') return null;
          throw Error('unexpected dataset id ' + id);
        },
        async getRowsRange(id, offset, limit) {
          if (id === 'issue880:pipingClass:r4')
            return pipingRows.slice(offset, offset + limit);
          badMapReadAttempts++;
          throw Error('corrupt Mat Map rows must never be read');
        },
        async getRows(id) {
          if (id === 'issue880:pipingClass:r4') return pipingRows;
          badMapReadAttempts++;
          throw Error('corrupt Mat Map rows must never be read');
        },
      },
    }), true);
    const context = stateRef.current.masterContext;
    assert.equal(badMapReadAttempts, 0);
    assert.equal(context.datasetRefs.pipingClass.datasetId, 'issue880:pipingClass:r4');
    assert.equal(context.datasetRefs.pipingClass.datasetRevision, 4);
    assert.equal(context.datasetRefs.pipingClass.persistence, 'indexeddb');
    assert.equal(context.appliedMappingRevision.pipingClass, 2);
    assert.deepEqual(context.previewRows.pipingClass, pipingRows);
    assert.deepEqual(context.pipingClassRows || [], [],
      'valid sibling full rows must remain out of retained context');
    assert.equal(context.datasetRefs.materialMap, undefined);
    assert.equal(context.appliedMappingRevision.materialMap, undefined);
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity.materialMap, {
      masterKey: 'materialMap', datasetId: 'issue880:materialMap:r3',
      domain: 'restore-storage', code: 'MISSING_DATASET', stage: 'metadata-validate',
    });
    assert.match(stateRef.current.masterRestoreFailures.materialMap.message,
      /Persisted materialMap dataset is unavailable/);
    assert.equal(stateRef.current.masterRestoreFailureIdentity.pipingClass, undefined);
    assert.deepEqual(context.datasetRefs.weight, activeWeight,
      'corrupt sibling must never replace unrelated session Weight');
    t.diagnostic(JSON.stringify({
      validSiblingRestored: true, corruptSiblingQuarantined: true,
      activeWeightPreserved: true, badMapReadAttempts,
    }));
  } finally {
    storage.restore();
  }
});

test('C05.5.4.1 legacy Weight fingerprint migration failure retains active session authority', async (t) => {
  const storage = installStorage({
    'xml-cii-master-source-weight': JSON.stringify({
      source: 'wtValveweights.json', datasetId: 'issue880:weight:r5',
      datasetRevision: 5, rowCount: 2, fieldMap: {},
      appliedRevision: 11, persistenceMode: 'indexeddb', masterFingerprint: '',
    }),
  });
  const stateRef = activeState();
  const before = structuredClone(stateRef.current.masterContext);
  let readCount = 0;
  try {
    assert.equal(await hydratePersistedMasterDatasets(stateRef, {
      store: {
        async getMetadata() {
          return { datasetId: 'issue880:weight:r5', datasetRevision: 5,
            rowCount: 2, fileName: 'wtValveweights.json', masterFingerprint: '' };
        },
        async getRowsRange() { return [{ Marker: 'WT-1' }]; },
        async getRows() { readCount++; return [{ Marker: 'WT-1' }]; },
      },
    }), true);
    assert.equal(readCount, 1, 'legacy fingerprint migration should attempt bounded proof of full rows once');
    assert.deepEqual(stateRef.current.masterContext, before,
      'session Weight identity and applied revision must not be overwritten');
    assert.deepEqual(stateRef.current.masterRestoreFailureIdentity.weight, {
      masterKey: 'weight', datasetId: 'issue880:weight:r5',
      domain: 'restore-storage', code: 'FINGERPRINT_MIGRATION_FAILED',
      stage: 'fingerprint-migration',
    });
    assert.match(stateRef.current.masterRestoreFailures.weight.message,
      /fingerprint migration requires 2 rows/);
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.persistence, 'session');
    assert.equal(stateRef.current.masterContext.datasetRefs.weight.masterFingerprint, 'active-weight-fp');
    t.diagnostic(JSON.stringify({
      activeSessionPreserved: true, code: 'FINGERPRINT_MIGRATION_FAILED',
      failureDomain: 'RESTORE_STORAGE', parseFailure: false, readCount,
    }));
  } finally {
    storage.restore();
  }
});
