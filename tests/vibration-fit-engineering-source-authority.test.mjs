import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateEngineering } from '../converters/engineering-calculations/index.js';

function d4ProducedWaterRequest(qualificationMode) {
  return {
    calculationId: 'VIB.FIV.FLOW_TURBULENCE',
    inputs: {
      phase: 'LIQUID',
      outsideDiameter: 273,
      wallThickness: 9.271,
      maximumUnsupportedSpan: 18,
      density: 988,
      fluidVelocity: 2.9,
    },
    inputUnits: {
      outsideDiameter: 'mm',
      wallThickness: 'mm',
      maximumUnsupportedSpan: 'm',
      density: 'kg/m3',
      fluidVelocity: 'm/s',
    },
    options: { qualificationMode, includeEvidence: true },
  };
}

function sourceAssertions(result) {
  assert.equal(result.provenance.methodSource.authority, 'GOVERNING_METHOD_SOURCE');
  assert.equal(result.provenance.methodSource.repository, 'reallaksh19/Common');
  assert.equal(result.provenance.methodSource.gitBlob, '9d3eccc56429411e17c07a579bdebbd13cb0bdc5');
  assert.equal(result.provenance.sourceWorkbook.authority, 'WORKBOOK_REFERENCE_ONLY');
  assert.equal(result.provenance.sourceWorkbook.role, 'MIGRATION_PARITY_EVIDENCE_ONLY');
  assert.equal(result.evidence.methodSource.gitBlob, result.provenance.methodSource.gitBlob);
  assert.equal(result.evidence.sourceWorkbook.gitBlob, result.provenance.sourceWorkbook.gitBlob);
}

test('screening execution publishes EI T2.2 method source and bounded screening authority', () => {
  const result = calculateEngineering(d4ProducedWaterRequest('screening'));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.qualification.effective, 'SCREENING');
  assert.equal(result.provenance.engineeringAuthority, 'SCREENING');
  assert.equal(result.assessment.screeningAuthority, 'AUTHORIZED_BOUNDED');
  assert.equal(result.assessment.designAuthority, false);
  sourceAssertions(result);
});

test('benchmark replay uses the same EI method source but remains non-authorizing', () => {
  const result = calculateEngineering(d4ProducedWaterRequest('benchmark'));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.qualification.effective, 'BENCHMARK_ONLY');
  assert.equal(result.provenance.engineeringAuthority, 'WORKBOOK_REFERENCE_ONLY');
  assert.equal(result.assessment.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(result.assessment.designAuthority, false);
  sourceAssertions(result);
});

test('screening and benchmark replay remain numerically identical for the controlled D4 vector', () => {
  const screening = calculateEngineering(d4ProducedWaterRequest('screening'));
  const benchmark = calculateEngineering(d4ProducedWaterRequest('benchmark'));
  assert.equal(screening.ok, true, JSON.stringify(screening));
  assert.equal(benchmark.ok, true, JSON.stringify(benchmark));
  assert.deepEqual(screening.outputs, benchmark.outputs);
  assert.ok(Math.abs(screening.outputs.standardLof - 3.151946898828706) <= 1e-12);
  assert.ok(Math.abs(screening.outputs.standardFv - 2636.1738527662806) <= 1e-9);
});
