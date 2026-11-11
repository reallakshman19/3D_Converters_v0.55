export const FLANGE_MASTER_STORE_VERSION = 'flange-master-store/v1';

export const FLANGE_MASTER_RECORD_STATES = Object.freeze([
  'SCHEMA_ONLY',
  'SYNTHETIC_TEST',
  'DRAFT',
  'SOURCE_PENDING',
  'TRANSCRIBED',
  'INDEPENDENTLY_CHECKED',
  'QUALIFIED',
  'RETIRED',
]);

export const FLANGE_MASTER_USE_AUTHORITIES = Object.freeze([
  'NONE',
  'TEST_ONLY',
  'ENGINEERING_SANDBOX',
  'DESIGN_AUTHORITY',
]);

export const FLANGE_MASTER_COLLECTIONS = Object.freeze([
  'sources',
  'flangeRatings',
  'momentFactors',
  'gasketGeometries',
]);

function text(value) {
  return String(value ?? '').trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyCollections() {
  return Object.fromEntries(FLANGE_MASTER_COLLECTIONS.map((name) => [name, []]));
}

function recordError(record, collection) {
  if (!text(record?.recordId)) return `${collection} recordId is required.`;
  if (!FLANGE_MASTER_RECORD_STATES.includes(record.recordState)) {
    return `${collection} ${record.recordId} has unsupported recordState.`;
  }
  if (!FLANGE_MASTER_USE_AUTHORITIES.includes(record.useAuthority)) {
    return `${collection} ${record.recordId} has unsupported useAuthority.`;
  }
  if (record.useAuthority === 'DESIGN_AUTHORITY') {
    return `${collection} ${record.recordId} exceeds the v1 authority ceiling.`;
  }
  return null;
}

function sourceReferenceError(record, collection, sourceIds) {
  if (collection === 'sources') return null;
  if (!text(record?.sourceId)) return `${collection} ${record.recordId} sourceId is required.`;
  if (!sourceIds.has(text(record.sourceId))) {
    return `${collection} ${record.recordId} references missing sourceId ${record.sourceId}.`;
  }
  return null;
}

function duplicateErrors(rows, collection) {
  const errors = [];
  const ids = new Set();
  for (const record of rows) {
    const id = text(record?.recordId);
    if (id && ids.has(id)) errors.push(`${collection} duplicate recordId: ${id}.`);
    if (id) ids.add(id);
  }
  return errors;
}

function validateCollection(rows, collection, sourceIds) {
  if (!Array.isArray(rows)) return [`collections.${collection} must be an array.`];
  const errors = [...duplicateErrors(rows, collection)];
  for (const record of rows) {
    const structuralError = recordError(record, collection);
    if (structuralError) errors.push(structuralError);
    const sourceError = sourceReferenceError(record, collection, sourceIds);
    if (sourceError) errors.push(sourceError);
  }
  return errors;
}

function sourceIdsFrom(store) {
  const rows = Array.isArray(store?.collections?.sources) ? store.collections.sources : [];
  return new Set(rows.map((row) => text(row.sourceId)).filter(Boolean));
}

function sourceIdErrors(rows) {
  if (!Array.isArray(rows)) return [];
  const errors = [];
  const ids = new Set();
  for (const row of rows) {
    const sourceId = text(row?.sourceId);
    if (!sourceId) errors.push(`sources ${row?.recordId ?? 'record'} sourceId is required.`);
    if (sourceId && ids.has(sourceId)) errors.push(`sources duplicate sourceId: ${sourceId}.`);
    if (sourceId) ids.add(sourceId);
  }
  return errors;
}

export function createFlangeMasterStore({ metadata = {}, collections = {} } = {}) {
  return {
    schemaVersion: FLANGE_MASTER_STORE_VERSION,
    authorityCeiling: 'ENGINEERING_SANDBOX',
    canUseForDesignAuthority: false,
    interpolationPolicy: 'EXACT_MATCH_ONLY',
    metadata: clone(metadata),
    collections: {
      ...emptyCollections(),
      ...Object.fromEntries(
        FLANGE_MASTER_COLLECTIONS.map((name) => [name, clone(collections[name] ?? [])]),
      ),
    },
  };
}

export function validateFlangeMasterStore(store = {}) {
  const errors = [];
  if (store.schemaVersion !== FLANGE_MASTER_STORE_VERSION) {
    errors.push('Unsupported or missing flange master-store schemaVersion.');
  }
  if (store.authorityCeiling !== 'ENGINEERING_SANDBOX') {
    errors.push('Flange master-store authorityCeiling must be ENGINEERING_SANDBOX.');
  }
  if (store.canUseForDesignAuthority !== false) {
    errors.push('Flange master store must set canUseForDesignAuthority=false.');
  }
  if (store.interpolationPolicy !== 'EXACT_MATCH_ONLY') {
    errors.push('Flange master store interpolationPolicy must be EXACT_MATCH_ONLY.');
  }
  const sourceIds = sourceIdsFrom(store);
  errors.push(...sourceIdErrors(store.collections?.sources));
  for (const collection of FLANGE_MASTER_COLLECTIONS) {
    errors.push(...validateCollection(store.collections?.[collection], collection, sourceIds));
  }
  return { ok: errors.length === 0, errors };
}

export function summarizeFlangeMasterStore(store = {}) {
  const validation = validateFlangeMasterStore(store);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, canUseForDesignAuthority: false };
  }
  return {
    ok: true,
    collections: Object.fromEntries(
      FLANGE_MASTER_COLLECTIONS.map((name) => [name, store.collections[name].length]),
    ),
    interpolationPolicy: store.interpolationPolicy,
    canUseForDesignAuthority: false,
  };
}
