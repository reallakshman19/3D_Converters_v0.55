export const BOLT_MASTER_STORE_VERSION = 'bolt-master-store/v1';

export const BOLT_MASTER_RECORD_STATES = Object.freeze([
  'SCHEMA_ONLY',
  'SYNTHETIC_TEST',
  'DRAFT',
  'SOURCE_PENDING',
  'TRANSCRIBED',
  'INDEPENDENTLY_CHECKED',
  'QUALIFIED',
  'RETIRED',
]);

export const BOLT_MASTER_USE_AUTHORITIES = Object.freeze([
  'NONE',
  'TEST_ONLY',
  'ENGINEERING_SANDBOX',
  'DESIGN_AUTHORITY',
]);

export const BOLT_MASTER_COLLECTIONS = Object.freeze([
  'sources',
  'threads',
  'materials',
  'frictionConditions',
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
  return Object.fromEntries(BOLT_MASTER_COLLECTIONS.map((name) => [name, []]));
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

function orderedRange(record, fields, collection, positive) {
  const errors = requiredFinite(record, fields, collection, positive);
  if (errors.length) return errors;
  const [min, nominal, max] = fields.map((field) => record[field]);
  return min <= nominal && nominal <= max
    ? []
    : [`${collection} ${record.recordId} ${fields.join('/')} must satisfy min <= nominal <= max.`];
}

function frictionCustodyErrors(record, collection) {
  const errors = [
    ...requiredText(record, [
      'conditionId', 'finish', 'coating', 'lubricant', 'reuseCondition', 'frictionBasis',
    ], collection),
    ...requiredFinite(record, ['temperatureC'], collection),
  ];
  const kFields = ['nutFactorMin', 'nutFactor', 'nutFactorMax'];
  const threadFields = [
    'threadFrictionCoefficientMin', 'threadFrictionCoefficient', 'threadFrictionCoefficientMax',
  ];
  const bearingFields = [
    'bearingFrictionCoefficientMin', 'bearingFrictionCoefficient', 'bearingFrictionCoefficientMax',
  ];
  const hasK = kFields.every((field) => Number.isFinite(record?.[field]));
  const hasDetailed = [...threadFields, ...bearingFields].every((field) => Number.isFinite(record?.[field]));
  if (hasK) errors.push(...orderedRange(record, kFields, collection, true));
  if (hasDetailed) {
    errors.push(...orderedRange(record, threadFields, collection, false));
    errors.push(...orderedRange(record, bearingFields, collection, false));
    if ([...threadFields, ...bearingFields].some((field) => record[field] < 0)) {
      errors.push(`${collection} ${record.recordId} friction coefficients must be non-negative for ${record.recordState} custody.`);
    }
  }
  if (!hasK && !hasDetailed) {
    errors.push(`${collection} ${record.recordId} requires an ordered nut-factor range or ordered thread/bearing friction ranges for ${record.recordState} custody.`);
  }
  return errors;
}

function recordCustodyErrors(record, collection) {
  if (!CUSTODY_STATES.has(record?.recordState)) return [];
  let errors = [];
  if (collection === 'threads') {
    errors = [
      ...requiredText(record, ['threadStandard', 'standardEdition', 'nominalDesignation'], collection),
      ...requiredFinite(record, [
        'nominalDiameterM', 'pitchM', 'leadM', 'pitchDiameterM',
        'tensileStressAreaM2', 'stressSectionDiameterM',
      ], collection, true),
    ];
  } else if (collection === 'materials') {
    errors = [
      ...requiredText(record, ['materialSpec', 'referenceStressBasis'], collection),
      ...requiredFinite(record, ['temperatureC'], collection),
      ...requiredFinite(record, ['referenceStressPa'], collection, true),
    ];
  } else if (collection === 'frictionConditions') {
    errors = frictionCustodyErrors(record, collection);
  }
  return [...errors, ...reviewCustodyErrors(record, collection)];
}

function recordError(record, collection) {
  if (!text(record?.recordId)) return `${collection} recordId is required.`;
  if (!BOLT_MASTER_RECORD_STATES.includes(record.recordState)) {
    return `${collection} ${record.recordId} has unsupported recordState.`;
  }
  if (!BOLT_MASTER_USE_AUTHORITIES.includes(record.useAuthority)) {
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

export function createBoltMasterStore({ metadata = {}, collections = {} } = {}) {
  return {
    schemaVersion: BOLT_MASTER_STORE_VERSION,
    authorityCeiling: 'ENGINEERING_SANDBOX',
    canUseForDesignAuthority: false,
    interpolationPolicy: 'EXACT_MATCH_ONLY',
    metadata: clone(metadata),
    collections: {
      ...emptyCollections(),
      ...Object.fromEntries(
        BOLT_MASTER_COLLECTIONS.map((name) => [name, clone(collections[name] ?? [])]),
      ),
    },
  };
}

export function validateBoltMasterStore(store = {}) {
  const errors = [];
  if (store.schemaVersion !== BOLT_MASTER_STORE_VERSION) {
    errors.push('Unsupported or missing bolt master-store schemaVersion.');
  }
  if (store.authorityCeiling !== 'ENGINEERING_SANDBOX') {
    errors.push('Bolt master-store authorityCeiling must be ENGINEERING_SANDBOX.');
  }
  if (store.canUseForDesignAuthority !== false) {
    errors.push('Bolt master store must set canUseForDesignAuthority=false.');
  }
  if (store.interpolationPolicy !== 'EXACT_MATCH_ONLY') {
    errors.push('Bolt master store interpolationPolicy must be EXACT_MATCH_ONLY.');
  }
  const sourceMap = sourceMapFrom(store);
  errors.push(...sourceIdErrors(store.collections?.sources));
  for (const collection of BOLT_MASTER_COLLECTIONS) {
    errors.push(...validateCollection(store.collections?.[collection], collection, sourceMap));
  }
  return { ok: errors.length === 0, errors };
}

export function summarizeBoltMasterStore(store = {}) {
  const validation = validateBoltMasterStore(store);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, canUseForDesignAuthority: false };
  }
  return {
    ok: true,
    collections: Object.fromEntries(
      BOLT_MASTER_COLLECTIONS.map((name) => [name, store.collections[name].length]),
    ),
    interpolationPolicy: store.interpolationPolicy,
    canUseForDesignAuthority: false,
  };
}
