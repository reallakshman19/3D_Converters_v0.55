import { validateFlangeMasterStore } from './master-store.js';

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

function activeRows(store, collection) {
  return store.collections[collection].filter((record) => record.recordState !== 'RETIRED');
}

function resolveExactRecord(store, collection, selector) {
  if (!scalarSelector(selector)) {
    return failure('MASTER_SELECTOR_INVALID', `${collection} selector must contain exact scalar fields.`);
  }
  const matches = activeRows(store, collection).filter((record) => exactMatch(record, selector));
  if (!matches.length) {
    return failure('MASTER_RECORD_NOT_FOUND', `No exact ${collection} record matches selector.`, { selector });
  }
  if (matches.length > 1) {
    return failure('MASTER_RECORD_AMBIGUOUS', `Multiple exact ${collection} records match selector.`, {
      selector,
      recordIds: matches.map((record) => record.recordId),
    });
  }
  const record = matches[0];
  if (BLOCKED_STATES.has(record.recordState)) {
    return failure('MASTER_RECORD_NOT_USABLE', `${collection} ${record.recordId} is not usable.`, {
      recordState: record.recordState,
    });
  }
  return { ok: true, record };
}

function resolveSource(store, record) {
  const source = store.collections.sources.find((row) => (
    row.recordState !== 'RETIRED' && text(row.sourceId) === text(record.sourceId)
  ));
  if (!source) {
    return failure('MASTER_SOURCE_NOT_FOUND', `Source ${record.sourceId} is not available.`);
  }
  if (BLOCKED_STATES.has(source.recordState)) {
    return failure('MASTER_SOURCE_NOT_USABLE', `Source ${record.sourceId} is not usable.`, {
      recordState: source.recordState,
    });
  }
  return { ok: true, source };
}

function positiveNumber(record, field, collection) {
  const value = record[field];
  if (!Number.isFinite(value) || value <= 0) {
    return failure('MASTER_VALUE_INVALID', `${collection} ${record.recordId} requires positive ${field}.`);
  }
  return { ok: true, value };
}

function nonNegativeNumber(record, field, collection) {
  const value = record[field];
  if (!Number.isFinite(value) || value < 0) {
    return failure('MASTER_VALUE_INVALID', `${collection} ${record.recordId} requires non-negative ${field}.`);
  }
  return { ok: true, value };
}

function recordState(records, sources) {
  const states = [...records, ...sources].map((item) => item.recordState);
  if (states.includes('SYNTHETIC_TEST')) return 'SYNTHETIC_TEST_ONLY';
  if (states.some((state) => SOURCE_PENDING_STATES.has(state))) return 'SOURCE_PENDING';
  return 'RESOLVED_NOT_AUTHORIZED';
}

function resolveComponent(store, collection, selector, field, validator) {
  const resolved = resolveExactRecord(store, collection, selector);
  if (!resolved.ok) return resolved;
  const source = resolveSource(store, resolved.record);
  if (!source.ok) return source;
  const checkedValue = validator(resolved.record, field, collection);
  if (!checkedValue.ok) return checkedValue;
  return { ok: true, record: resolved.record, source: source.source, value: checkedValue.value };
}

export function resolveUg44MasterInputs(store = {}, selectors = {}) {
  const validation = validateFlangeMasterStore(store);
  if (!validation.ok) {
    return failure('MASTER_STORE_INVALID', validation.errors[0], { errors: validation.errors });
  }
  const rating = resolveComponent(
    store, 'flangeRatings', selectors.flangeRating, 'pressureRatingPa', positiveNumber,
  );
  if (!rating.ok) return rating;
  const factor = resolveComponent(
    store, 'momentFactors', selectors.momentFactor, 'momentFactor', nonNegativeNumber,
  );
  if (!factor.ok) return factor;
  const gasket = resolveComponent(
    store, 'gasketGeometries', selectors.gasketGeometry,
    'gasketReactionDiameterM', positiveNumber,
  );
  if (!gasket.ok) return gasket;

  const records = [rating.record, factor.record, gasket.record];
  const sources = [rating.source, factor.source, gasket.source];
  return {
    ok: true,
    resolverState: recordState(records, sources),
    values: {
      ratedPressurePa: rating.value,
      momentFactor: factor.value,
      gasketReactionDiameterM: gasket.value,
    },
    recordIds: records.map((record) => record.recordId),
    sourceIds: [...new Set(sources.map((source) => source.sourceId))],
    interpolationUsed: false,
    canUseForDesignAuthority: false,
  };
}
