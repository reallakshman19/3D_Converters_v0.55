import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFlangeMasterStore,
  validateFlangeMasterStore,
} from '../converters/engineering-calculations/flange/master-store.js';
import { resolveUg44MasterInputs } from '../converters/engineering-calculations/flange/ug44-master-resolver.js';
import {
  createBoltMasterStore,
  validateBoltMasterStore,
} from '../converters/engineering-calculations/bolts/master-store.js';
import { resolveBoltShortFormMasters } from '../converters/engineering-calculations/bolts/short-form-master-resolver.js';

const REVIEW = Object.freeze({ reviewedBy: 'INDEPENDENT-REVIEWER', reviewDate: '2026-09-04' });

function governedSource(overrides = {}) {
  return {
    recordId: 'SRC-GOV', sourceId: 'SRC-GOV', recordState: 'QUALIFIED',
    useAuthority: 'ENGINEERING_SANDBOX', standard: 'CONTROLLED STANDARD', edition: 'ED-1',
    sourceDocument: 'CONTROLLED-DOC', sourceRevision: 'REV-1', sourceSectionOrTable: 'TABLE-1',
    ...REVIEW,
    ...overrides,
  };
}

function governedFlangeStore(overrides = {}) {
  return createFlangeMasterStore({
    collections: {
      sources: [governedSource()],
      flangeRatings: [{
        recordId: 'RATING-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', standard: 'CONTROLLED FLANGE', standardEdition: 'ED-1',
        nominalSize: 'NPS-X', pressureClass: 'CLASS-X', series: 'NOT_APPLICABLE',
        flangeType: 'WELDING_NECK', materialGroup: 'GROUP-X', temperatureC: 200,
        pressureRatingPa: 4_000_000, ...REVIEW,
      }],
      momentFactors: [{
        recordId: 'FM-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', methodId: 'CONTROLLED-METHOD', methodRevision: 'REV-1',
        flangeType: 'WELDING_NECK', applicability: 'DECLARED TEST APPLICABILITY',
        momentFactor: 0.5, ...REVIEW,
      }],
      gasketGeometries: [{
        recordId: 'GASKET-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', gasketGeometryId: 'GASKET-X', gasketType: 'RING',
        gasketReactionDiameterBasis: 'CONTROLLED-DERIVATION', gasketReactionDiameterM: 0.2,
        ...REVIEW,
      }],
      ...overrides,
    },
  });
}

function flangeSelectors() {
  return {
    flangeRating: { standard: 'CONTROLLED FLANGE', nominalSize: 'NPS-X', temperatureC: 200 },
    momentFactor: { methodId: 'CONTROLLED-METHOD', flangeType: 'WELDING_NECK' },
    gasketGeometry: { gasketGeometryId: 'GASKET-X' },
  };
}

function governedBoltStore(overrides = {}) {
  return createBoltMasterStore({
    collections: {
      sources: [governedSource()],
      threads: [{
        recordId: 'THREAD-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', threadStandard: 'CONTROLLED THREAD', standardEdition: 'ED-1',
        nominalDesignation: 'X20', nominalDiameterM: 0.02, pitchM: 0.0025, leadM: 0.0025,
        pitchDiameterM: 0.018, tensileStressAreaM2: 245e-6, stressSectionDiameterM: 0.017,
        ...REVIEW,
      }],
      materials: [{
        recordId: 'MAT-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', materialSpec: 'CONTROLLED MATERIAL', temperatureC: 200,
        referenceStressBasis: 'CONTROLLED REFERENCE', referenceStressPa: 500e6, ...REVIEW,
      }],
      frictionConditions: [{
        recordId: 'FRIC-GOV', recordState: 'QUALIFIED', useAuthority: 'ENGINEERING_SANDBOX',
        sourceId: 'SRC-GOV', conditionId: 'COND-X', finish: 'CONTROLLED', coating: 'NONE',
        lubricant: 'CONTROLLED-LUBE', reuseCondition: 'NEW', temperatureC: 25,
        frictionBasis: 'CONTROLLED TEST RANGE', nutFactorMin: 0.16, nutFactor: 0.18,
        nutFactorMax: 0.2, ...REVIEW,
      }],
      ...overrides,
    },
  });
}

