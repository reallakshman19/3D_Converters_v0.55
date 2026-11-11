export const XML_CII_STANDALONE_AUTHORITY_SCHEMA = 'xml-cii-standalone-authority/v1-20260916';
export const XML_CII_STANDALONE_AUTHORITY_MARKER_KEY = 'xml-cii-standalone-authority-schema';

export const XML_CII_DERIVED_CACHE_PREFIXES = Object.freeze([
  'xml-cii-pv-cache-',
  'xml-cii-wm-cache-',
  'xml-cii-preview-rating-snapshot-',
]);

export const XML_CII_DERIVED_CACHE_EXACT_KEYS = Object.freeze([
  'xml-cii-preview-line-authority-version',
]);

function storageKeys(storage) {
  const out = [];
  const length = Number(storage?.length);
  if (!Number.isInteger(length) || length < 0 || typeof storage?.key !== 'function') return out;
  for (let index = 0; index < length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key) out.push(key);
  }
  return out;
}

export function isXmlCiiDerivedAuthorityCacheKey(key) {
  const value = String(key || '');
  return XML_CII_DERIVED_CACHE_EXACT_KEYS.includes(value)
    || XML_CII_DERIVED_CACHE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

export function migrateXmlCiiStandaloneAuthorityStorage(storage) {
  const report = {
    schema: XML_CII_STANDALONE_AUTHORITY_SCHEMA,
    markerKey: XML_CII_STANDALONE_AUTHORITY_MARKER_KEY,
    migrated: false,
    previousSchema: null,
    removedKeys: [],
    legacyWeightPolicy: 'PRESERVE_NUMERIC_VALUES_AS_FALLBACK_EVIDENCE_ONLY',
    sourceStatePolicy: 'PRESERVE_MASTERS_MAPPINGS_CONFIG_AND_USER_EVIDENCE',
  };
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    return { ...report, storageAvailable: false };
  }

  try {
    report.previousSchema = storage.getItem(XML_CII_STANDALONE_AUTHORITY_MARKER_KEY);
    if (report.previousSchema === XML_CII_STANDALONE_AUTHORITY_SCHEMA) {
      return { ...report, storageAvailable: true };
    }

    for (const key of storageKeys(storage)) {
      if (!isXmlCiiDerivedAuthorityCacheKey(key)) continue;
      storage.removeItem(key);
      report.removedKeys.push(key);
    }
    storage.setItem(XML_CII_STANDALONE_AUTHORITY_MARKER_KEY, XML_CII_STANDALONE_AUTHORITY_SCHEMA);
    report.migrated = true;
    return { ...report, storageAvailable: true };
  } catch (error) {
    return {
      ...report,
      storageAvailable: false,
      error: String(error?.message || error),
    };
  }
}

function browserStorage() {
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

// Side-effect is deliberately limited to derived caches. Source/evidence state
// (masters, mappings, support config, and legacy rigidWeight values) is not read,
// transformed, or rewritten by this migration.
export const XML_CII_AUTHORITY_MIGRATION_REPORT = migrateXmlCiiStandaloneAuthorityStorage(browserStorage());
