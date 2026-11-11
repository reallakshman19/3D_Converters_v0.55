import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIT_FACILITY_ENRICHMENT_PROPERTIES,
  buildVibrationFacilityFitPlan,
} from '../converters/vibration/facility/fit-plan.js';
import {
  FIT_FACILITY_NATURAL_FREQUENCY_CUSTODY_SCHEMA,
  resolveFitFacilityNaturalFrequencyCustody,
} from '../converters/vibration/facility/fit-frequency-custody.js';
import { VIBRATION_INTEGRITY_DATASET_SCHEMA } from '../converters/vibration/dataset/schema.js';

const P = FIT_FACILITY_ENRICHMENT_PROPERTIES;

function enrichmentKey(row) {
  return `${row.canonicalId}\u0000${row.caseId ?? ''}\u0000${row.property}`;
}

function index(rows) {
  return new Map(rows.map((row) => [enrichmentKey(row), row]));
}

function row(property, value, options = {}) {
  return {
    canonicalId: 'CAN-1',
    property,
    value,
    source: options.source ?? 'PROJECT-EVIDENCE',
    ...(options.caseId ? { caseId: options.caseId } : {}),
    ...(options.unit ? { unit: options.unit } : {}),
    ...(options.sourceRevision ? { sourceRevision: options.sourceRevision } : {}),
    ...(options.recordId ? { recordId: options.recordId } : {}),
    ...(options.status ? { status: options.status } : {}),
    ...(options.reviewer ? { reviewer: options.reviewer } : {}),
  };
}

function completeFrequency(value = 2, options = {}) {
  return row(P.NATURAL_FREQUENCY, value, {
    unit: 'Hz',
    source: 'VIBRATION-SURVEY-1',
    sourceRevision: 'REV-A',
    recordId: 'FN-001',
    status: 'CURRENT',
    ...options,
  });
}

function basisRows(caseId = 'NORMAL') {
  return [
    row(P.WALL_BASIS, 'AS_BUILT'),
    row(P.MAXIMUM_SPAN_BETWEEN_EFFECTIVE_SUPPORTS, 6.1, { unit: 'm' }),
    row(P.SPAN_DETERMINATION_METHOD, 'LINE_WALK_EFFECTIVE_SUPPORTS'),
    row(P.SUPPORT_EVIDENCE_STATUS, 'EFFECTIVE_SUPPORTS_CONFIRMED'),
    row(P.DENSITY_BASIS, 'ACTUAL', { caseId }),
    row(P.OPERATING_SCENARIO_COHERENT, true, { caseId }),
  ];
}

function baseRows() {
  return [
    row(P.ASSESSMENT_POINT, true),
    row(P.OUTSIDE_DIAMETER, 168.3, { unit: 'mm' }),
    row(P.WALL_THICKNESS, 7.11, { unit: 'mm' }),
    ...basisRows(),
  ];
}

function dataset(extra = []) {
  return {
    schema: VIBRATION_INTEGRITY_DATASET_SCHEMA,
    authority: 'DATA_ASSEMBLY_ONLY',
    engineeringAuthority: 'NONE',
    screeningAuthorized: false,
    exchangeIntegrityStatus: 'DECLARED_NOT_REVERIFIED',
    lines: [{ line: 'L-100', elementCanonicalIds: ['CAN-1'] }],
    unassignedElementCanonicalIds: [],
    operatingCases: [{
      line: 'L-100', caseId: 'NORMAL', phase: 'LIQUID', source: 'HMB-1',
      massFlow: { value: 100, unit: 'kg/s' },
      density: { value: 900, unit: 'kg/m3' },
    }],
    enrichment: [...baseRows(), ...extra],
  };
}

function planItem(extra = []) {
  return buildVibrationFacilityFitPlan(dataset(extra)).items[0];
}

test('VIB-M5-FN01: absence of natural frequency does not block the standard FIT request', () => {
  const result = planItem();
  assert.equal(result.status, 'READY', JSON.stringify(result));
  assert.equal(result.engineeringBasis.frequency.schema, FIT_FACILITY_NATURAL_FREQUENCY_CUSTODY_SCHEMA);
  assert.equal(result.engineeringBasis.frequency.state, 'NOT_PROVIDED');
  assert.equal(result.request.inputs.naturalFrequency, undefined);
});

