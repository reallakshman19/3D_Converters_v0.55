import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES,
  normalizeEngineeringCalculationAssessment,
} from '../converters/engineering-calculations/contracts.js';
import { createEngineeringCalculationEngine } from '../converters/engineering-calculations/engine.js';
import { buildEngineeringResultViewModel } from '../tabs/engineering-calculation-console-model.js';

function fixtureDefinition(assessment) {
  return Object.freeze({
    id: 'TEST.ASSESSMENT.OUTCOME',
    family: 'PIPE',
    name: 'Assessment outcome fixture',
    methodRevision: 'fixture-v1',
    authority: { calculationState: 'IMPLEMENTED', qualificationState: 'IMPLEMENTED', codeCompliance: false },
    applicability: { description: 'Test only.', limitations: [] },
    inputs: [],
    outputs: [],
    calculate() {
      return {
        ok: true,
        checks: [],
        assessment,
        qualification: { method: 'IMPLEMENTED', data: 'DRAFT', effective: 'DRAFT', designAuthority: false, reasons: [] },
      };
    },
  });
}

function calculateFixture(assessment) {
  const definition = fixtureDefinition(assessment);
  const registry = {
    get(id) { return id === definition.id ? definition : null; },
    list() { return [definition]; },
  };
  const engine = createEngineeringCalculationEngine({
    registry,
    implementationRevision: 'test-revision',
    clock: () => '2026-09-11T00:00:00.000Z',
  });
  return { definition, result: engine.calculate({ calculationId: definition.id, inputs: {} }) };
}

test('assessment normalizer preserves domain status while exposing a canonical decision outcome', () => {
  const assessment = normalizeEngineeringCalculationAssessment({
    status: 'ENGINEERING_REVIEW_PASS',
    pass: true,
    authority: 'ENGINEERING_REVIEW_ONLY',
  });

  assert.equal(assessment.status, 'ENGINEERING_REVIEW_PASS');
  assert.equal(assessment.outcome, 'PASS');
  assert.equal(assessment.disposition, 'ENGINEERING_REVIEW_PASS');
  assert.ok(ENGINEERING_CALCULATION_ASSESSMENT_OUTCOMES.includes(assessment.outcome));
});

test('workflow or trace states do not become engineering PASS without an explicit pass decision', () => {
  for (const status of ['TRACE_ONLY', 'SOURCE_PENDING', 'REFERENCE_BELOW_THRESHOLD', 'CALCULATED_REVIEW']) {
    const assessment = normalizeEngineeringCalculationAssessment({ status, pass: null });
    assert.equal(assessment.status, status);
    assert.equal(assessment.outcome, 'NOT_ASSESSED');
    assert.equal(assessment.disposition, status);
  }
});

test('explicit fail and indeterminate decisions retain canonical outcomes', () => {
  assert.equal(normalizeEngineeringCalculationAssessment({ status: 'REFERENCE_FAIL', pass: false }).outcome, 'FAIL');
  assert.equal(normalizeEngineeringCalculationAssessment({ status: 'INDETERMINATE' }).outcome, 'INDETERMINATE');
  assert.equal(normalizeEngineeringCalculationAssessment({ status: 'PASS' }).outcome, 'PASS');
});

test('central engine adds canonical outcome without rewriting legacy assessment status', () => {
  const { result } = calculateFixture({
    status: 'REFERENCE_BELOW_THRESHOLD',
    authority: 'WORKBOOK_REFERENCE_ONLY',
  });

  assert.equal(result.ok, true);
  assert.equal(result.assessment.status, 'REFERENCE_BELOW_THRESHOLD');
  assert.equal(result.assessment.outcome, 'NOT_ASSESSED');
  assert.equal(result.assessment.disposition, 'REFERENCE_BELOW_THRESHOLD');
  assert.equal(Object.isFrozen(result.assessment), true);
});

test('console renders canonical assessment outcome and keeps the domain disposition visible', () => {
  const { definition, result } = calculateFixture({
    status: 'REFERENCE_BELOW_THRESHOLD',
    authority: 'WORKBOOK_REFERENCE_ONLY',
  });
  const view = buildEngineeringResultViewModel(definition, result);

  assert.equal(view.execution.status, 'COMPLETED');
  assert.equal(view.assessment.status, 'NOT_ASSESSED');
  assert.equal(view.assessment.disposition, 'REFERENCE_BELOW_THRESHOLD');
});

test('console renders PASS when a legacy producer supplies an explicit positive pass decision', () => {
  const { definition, result } = calculateFixture({
    status: 'ENGINEERING_REVIEW_PASS',
    pass: true,
    authority: 'ENGINEERING_REVIEW_ONLY',
  });
  const view = buildEngineeringResultViewModel(definition, result);

  assert.equal(result.assessment.status, 'ENGINEERING_REVIEW_PASS');
  assert.equal(result.assessment.outcome, 'PASS');
  assert.equal(view.assessment.status, 'PASS');
  assert.equal(view.assessment.disposition, 'ENGINEERING_REVIEW_PASS');
});
