import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEngineeringResultViewModel,
  engineeringResultLabel,
} from '../tabs/engineering-calculation-console-model.js';
import { renderResults } from '../tabs/engineering-calculation-console-sections.js';

const definition = {
  id: 'TEST.ASSESSMENT.PRESENTATION',
  family: 'TEST',
  name: 'Assessment presentation fixture',
  methodRevision: '1.0.0',
  authority: { qualificationState: 'BENCHMARK_ONLY', codeCompliance: false },
  outputs: [
    { key: 'value', label: 'Calculated value', type: 'number', quantity: 'dimensionless', canonicalUnit: null },
  ],
};

test('canonical NOT_ASSESSED remains internal while the legacy result label is human readable', () => {
  const result = {
    ok: true,
    outputs: { value: 1 },
    checks: [],
    assessment: {
      outcome: 'NOT_ASSESSED',
      disposition: 'TRACE_ONLY',
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
  };

  const view = buildEngineeringResultViewModel(definition, result);
  assert.equal(view.assessment.status, 'NOT_ASSESSED');
  assert.equal(view.assessment.disposition, 'TRACE_ONLY');
  assert.equal(engineeringResultLabel(result), 'NOT ASSESSED');
});

test('NOT_ASSESSED rendering distinguishes completed execution from engineering assessment', () => {
  const html = renderResults(definition, {
    ok: true,
    outputs: { value: 1 },
    checks: [],
    assessment: {
      outcome: 'NOT_ASSESSED',
      disposition: 'CALCULATED_REVIEW',
      governingEligible: false,
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
    execution: { executionId: 'exec-unassessed' },
  }, null);

  assert.match(html, /No top-level acceptance decision/);
  assert.match(html, /Numerical execution is not an engineering PASS/);
  assert.match(html, /<small>Assessment outcome<\/small><strong>NOT ASSESSED<\/strong>/);
  assert.match(html, /<small>Disposition<\/small><strong>CALCULATED_REVIEW<\/strong>/);
  assert.match(html, /<small>Execution<\/small><strong>COMPLETED<\/strong>/);
});

test('INDETERMINATE rendering remains distinct from FAIL and execution failure', () => {
  const html = renderResults(definition, {
    ok: true,
    outputs: { value: 1 },
    checks: [],
    assessment: {
      outcome: 'INDETERMINATE',
      disposition: 'INSUFFICIENT_BASIS',
      governingEligible: false,
      designAuthority: false,
      codeCompliance: false,
    },
    qualification: { effective: 'BENCHMARK_ONLY', designAuthority: false },
    execution: { executionId: 'exec-indeterminate' },
  }, null);

  assert.match(html, /Assessment indeterminate/);
  assert.match(html, /INSUFFICIENT_BASIS/);
  assert.match(html, /<small>Assessment outcome<\/small><strong>INDETERMINATE<\/strong>/);
  assert.match(html, /<small>Execution<\/small><strong>COMPLETED<\/strong>/);
  assert.doesNotMatch(html, /Assessment failed/);
});