test('VIB-M5-FN02: supplied natural frequency requires provenance identity before request creation', () => {
  const result = planItem([row(P.NATURAL_FREQUENCY, 2, {
    unit: 'Hz', source: 'USER-ENTRY', caseId: 'NORMAL',
  })]);
  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.request, null);
  assert.equal(result.engineeringBasis.frequency.state, 'INCOMPLETE');
  assert(result.engineeringBasis.frequency.missing.includes('naturalFrequency.sourceRevision'));
  assert(result.engineeringBasis.frequency.missing.includes('naturalFrequency.recordId'));
  assert(result.engineeringBasis.frequency.missing.includes('naturalFrequency.status'));
  assert(result.reasons.includes('NATURAL_FREQUENCY_PROVENANCE_INCOMPLETE'));
});

test('VIB-M5-FN03: non-positive supplied natural frequency fails at facility readiness', () => {
  for (const value of [0, -0.1]) {
    const result = planItem([completeFrequency(value, { caseId: 'NORMAL' })]);
    assert.equal(result.status, 'NOT_READY');
    assert.equal(result.request, null);
    assert(result.invalid.includes('naturalFrequency'));
    assert(result.reasons.includes('NATURAL_FREQUENCY_VALUE_INVALID'));
  }
});

test('VIB-M5-FN04: complete case-specific natural frequency is custodied and passed unchanged', () => {
  const result = planItem([completeFrequency(2.4, { caseId: 'NORMAL', reviewer: 'ENG-A' })]);
  assert.equal(result.status, 'READY', JSON.stringify(result));
  assert.equal(result.engineeringBasis.frequency.state, 'CUSTODIED');
  assert.equal(result.engineeringBasis.frequency.selection, 'CASE_SPECIFIC');
  assert.deepEqual(result.engineeringBasis.frequency.resolved, { value: 2.4, unit: 'Hz' });
  assert.equal(result.engineeringBasis.frequency.provenance.recordId, 'FN-001');
  assert.equal(result.engineeringBasis.frequency.provenance.reviewer, 'ENG-A');
  assert.equal(result.request.inputs.naturalFrequency, 2.4);
  assert.equal(result.request.inputUnits.naturalFrequency, 'Hz');
});

test('VIB-M5-FN05: complete global natural frequency is used only when case-specific evidence is absent', () => {
  const result = planItem([completeFrequency(2.1)]);
  assert.equal(result.status, 'READY', JSON.stringify(result));
  assert.equal(result.engineeringBasis.frequency.selection, 'GLOBAL');
  assert.equal(result.request.inputs.naturalFrequency, 2.1);
});

test('VIB-M5-FN06: incomplete case-specific evidence shadows a complete global value and fails closed', () => {
  const result = planItem([
    completeFrequency(2.1),
    row(P.NATURAL_FREQUENCY, 2.8, {
      unit: 'Hz', source: 'CASE-ENTRY', caseId: 'NORMAL',
    }),
  ]);
  assert.equal(result.status, 'NOT_READY');
  assert.equal(result.request, null);
  assert.equal(result.engineeringBasis.frequency.selection, 'CASE_SPECIFIC');
  assert.equal(result.engineeringBasis.frequency.observed.value, 2.8);
  assert.equal(result.engineeringBasis.frequency.resolved, null);
});

test('VIB-M5-FN07: reviewer is optional but retained when provided', () => {
  const withoutReviewer = resolveFitFacilityNaturalFrequencyCustody({
    index: index([completeFrequency(2.3)]), canonicalId: 'CAN-1', caseId: 'NORMAL',
  });
  assert.equal(withoutReviewer.state, 'CUSTODIED');
  assert.equal(withoutReviewer.provenance.reviewer, null);

  const withReviewer = resolveFitFacilityNaturalFrequencyCustody({
    index: index([completeFrequency(2.3, { reviewer: 'ENG-B' })]), canonicalId: 'CAN-1', caseId: 'NORMAL',
  });
  assert.equal(withReviewer.provenance.reviewer, 'ENG-B');
});

test('VIB-M5-FN08: frequency custody is provenance-only and creates no numerical/design authority', () => {
  const result = resolveFitFacilityNaturalFrequencyCustody({
    index: index([completeFrequency(2.3)]), canonicalId: 'CAN-1', caseId: 'NORMAL',
  });
  assert.deepEqual(result.authority, {
    authority: 'FREQUENCY_PROVENANCE_CUSTODY_ONLY',
    numericalMethodAuthority: false,
    engineeringAuthority: 'NONE',
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
  });
});
