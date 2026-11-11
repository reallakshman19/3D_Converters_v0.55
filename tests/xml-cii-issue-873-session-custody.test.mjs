import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { commitDatasetReadyMaster } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-dataset-commit.js';

function installStorage(options = {}) {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (options.failWrites) {
        throw Object.assign(new Error('localStorage quota exceeded'), { name: 'QuotaExceededError' });
      }
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
  };
  return { values, restore: () => { globalThis.localStorage = previous; } };
}

function blankContext() {
  return { config: {}, rawRows: {}, mappingRows: {}, datasetRefs: {}, appliedMappingRevision: {} };
}

const CASES = [
  { key: 'pipingClass', fileName: 'Piping_class_master.json', fingerprint: '' },
  { key: 'materialMap', fileName: 'PCF_MAT_MAP.json', fingerprint: '' },
  { key: 'weight', fileName: 'wtValveweights.json', fingerprint: 'fp-session-weight' },
];

for (const spec of CASES) {
  test(`C05.5.3 ${spec.key} session dataset stays runtime-usable without false durable restart custody`, () => {
    const storage = installStorage();
    try {
      const ready = {
        metadata: {
          datasetId: `session:${spec.key}:r2`,
          datasetRevision: 2,
          rowCount: 2,
          masterKey: spec.key,
          fileName: spec.fileName,
          fieldMap: { marker: 'Marker' },
          persistenceMode: 'session',
          ...(spec.fingerprint ? { masterFingerprint: spec.fingerprint } : {}),
        },
        previewRows: [{ Marker: 'A' }, { Marker: 'B' }],
        mappingRows: [{ Marker: 'A' }, { Marker: 'B' }],
        persistence: {
          persisted: false,
          failure: { name: 'QuotaExceededError', message: 'IndexedDB quota exceeded' },
          quotaLimited: true,
        },
      };
      const committed = commitDatasetReadyMaster({
        context: blankContext(),
        config: {},
        key: spec.key,
        ready,
        sourceMetadata: {
          key: spec.key,
          source: spec.fileName,
          sourceType: 'worker-import',
          status: 'loaded',
          rowCount: 2,
        },
      });

      const ref = committed.context.datasetRefs[spec.key];
      assert.equal(ref.datasetId, `session:${spec.key}:r2`);
      assert.equal(ref.datasetRevision, 2);
      assert.equal(ref.persistence, 'session');
      if (spec.fingerprint) assert.equal(ref.masterFingerprint, spec.fingerprint);

      const custody = JSON.parse(storage.values.get(`xml-cii-master-source-${spec.key}`) || '{}');
      assert.equal(custody.persistenceMode, 'session');
      assert.equal(custody.datasetId, undefined);
      assert.equal(custody.datasetRevision, 2);
      if (spec.fingerprint) assert.equal(custody.masterFingerprint, spec.fingerprint);

      assert.equal(storage.values.has(`xml-cii-master-${spec.key}`), false);
      assert.equal(storage.values.has(`xml-cii-master-raw-${spec.key}`), false);
      assert.equal(storage.values.has(`xml-cii-master-workbook-${spec.key}`), false);

      assert.equal(committed.persistence.indexedDbBacked, false);
      assert.equal(committed.persistence.sessionOnly, true);
      assert.equal(committed.persistence.normalizedPersisted, false);
    } finally {
      storage.restore();
    }
  });
}

test('C05.5.3 durable dataset still writes IndexedDB restart custody', () => {
  const storage = installStorage();
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'pipingClass',
      ready: {
        metadata: {
          datasetId: 'durable:pc:r3',
          datasetRevision: 3,
          rowCount: 1,
          masterKey: 'pipingClass',
          fileName: 'Piping_class_master.json',
          fieldMap: {},
          persistenceMode: 'indexeddb',
        },
        previewRows: [{ Marker: 'PC' }],
        mappingRows: [{ Marker: 'PC' }],
      },
      sourceMetadata: { key: 'pipingClass', source: 'Piping_class_master.json', status: 'loaded', rowCount: 1 },
    });
    assert.equal(committed.context.datasetRefs.pipingClass.persistence, 'indexeddb');
    const custody = JSON.parse(storage.values.get('xml-cii-master-source-pipingClass') || '{}');
    assert.equal(custody.persistenceMode, 'indexeddb');
    assert.equal(custody.datasetId, 'durable:pc:r3');
    assert.equal(custody.datasetRevision, 3);
    assert.equal(committed.persistence.indexedDbBacked, true);
    assert.equal(committed.persistence.sessionOnly, false);
  } finally {
    storage.restore();
  }
});

test('C05.5.3 localStorage persistence errors remain explicit for session-only dataset', () => {
  const storage = installStorage({ failWrites: true });
  try {
    const committed = commitDatasetReadyMaster({
      context: blankContext(),
      config: {},
      key: 'materialMap',
      ready: {
        metadata: {
          datasetId: 'session:mat:r1',
          datasetRevision: 1,
          rowCount: 1,
          masterKey: 'materialMap',
          fileName: 'PCF_MAT_MAP.json',
          fieldMap: {},
          persistenceMode: 'session',
        },
        previewRows: [{ Marker: 'MAT' }],
        mappingRows: [{ Marker: 'MAT' }],
      },
      sourceMetadata: { key: 'materialMap', source: 'PCF_MAT_MAP.json', status: 'loaded', rowCount: 1 },
    });

    assert.equal(committed.context.datasetRefs.materialMap.persistence, 'session');
    assert.equal(committed.persistence.quotaLimited, true);
    assert.ok(committed.persistence.failures.length > 0);
    assert.ok(committed.persistence.failures.some((failure) => failure.name === 'QuotaExceededError'));
  } finally {
    storage.restore();
  }
});

test('C05.5.3 master runtime source and docs mirror are byte-identical', async () => {
  const sourcePath = 'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';
  const [source, docs] = await Promise.all([
    fs.readFile(new URL('../' + sourcePath, import.meta.url), 'utf8'),
    fs.readFile(new URL('../docs/' + sourcePath, import.meta.url), 'utf8'),
  ]);
  assert.equal(source, docs);
});
