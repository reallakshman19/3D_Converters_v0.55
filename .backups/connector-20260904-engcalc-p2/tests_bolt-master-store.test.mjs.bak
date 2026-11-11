import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoltMasterStore,
  summarizeBoltMasterStore,
  validateBoltMasterStore,
} from '../converters/engineering-calculations/bolts/master-store.js';
import { resolveBoltShortFormMasters } from '../converters/engineering-calculations/bolts/short-form-master-resolver.js';

function source(overrides = {}) {
  return {
    recordId: 'SRC-SYN',
    sourceId: 'SRC-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    standard: 'SYNTHETIC SOURCE',
    edition: 'T1',
    ...overrides,
  };
}

function thread(overrides = {}) {
  return {
    recordId: 'THREAD-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    threadStandard: 'SYNTHETIC THREAD',
    nominalDesignation: 'X10',
    tensileStressAreaM2: 100e-6,
    nominalDiameterM: 0.01,
    ...overrides,
  };
}

function material(overrides = {}) {
  return {
    recordId: 'MAT-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    materialSpec: 'SYNTHETIC MATERIAL',
    temperatureC: 100,
    referenceStressBasis: 'SYNTHETIC_REFERENCE',
    referenceStressPa: 200e6,
    ...overrides,
  };
}

function friction(overrides = {}) {
  return {
    recordId: 'FRIC-SYN',
    recordState: 'SYNTHETIC_TEST',
    useAuthority: 'TEST_ONLY',
    sourceId: 'SRC-SYN',
    conditionId: 'SYNTHETIC-CONDITION',
    finish: 'SYNTHETIC',
    lubricant: 'SYNTHETIC',
    nutFactorMin: 0.15,
    nutFactor: 0.2,
    nutFactorMax: 0.25,
    ...overrides,
  };
}

function store(overrides = {}) {
  return createBoltMasterStore({
    metadata: { libraryId: 'SYNTHETIC-BOLT', revision: 'T1' },
    collections: {
      sources: [source()],
      threads: [thread()],
      materials: [material()],
      frictionConditions: [friction()],
      ...overrides,
    },
  });
}

function selectors(overrides = {}) {
  return {
    thread: { threadStandard: 'SYNTHETIC THREAD', nominalDesignation: 'X10' },
    material: { materialSpec: 'SYNTHETIC MATERIAL', temperatureC: 100 },
    frictionCondition: { conditionId: 'SYNTHETIC-CONDITION' },
    ...overrides,
  };
}

test('bolt master store enforces exact-match sandbox authority ceiling', () => {
  const empty = createBoltMasterStore();
  assert.equal(validateBoltMasterStore(empty).ok, true);
  const summary = summarizeBoltMasterStore(empty);
  assert.equal(summary.ok, true);
  assert.equal(summary.interpolationPolicy, 'EXACT_MATCH_ONLY');
  assert.equal(summary.canUseForDesignAuthority, false);

  empty.collections.sources.push(source({ useAuthority: 'DESIGN_AUTHORITY' }));
  const invalid = validateBoltMasterStore(empty);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors.join('\n'), /authority ceiling/i);
});

test('bolt master store rejects duplicate record and source identifiers', () => {
  const candidate = store({
    sources: [source(), source({ recordId: 'SRC-SYN-2' })],
    materials: [material(), material()],
  });
  const validation = validateBoltMasterStore(candidate);
  assert.equal(validation.ok, false);
  assert.match(validation.errors.join('\n'), /duplicate recordId/i);
  assert.match(validation.errors.join('\n'), /duplicate sourceId/i);
});

test('short-form masters resolve synthetic thread, material and friction values only', () => {
  const result = resolveBoltShortFormMasters(store(), selectors());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.resolverState, 'SYNTHETIC_TEST_ONLY');
  assert.equal(result.values.tensileStressAreaM2, 100e-6);
  assert.equal(result.values.nominalDiameterM, 0.01);
  assert.equal(result.values.referenceStressPa, 200e6);
  assert.equal(result.values.nutFactorMin, 0.15);
  assert.equal(result.values.nutFactor, 0.2);
  assert.equal(result.values.nutFactorMax, 0.25);
  assert.equal(result.preloadFractionResolved, false);
  assert.equal(result.interpolationUsed, false);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('missing exact friction condition fails closed', () => {
  const result = resolveBoltShortFormMasters(store(), selectors({
    frictionCondition: { conditionId: 'NO-SUCH-CONDITION' },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_RECORD_NOT_FOUND');
  assert.equal(result.canUseForDesignAuthority, false);
});

test('ambiguous exact material selector fails closed', () => {
  const candidate = store({
    materials: [material(), material({ recordId: 'MAT-SYN-2', referenceStressPa: 210e6 })],
  });
  const result = resolveBoltShortFormMasters(candidate, selectors());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_RECORD_AMBIGUOUS');
  assert.deepEqual(result.details.recordIds, ['MAT-SYN', 'MAT-SYN-2']);
});

test('invalid nut-factor ordering fails before short-form torque use', () => {
  const candidate = store({
    frictionConditions: [friction({ nutFactorMin: 0.25, nutFactor: 0.2, nutFactorMax: 0.15 })],
  });
  const result = resolveBoltShortFormMasters(candidate, selectors());
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MASTER_VALUE_INVALID');
  assert.match(result.message, /not ordered/i);
});

test('source-pending custody resolves only as non-authorizing reference', () => {
  const candidate = store({
    sources: [source({ recordState: 'SOURCE_PENDING', useAuthority: 'NONE' })],
    threads: [thread({ recordState: 'SOURCE_PENDING', useAuthority: 'NONE' })],
    materials: [material({ recordState: 'INDEPENDENTLY_CHECKED', useAuthority: 'ENGINEERING_SANDBOX' })],
    frictionConditions: [friction({ recordState: 'INDEPENDENTLY_CHECKED', useAuthority: 'ENGINEERING_SANDBOX' })],
  });
  const result = resolveBoltShortFormMasters(candidate, selectors());
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.resolverState, 'SOURCE_PENDING');
  assert.equal(result.canUseForDesignAuthority, false);
});
