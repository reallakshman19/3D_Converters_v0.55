import { validateBoltMasterStore } from './master-store.js';

const BLOCKED_STATES = new Set(['SCHEMA_ONLY', 'DRAFT', 'RETIRED']);
const SOURCE_PENDING_STATES = new Set(['SOURCE_PENDING', 'TRANSCRIBED']);

function text(value) {
  return String(value ?? '').trim();
}

function failure(code, message, details = {}) {
  return { ok: false, code, message, details, canUseForDesignAuthority: false };
}

function scalarSelector(selector) {
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return false;
  const entries = Object.entries(selector);
  if (!entries.length) return false;
  return entries.every(([, value]) => (
    ['string', 'number', 'boolean'].includes(typeof value) && value !== ''
  ));
}

function sameScalar(actual, expected) {
  if (typeof actual === 'number' || typeof expected === 'number') {
    return typeof actual === 'number' && typeof expected === 'number' && Object.is(actual, expected);
  }
  return text(actual) === text(expected);
}

function exactMatch(record, selector) {
  return Object.entries(selector).every(([key, expected]) => (
    Object.hasOwn(record, key) && sameScalar(record[key], expected)
  ));
}

function resolveExactRecord(store, collection, selector) {
  if (!scalarSelector(selector)) {
    return failure('MASTER_SELECTOR_INVALID', `${collection} selector must contain exact scalar fields.`);
  }
  const matches = store.collections[collection]
    .filter((record) => record.recordState !== 'RETIRED')
    .filter((record) => exactMatch(record, selector));
  if (!matches.length) {
    return failure('MASTER_RECORD_NOT_FOUND', `No exact ${collection} record matches selector.`, { selector });
  }
  if (matches.length > 1) {
    return failure('MASTER_RECORD_AMBIGUOUS', `Multiple exact ${collection} records match selector.`, {
      selector,
      recordIds: matches.map((record) => record.recordId),
    });
  }
  if (BLOCKED_STATES.has(matches[0].recordState)) {
    return failure('MASTER_RECORD_NOT_USABLE', `${collection} ${matches[0].recordId} is not usable.`);
  }
  return { ok: true, record: matches[0] };
}

function resolveSource(store, record) {
  const source = store.collections.sources.find((row) => (
    row.recordState !== 'RETIRED' && text(row.sourceId) === text(record.sourceId)
  ));
  if (!source) return failure('MASTER_SOURCE_NOT_FOUND', `Source ${record.sourceId} is not available.`);
  if (BLOCKED_STATES.has(source.recordState)) {
    return failure('MASTER_SOURCE_NOT_USABLE', `Source ${record.sourceId} is not usable.`);
  }
  return { ok: true, source };
}

function positive(record, field, collection) {
  const value = record[field];
  if (!Number.isFinite(value) || value <= 0) {
    return failure('MASTER_VALUE_INVALID', `${collection} ${record.recordId} requires positive ${field}.`);
  }
  return { ok: true, value };
}

function nutFactors(record) {
  const min = record.nutFactorMin;
  const nominal = record.nutFactor;
  const max = record.nutFactorMax;
  if (![min, nominal, max].every((value) => Number.isFinite(value) && value > 0)) {
    return failure('MASTER_VALUE_INVALID', `frictionConditions ${record.recordId} requires positive nut factors.`);
  }
  if (!(min <= nominal && nominal <= max)) {
    return failure('MASTER_VALUE_INVALID', `frictionConditions ${record.recordId} nut factors are not ordered.`);
  }
  return { ok: true, value: { min, nominal, max } };
}

function component(store, collection, selector, valueResolver) {
  const resolved = resolveExactRecord(store, collection, selector);
  if (!resolved.ok) return resolved;
  const source = resolveSource(store, resolved.record);
  if (!source.ok) return source;
  const value = valueResolver(resolved.record);
  if (!value.ok) return value;
  return { ok: true, record: resolved.record, source: source.source, value: value.value };
}

function resolverState(records, sources) {
  const states = [...records, ...sources].map((item) => item.recordState);
  if (states.includes('SYNTHETIC_TEST')) return 'SYNTHETIC_TEST_ONLY';
  if (states.some((state) => SOURCE_PENDING_STATES.has(state))) return 'SOURCE_PENDING';
  return 'RESOLVED_NOT_AUTHORIZED';
}

export function resolveBoltShortFormMasters(store = {}, selectors = {}) {
  const validation = validateBoltMasterStore(store);
  if (!validation.ok) {
    return failure('MASTER_STORE_INVALID', validation.errors[0], { errors: validation.errors });
  }
  const thread = component(store, 'threads', selectors.thread, (record) => ({
    ok: true,
    value: {
      tensileStressAreaM2: positive(record, 'tensileStressAreaM2', 'threads').value,
      nominalDiameterM: positive(record, 'nominalDiameterM', 'threads').value,
    },
  }));
  if (!thread.ok || !thread.value?.tensileStressAreaM2 || !thread.value?.nominalDiameterM) {
    return thread.ok ? failure('MASTER_VALUE_INVALID', 'Thread master values are invalid.') : thread;
  }

  const material = component(store, 'materials', selectors.material, (record) => (
    positive(record, 'referenceStressPa', 'materials')
  ));
  if (!material.ok) return material;

  const friction = component(store, 'frictionConditions', selectors.frictionCondition, nutFactors);
  if (!friction.ok) return friction;

  const records = [thread.record, material.record, friction.record];
  const sources = [thread.source, material.source, friction.source];
  return {
    ok: true,
    resolverState: resolverState(records, sources),
    values: {
      ...thread.value,
      referenceStressPa: material.value,
      nutFactorMin: friction.value.min,
      nutFactor: friction.value.nominal,
      nutFactorMax: friction.value.max,
    },
    recordIds: records.map((record) => record.recordId),
    sourceIds: [...new Set(sources.map((source) => source.sourceId))],
    interpolationUsed: false,
    preloadFractionResolved: false,
    canUseForDesignAuthority: false,
  };
}
