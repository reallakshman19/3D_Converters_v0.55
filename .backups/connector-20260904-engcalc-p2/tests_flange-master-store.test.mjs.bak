import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFlangeMasterStore,
  summarizeFlangeMasterStore,
  validateFlangeMasterStore,
} from '../converters/engineering-calculations/flange/master-store.js';
import { resolveUg44MasterInputs } from '../converters/engineering-calculations/flange/ug44-master-resolver.js';

function source(overrides = {}) {
  return {
    recordId: 'SRC-SYN',
    sourceId: 'SRC-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    standard: 'SYNTHETIC STANDARD',
    edition: 'T1',
    ...overrides,
  };
}

function rating(overrides = {}) {
  return {
    recordId: 'RATING-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    standard: 'SYNTHETIC FLANGE',
    standardEdition: 'T1',
    nominalSize: 'NPS-X',
    pressureClass: 'CLASS-X',
    materialGroup: 'GROUP-X',
    temperatureC: 123,
    pressureRatingPa: 5_000_000,
    ...overrides,
  };
}

function momentFactor(overrides = {}) {
  return {
    recordId: 'FM-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    methodId: 'SYNTHETIC-METHOD',
    methodRevision: 'T1',
    flangeType: 'TYPE-X',
    momentFactor: 0.25,
    ...overrides,
  };
}

function gasket(overrides = {}) {
  return {
    recordId: 'GASKET-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    gasketGeometryId: 'GEOM-X',
    gasketType: 'TYPE-X',
    gasketReactionDiameterM: 0.123,
    ...overrides,
  };
}

function store(overrides = {}) {
  return createFlangeMasterStore({
    metadata: { libraryId: 'SYNTHETIC-UG44', revision: 'T1' },
    collections: {
      sources: [source()],
      flangeRatings: [rating()],
      momentFactors: [momentFactor()],
      gasketGeometries: [gasket()],
      ...overrides,
    },
  });
}

function selectors(overrides = {}) {
  return {
    flangeRating: {
      standard: 'SYNTHETIC FLANGE',
      nominalSize: 'NPS-X',
      temperatureC: 123,
    },
    momentFactor: {
      methodId: 'SYNTHETIC-METHOD',
      flangeType: 'TYPE-X',
    },
    gasketGeometry: {
      gasketGeometryId: 'GEOM-X',
    },
    ...overrides,
  };
}

test('flange master store is exact-match-only and below design authority', () => {
  const empty = createFlangeMasterStore();
  assert.equal(validateFlangeMasterStore(empty).ok, true);
  const summary = summarizeFlangeMasterStore(empty);
  assert.equal(summary.ok, true);
  assert.equal(summary.interpolationPolicy, 'EXACT_MATCH_ONLY');
  assert.equal(summary.canUseForDesignAuthority, false);

  empty.collections.sources.push(source({ useAuthority: 'DESIGN_AUTHORITY' }));
  const invalid = validateFlangeMasterStore(empty);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join('\n'), /authority ceiling/i);
});

test('master store rejects duplicate record and source identifiers', () => {
  const candidate = store({
    sources: [source(), source({ recordId: 'SRC-SYN-2' })],
    flangeRatings: [rating(), rating()],
  });
  const validation = validateFlangeMasterStore(candidate);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /duplicate recordId/i);
  assert.match(validation.errors.join('\n'), /duplicate sourceId/i);
});

test('UG44 master resolver returns synthetic non-authorizing exact values', () => {
  const result = resolveUg44MasterInputs(store(), selectors());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.resolverState, 'SYNTHETIC_TEST_ONLY');
  assert.equal(result.values.ratedPressurePa, 5_000_000);
  assert.equal(result.values.momentFactor, 0.25);
  assert.equal(result.values.gasketReactionDiameterM, 0.123);
  assert.equal(result.interpolationUsed, false);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('UG44 master resolver fails closed when an exact record is missing', () => {
  const result = resolveUg44MasterInputs(store(), selectors({
    flangeRating: { standard: 'NO SUCH STANDARD' },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_RECORD_NOT_FOUND');
  assert.equal(result.canUseForDesignAuthority, false);
});

test('UG44 master resolver fails closed on an ambiguous exact selector', () => {
  const candidate = store({
    flangeRatings: [rating(), rating({ recordId: 'RATING-SYN-2', pressureRatingPa: 6_000_000 })],
  });
  const result = resolveUg44MasterInputs(candidate, selectors());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_RECORD_AMBIGUOUS');
  assert.deepEqual(result.details.recordIds, ['RATING-SYN', 'RATING-SYN-2']);
});

test('retired records are excluded from exact-match resolution', () => {
  const candidate = store({
    momentFactors: [momentFactor({ recordState: 'RETIRED' })],
  });
  const result = resolveUg44MasterInputs(candidate, selectors());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_RECORD_NOT_FOUND');
});

test('source-pending records resolve only as a non-authorizing reference', () => {
  const candidate = store({
    sources: [source({ recordState: 'SOURCE_PENDING', useAuthority: 'NONE' })],
    flangeRatings: [rating({ recordState: 'SOURCE_PENDING', useAuthority: 'NONE' })],
    momentFactors: [momentFactor({ recordState: 'INDEPENDENTLY_CHECKED', useAuthority: 'ENGINEERING_SANDBOX' })],
    gasketGeometries: [gasket({ recordState: 'INDEPENDENTLY_CHECKED', useAuthority: 'ENGINEERING_SANDBOX' })],
  });
  const result = resolveUg44MasterInputs(candidate, selectors());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.resolverState, 'SOURCE_PENDING');
  assert.equal(result.canUseForDesignAuthority, false);
});

test('invalid engineering values fail closed before reaching UG44', () => {
  const candidate = store({
    gasketGeometries: [gasket({ gasketReactionDiameterM: 0 })],
  });
  const result = resolveUg44MasterInputs(candidate, selectors());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_VALUE_INVALID');
  assert.match(result.message, /gasketReactionDiameterM/);
});
