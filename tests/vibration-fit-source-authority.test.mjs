import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIT_METHOD_SOURCE,
  FIT_METHOD_SOURCE_BASIS,
  FIT_REFERENCE_AUTHORITY,
  FIT_REFERENCE_LIMITS,
  FIT_SOURCE_BASIS_EVIDENCE,
  FIT_WORKBOOK_REFERENCE_AUTHORITY,
  FIT_WORKBOOK_SOURCE,
  calculateFit,
} from '../converters/vibration/fit/index.js';

const RETAINED_GAS_REFERENCE_INPUT = Object.freeze({
  phase: 'GAS',
  outsideDiameterM: 0.1683,
  wallThicknessM: 0.0219456,
  insideDiameterM: 0.1243838,
  maximumUnsupportedSpanM: 4,
  densityKgM3: 5,
  massFlowKgS: 20000 / 3600,
  gasDynamicViscosityPaS: 0.00002,
});

test('FIT source basis makes EI T2.2 governing and workbook migration evidence only', () => {
  assert.equal(FIT_SOURCE_BASIS_EVIDENCE.schema, 'FitSourceBasisEvidence.v1');
  assert.equal(FIT_SOURCE_BASIS_EVIDENCE.methodRevision, 'ei-aviff2-fit-screening-v1');
  assert.equal(FIT_REFERENCE_AUTHORITY, 'CONTROLLED_EI_T2_2_SCREENING_REFERENCE');
  assert.equal(FIT_WORKBOOK_REFERENCE_AUTHORITY, 'WORKBOOK_REFERENCE_ONLY');

  assert.equal(FIT_METHOD_SOURCE.authority, 'GOVERNING_METHOD_SOURCE');
  assert.equal(FIT_METHOD_SOURCE.repository, 'reallaksh19/Common');
  assert.equal(FIT_METHOD_SOURCE.path, 'EI - AVIFF Guidelines 2nd Edition.pdf');
  assert.equal(FIT_METHOD_SOURCE.gitBlob, '9d3eccc56429411e17c07a579bdebbd13cb0bdc5');
  assert.match(FIT_METHOD_SOURCE.locator, /T2\.2/u);

  assert.equal(FIT_WORKBOOK_SOURCE.authority, 'WORKBOOK_REFERENCE_ONLY');
  assert.equal(FIT_WORKBOOK_SOURCE.role, 'MIGRATION_PARITY_EVIDENCE_ONLY');
  assert.equal(FIT_SOURCE_BASIS_EVIDENCE.benchmarkBasis.retainedWorkbookRole, 'MIGRATION_PARITY_EVIDENCE_ONLY');
  assert.equal(FIT_SOURCE_BASIS_EVIDENCE.authority.screeningAuthority, 'AUTHORIZED_BOUNDED');
  assert.equal(FIT_SOURCE_BASIS_EVIDENCE.authority.designAuthority, false);
});

test('official EI errata custody is explicit and does not invent a FIT T2.2 correction', () => {
  assert.equal(FIT_METHOD_SOURCE_BASIS.officialErrata.status, 'REVIEWED_NOT_APPLICABLE_TO_FIT_T2_2');
  assert.deepEqual(
    FIT_METHOD_SOURCE_BASIS.officialErrata.corrections.map((item) => item.page),
    [61, 68],
  );
  assert.equal(
    FIT_METHOD_SOURCE_BASIS.officialErrata.corrections.every((item) => /NOT_FIT_T2_2/u.test(item.disposition)),
    true,
  );
});

test('runtime FIT result publishes method source first and workbook as separate parity evidence', () => {
  const result = calculateFit(RETAINED_GAS_REFERENCE_INPUT);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.authority, 'CONTROLLED_EI_T2_2_SCREENING_REFERENCE');
  assert.equal(result.qualification.method, 'SCREENING');
  assert.equal(result.qualification.data, 'SCREENING');
  assert.equal(result.qualification.designAuthority, false);
  assert.equal(result.provenance.source.authority, 'GOVERNING_METHOD_SOURCE');
  assert.equal(result.provenance.methodSourceBasis.source.gitBlob, FIT_METHOD_SOURCE.gitBlob);
  assert.equal(result.provenance.workbookReference.authority, 'WORKBOOK_REFERENCE_ONLY');
  assert.equal(result.provenance.workbookReference.role, 'MIGRATION_PARITY_EVIDENCE_ONLY');
  assert.deepEqual(result.evidence.equationIds, [
    'FIT-EQ-001', 'FIT-EQ-002', 'FIT-EQ-003', 'FIT-EQ-004', 'FIT-EQ-005',
    'FIT-EQ-006', 'FIT-EQ-007', 'FIT-EQ-008', 'FIT-EQ-009', 'FIT-EQ-010',
    'FIT-EQ-011', 'FIT-EQ-012', 'FIT-EQ-013',
  ]);
});

test('source-authority change preserves representative numerical output and bounded limits', () => {
  const result = calculateFit(RETAINED_GAS_REFERENCE_INPUT);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.ok(Math.abs(result.standard.correlation.fv - 96734.96621707715) <= 1e-8);
  assert.ok(Math.abs(result.standard.lof - 0.06111973374777248) <= 1e-12);
  assert.deepEqual(FIT_REFERENCE_LIMITS, {
    minOutsideDiameterMm: 60,
    smallFamilyMaxOutsideDiameterMm: 219.1,
    largeFamilyMinOutsideDiameterMm: 273,
    maxOutsideDiameterMm: 762,
    advancedNaturalFrequencyMinHz: 1,
    advancedNaturalFrequencyMinInclusive: false,
    advancedNaturalFrequencyMaxHz: 3,
    referenceLofThreshold: 1,
  });
});
