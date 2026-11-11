import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  XML_CII_STANDALONE_AUTHORITY_MARKER_KEY,
  XML_CII_STANDALONE_AUTHORITY_SCHEMA,
  isXmlCiiDerivedAuthorityCacheKey,
  migrateXmlCiiStandaloneAuthorityStorage,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-authority-migration.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [String(key), String(value)]));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    snapshot() { return Object.fromEntries(data); },
  };
}

test('authority migration removes derived caches but preserves source/evidence state', () => {
  const legacyConfig = JSON.stringify({
    overrides: {
      rigidWeight: { 'BR-1|N10': 125 },
      rigidWeightMatch1: { 'BR-1|N10': 12.5 },
    },
  });
  const storage = fakeStorage({
    'xml-cii-pv-cache-v8-rating-policy': '{"derived":true}',
    'xml-cii-pv-cache-v7': '{"derived":true}',
    'xml-cii-wm-cache-v2-preview-rating': '{"derived":true}',
    'xml-cii-preview-rating-snapshot-v2': '{"derived":true}',
    'xml-cii-preview-line-authority-version': 'strict-explicit-or-exact-v1',
    'xml-cii-import-masters-v1': legacyConfig,
    'xml-cii-master-lineList': '[{"Line":"P4110001"}]',
    'xml-cii-saved-mappings-lineList': '{"fixture.xlsx":{"from":"From"}}',
  });

  const report = migrateXmlCiiStandaloneAuthorityStorage(storage);
  const after = storage.snapshot();

  assert.equal(report.migrated, true);
  assert.equal(report.storageAvailable, true);
  assert.equal(after[XML_CII_STANDALONE_AUTHORITY_MARKER_KEY], XML_CII_STANDALONE_AUTHORITY_SCHEMA);
  assert.equal(after['xml-cii-pv-cache-v8-rating-policy'], undefined);
  assert.equal(after['xml-cii-pv-cache-v7'], undefined);
  assert.equal(after['xml-cii-wm-cache-v2-preview-rating'], undefined);
  assert.equal(after['xml-cii-preview-rating-snapshot-v2'], undefined);
  assert.equal(after['xml-cii-preview-line-authority-version'], undefined);
  assert.equal(after['xml-cii-import-masters-v1'], legacyConfig);
  assert.equal(after['xml-cii-master-lineList'], '[{"Line":"P4110001"}]');
  assert.equal(after['xml-cii-saved-mappings-lineList'], '{"fixture.xlsx":{"from":"From"}}');
  assert.match(report.legacyWeightPolicy, /PRESERVE_NUMERIC_VALUES/);
});

test('authority migration is idempotent once current marker is present', () => {
  const storage = fakeStorage({
    [XML_CII_STANDALONE_AUTHORITY_MARKER_KEY]: XML_CII_STANDALONE_AUTHORITY_SCHEMA,
    'xml-cii-pv-cache-v8-rating-policy': 'new-session-cache',
    'xml-cii-import-masters-v1': 'source-evidence',
  });

  const report = migrateXmlCiiStandaloneAuthorityStorage(storage);
  assert.equal(report.migrated, false);
  assert.deepEqual(report.removedKeys, []);
  assert.equal(storage.getItem('xml-cii-pv-cache-v8-rating-policy'), 'new-session-cache');
  assert.equal(storage.getItem('xml-cii-import-masters-v1'), 'source-evidence');
});

test('cache classifier is bounded to derived authority keys', () => {
  for (const key of [
    'xml-cii-pv-cache-v6',
    'xml-cii-wm-cache-v1',
    'xml-cii-preview-rating-snapshot-v1',
    'xml-cii-preview-line-authority-version',
  ]) assert.equal(isXmlCiiDerivedAuthorityCacheKey(key), true, key);

  for (const key of [
    'xml-cii-import-masters-v1',
    'xml-cii-master-lineList',
    'xml-cii-master-source-lineList',
    'xml-cii-saved-mappings-lineList',
    'xml-cii-regex-config-v1',
  ]) assert.equal(isXmlCiiDerivedAuthorityCacheKey(key), false, key);
});

test('Preview and Weight Match activate the same shared migration owner', () => {
  const preview = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js', import.meta.url), 'utf8');
  const weight = fs.readFileSync(new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-weight-match-v2.js', import.meta.url), 'utf8');
  const importLiteral = "import './xml-cii-adapted-authority-migration.js';";
  assert(preview.includes(importLiteral));
  assert(weight.includes(importLiteral));
});
