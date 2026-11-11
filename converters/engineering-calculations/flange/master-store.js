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

const CUSTODY_RANK = Object.freeze({
  SOURCE_PENDING: 1,
  TRANSCRIBED: 2,
  INDEPENDENTLY_CHECKED: 3,
  QUALIFIED: 4,
});
const CUSTODY_STATES = new Set(['TRANSCRIBED', 'INDEPENDENTLY_CHECKED', 'QUALIFIED']);
const REVIEWED_STATES = new Set(['INDEPENDENTLY_CHECKED', 'QUALIFIED']);

function text(value) {
  return String(value ?? '').trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emptyCollections() {
  return Object.fromEntries(FLANGE_MASTER_COLLECTIONS.map((name) => [name, []]));
}

function requiredText(record, fields, collection) {
  return fields
    .filter((field) => !text(record?.[field]))
    .map((field) => `${collection} ${record.recordId} ${field} is required for ${record.recordState} custody.`);
}

function requiredFinite(record, fields, collection, positive = false) {
  return fields.flatMap((field) => {
    const value = record?.[field];
    if (!Number.isFinite(value) || (positive && value <= 0)) {
      const adjective = positive ? 'positive finite' : 'finite';
      return [`${collection} ${record.recordId} ${field} must be ${adjective} for ${record.recordState} custody.`];
    }
    return [];
  });
}

function reviewCustodyErrors(record, collection) {
  return REVIEWED_STATES.has(record?.recordState)
    ? requiredText(record, ['reviewedBy', 'reviewDate'], collection)
    : [];
}

function sourceCustodyErrors(record) {
  if (!CUSTODY_STATES.has(record?.recordState)) return [];
  return [
    ...requiredText(record, [
      'standard', 'edition', 'sourceDocument', 'sourceRevision', 'sourceSectionOrTable',
    ], 'sources'),
    ...reviewCustodyErrors(record, 'sources'),
  ];
}

function recordCustodyErrors(record, collection) {
  if (!CUSTODY_STATES.has(record?.recordState)) return [];
  let errors = [];
  if (collection === 'flangeRatings') {
    errors = [
      ...requiredText(record, [
        'standard', 'standardEdition', 'nominalSize', 'pressureClass', 'series',
        'flangeType', 'materialGroup',
      ], collection),
      ...requiredFinite(record, ['temperatureC'], collection),
      ...requiredFinite(record, ['pressureRatingPa'], collection, true),
    ];
  } else if (collection === 'momentFactors') {
    errors = [
      ...requiredText(record, [
        'methodId', 'methodRevision', 'flangeType', 'applicability',
      ], collection),
      ...requiredFinite(record, ['momentFactor'], collection),
    ];
    if (Number.isFinite(record.momentFactor) && record.momentFactor < 0) {
      errors.push(`${collection} ${record.recordId} momentFactor must be non-negative for ${record.recordState} custody.`);
    }
  } else if (collection === 'gasketGeometries') {
    errors = [
      ...requiredText(record, [
        'gasketGeometryId', 'gasketType', 'gasketReactionDiameterBasis',
      ], collection),
      ...requiredFinite(record, ['gasketReactionDiameterM'], collection, true),
    ];
  }
  return [...errors, ...reviewCustodyErrors(record, collection)];
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

function sourceReferenceError(record, collection, sourceMap) {
  if (collection === 'sources') return null;
  if (!text(record?.sourceId)) return `${collection} ${record.recordId} sourceId is required.`;
  const source = sourceMap.get(text(record.sourceId));
  if (!source) return `${collection} ${record.recordId} references missing sourceId ${record.sourceId}.`;
  if (CUSTODY_STATES.has(record.recordState)) {
    const recordRank = CUSTODY_RANK[record.recordState] ?? 0;
    const sourceRank = CUSTODY_RANK[source.recordState] ?? 0;
    if (sourceRank < recordRank) {
      return `${collection} ${record.recordId} custody exceeds source ${record.sourceId} maturity.`;
    }
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

function validateCollection(rows, collection, sourceMap) {
  if (!Array.isArray(rows)) return [`collections.${collection} must be an array.`];
  const errors = [...duplicateErrors(rows, collection)];
  for (const record of rows) {
    const structuralError = recordError(record, collection);
    if (structuralError) errors.push(structuralError);
    errors.push(...(collection === 'sources'
      ? sourceCustodyErrors(record)
      : recordCustodyErrors(record, collection)));
    const sourceError = sourceReferenceError(record, collection, sourceMap);
    if (sourceError) errors.push(sourceError);
  }
  return errors;
}

function sourceMapFrom(store) {
  const rows = Array.isArray(store?.collections?.sources) ? store.collections.sources : [];
  return new Map(rows.map((row) => [text(row.sourceId), row]).filter(([id]) => id));
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
  const sourceMap = sourceMapFrom(store);
  errors.push(...sourceIdErrors(store.collections?.sources));
  for (const collection of FLANGE_MASTER_COLLECTIONS) {
    errors.push(...validateCollection(store.collections?.[collection], collection, sourceMap));
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