function boltSelectors() {
  return {
    thread: { threadStandard: 'CONTROLLED THREAD', nominalDesignation: 'X20' },
    material: { materialSpec: 'CONTROLLED MATERIAL', temperatureC: 200 },
    frictionCondition: { conditionId: 'COND-X' },
  };
}

test('transcribed flange source requires traceable document provenance', () => {
  const candidate = createFlangeMasterStore({
    collections: { sources: [governedSource({ recordState: 'TRANSCRIBED', sourceDocument: '' })] },
  });
  const result = validateFlangeMasterStore(candidate);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /sourceDocument is required/i);
});

test('flange record custody cannot outrank its source maturity', () => {
  const candidate = governedFlangeStore({
    sources: [governedSource({ recordState: 'SOURCE_PENDING', useAuthority: 'NONE' })],
  });
  const result = validateFlangeMasterStore(candidate);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /custody exceeds source .* maturity/i);
});

test('qualified flange record requires independent review identity', () => {
  const record = { ...governedFlangeStore().collections.flangeRatings[0], reviewedBy: '' };
  const result = validateFlangeMasterStore(governedFlangeStore({ flangeRatings: [record] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /reviewedBy is required/i);
});

test('qualified flange custody requires an explicit gasket reaction diameter basis', () => {
  const record = {
    ...governedFlangeStore().collections.gasketGeometries[0],
    gasketReactionDiameterBasis: '',
  };
  const result = validateFlangeMasterStore(governedFlangeStore({ gasketGeometries: [record] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /gasketReactionDiameterBasis is required/i);
});

test('fully qualified flange records remain sandbox-only and non-authorizing', () => {
  const store = governedFlangeStore();
  assert.equal(validateFlangeMasterStore(store).ok, true);
  const resolved = resolveUg44MasterInputs(store, flangeSelectors());
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(resolved.resolverState, 'RESOLVED_NOT_AUTHORIZED');
  assert.equal(resolved.interpolationUsed, false);
  assert.equal(resolved.canUseForDesignAuthority, false);
});

test('transcribed bolt thread requires controlled geometry custody', () => {
  const thread = {
    ...governedBoltStore().collections.threads[0], recordState: 'TRANSCRIBED',
    reviewedBy: undefined, reviewDate: undefined, pitchDiameterM: undefined,
  };
  const candidate = governedBoltStore({
    sources: [governedSource({ recordState: 'TRANSCRIBED' })],
    threads: [thread], materials: [], frictionConditions: [],
  });
  const result = validateBoltMasterStore(candidate);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /pitchDiameterM must be positive finite/i);
});

test('bolt record custody cannot outrank its source maturity', () => {
  const candidate = governedBoltStore({
    sources: [governedSource({ recordState: 'INDEPENDENTLY_CHECKED' })],
  });
  const result = validateBoltMasterStore(candidate);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /custody exceeds source .* maturity/i);
});

test('qualified detailed friction custody rejects negative friction coefficients', () => {
  const detailed = {
    ...governedBoltStore().collections.frictionConditions[0],
    nutFactorMin: undefined, nutFactor: undefined, nutFactorMax: undefined,
    threadFrictionCoefficientMin: -0.01,
    threadFrictionCoefficient: 0.1,
    threadFrictionCoefficientMax: 0.15,
    bearingFrictionCoefficientMin: 0.08,
    bearingFrictionCoefficient: 0.1,
    bearingFrictionCoefficientMax: 0.12,
  };
  const result = validateBoltMasterStore(governedBoltStore({ frictionConditions: [detailed] }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /friction coefficients must be non-negative/i);
});

test('fully qualified bolt records remain exact-match sandbox data without preload defaults', () => {
  const store = governedBoltStore();
  assert.equal(validateBoltMasterStore(store).ok, true);
  const resolved = resolveBoltShortFormMasters(store, boltSelectors());
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  assert.equal(resolved.resolverState, 'RESOLVED_NOT_AUTHORIZED');
  assert.equal(resolved.interpolationUsed, false);
  assert.equal(resolved.preloadFractionResolved, false);
  assert.equal(resolved.canUseForDesignAuthority, false);
});
