import assert from 'node:assert/strict';
import test from 'node:test';

import {
  commitAppliedMaster,
  persistChangedMasterDetailed,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js';

class QuotaStorage {
  constructor(maxValueBytes) {
    this.maxValueBytes = maxValueBytes;
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    const text = String(value);
    if (Buffer.byteLength(text, 'utf8') > this.maxValueBytes) {
      const error = new Error('Failed to execute setItem: storage quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    }
    this.map.set(key, text);
  }

  removeItem(key) {
    this.map.delete(key);
  }
}

function largeRows(count) {
  const padding = 'P'.repeat(96);
  return Array.from({ length: count }, (_, index) => ({
    PIPING_CLASS: `P${index % 100}`,
    NPS: String((index % 24) + 1),
    MATERIAL: index % 2 ? 'DSS' : 'LTCS',
    DESCRIPTION: `${padding}-${index}`,
  }));
}

test('11k-row master remains authoritative in session when persistence hits quota', () => {
  const previousStorage = globalThis.localStorage;
  const storage = new QuotaStorage(64 * 1024);
  globalThis.localStorage = storage;
  try {
    const rawRows = largeRows(11_000);
    storage.map.set('xml-cii-master-raw-pipingClass', JSON.stringify([{ stale: true }]));
    storage.map.set('xml-cii-master-workbook-pipingClass', JSON.stringify({ Old: [{ stale: true }] }));
    const applied = commitAppliedMaster({
      context: {
        rawRows: {},
        workbookData: { pipingClass: { Data: rawRows } },
        sheetNames: { pipingClass: ['Data'] },
        activeSheet: { pipingClass: 'Data' },
      },
      config: { pipingClass: {} },
      key: 'pipingClass',
      fieldMap: { pipingClass: 'PIPING_CLASS', nps: 'NPS', materialName: 'MATERIAL' },
      rawRows,
      normalizedRows: rawRows,
      sourceMetadata: { source: 'piping-class-11k.xlsx' },
    });

    const result = persistChangedMasterDetailed('pipingClass', applied.context);

    assert.equal(applied.context.pipingClassRows.length, 11_000);
    assert.equal(applied.context.rawRows.pipingClass.length, 11_000);
    assert.equal(result.compact, true);
    assert.equal(result.quotaLimited, true);
    assert.equal(result.normalizedPersisted, false);
    assert.ok(result.estimatedDuplicateBytes > 1_500_000);
    assert.ok(result.failures.some((failure) => failure.key === 'xml-cii-master-pipingClass'));
    assert.equal(storage.getItem('xml-cii-master-raw-pipingClass'), null);
    assert.equal(storage.getItem('xml-cii-master-workbook-pipingClass'), null);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test('compact persistence succeeds without redundant raw/workbook copies when quota allows normalized rows', () => {
  const previousStorage = globalThis.localStorage;
  const storage = new QuotaStorage(8 * 1024 * 1024);
  globalThis.localStorage = storage;
  try {
    const rawRows = largeRows(11_000);
    const applied = commitAppliedMaster({
      context: {
        rawRows: {},
        workbookData: { pipingClass: { Data: rawRows } },
        sheetNames: { pipingClass: ['Data'] },
        activeSheet: { pipingClass: 'Data' },
      },
      config: { pipingClass: {} },
      key: 'pipingClass',
      fieldMap: { pipingClass: 'PIPING_CLASS' },
      rawRows,
      normalizedRows: rawRows,
      sourceMetadata: { source: 'piping-class-11k.xlsx' },
    });

    const result = persistChangedMasterDetailed('pipingClass', applied.context);
    assert.equal(result.compact, true);
    assert.equal(result.quotaLimited, false);
    assert.equal(result.normalizedPersisted, true);
    assert.equal(JSON.parse(storage.getItem('xml-cii-master-pipingClass')).length, 11_000);
    assert.equal(storage.getItem('xml-cii-master-raw-pipingClass'), null);
    assert.equal(storage.getItem('xml-cii-master-workbook-pipingClass'), null);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
