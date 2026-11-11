import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENGINEERING_CALCULATION_CHECK_STATUSES,
  normalizeEngineeringCalculationCheck,
} from '../converters/engineering-calculations/contracts.js';
import { createEngineeringCalculationEngine } from '../converters/engineering-calculations/engine.js';

const REQUIRED_CHECK_KEYS = Object.freeze([
  'id', 'label', 'actual', 'allowable', 'comparator', 'utilization', 'status', 'authority', 'basis',
]);

function assertCanonicalCheck(check) {
  for (const key of REQUIRED_CHECK_KEYS) assert.ok(Object.hasOwn(check, key), `missing check.${key}`);
  assert.ok(ENGINEERING_CALCULATION_CHECK_STATUSES.includes(check.status), `invalid check.status ${check.status}`);
}

test('check normalizer maps legacy fields and aliases to the frozen v1 check vocabulary', () => {
  const failed = normalizeEngineeringCalculationCheck({
    id: 'LEGACY.FAIL',
    satisfied: false,
    designAuthority: false,
    utilization: 1.2,
  });
  assertCanonicalCheck(failed);
  assert.equal(failed.status, 'FAIL');
  assert.equal(failed.authority, 'NON_DESIGN');
  assert.equal(failed.label, 'LEGACY.FAIL');

  const unevaluated = normalizeEngineeringCalculationCheck({
    id: 'LEGACY.NOT_CHECKED',
    status: 'NOT_CHECKED',
    authority: 'REPOSITORY_QA_CROSSCHECK_ONLY',
  });
  assertCanonicalCheck(unevaluated);
  assert.equal(unevaluated.status, 'NOT_EVALUATED');
});

test('central engine never exposes a non-canonical legacy check envelope', () => {
  const definition = Object.freeze({
    id: 'TEST.LEGACY.CHECK',
    family: 'PIPE',
    name: 'Legacy check fixture',
    methodRevision: 'fixture-v1',
    authority: { calculationState: 'IMPLEMENTED', qualificationState: 'IMPLEMENTED', codeCompliance: false },
    applicability: { description: 'Test only.', limitations: [] },
    inputs: [],
    outputs: [],
    calculate() {
      return {
        ok: true,
        checks: [
          { id: 'LEGACY.BOOLEAN.FAIL', satisfied: false, designAuthority: false, utilization: 1.1 },
          { id: 'LEGACY.NOT_CHECKED', status: 'NOT_CHECKED', authority: 'QA_ONLY' },
        ],
        assessment: null,
      };
    },
  });
  const registry = {
    get(id) { return id === definition.id ? definition : null; },
    list() { return [definition]; },
  };
  const engine = createEngineeringCalculationEngine({
    registry,
    implementationRevision: 'test-revision',
    clock: () => '2026-09-11T00:00:00.000Z',
  });

  const result = engine.calculate({ calculationId: definition.id, inputs: {} });
  assert.equal(result.ok, true);
  assert.equal(result.checks.length, 2);
  for (const check of result.checks) assertCanonicalCheck(check);
  assert.equal(result.checks[0].status, 'FAIL');
  assert.equal(result.checks[0].authority, 'NON_DESIGN');
  assert.equal(result.checks[1].status, 'NOT_EVALUATED');
  assert.equal(result.checks[1].authority, 'QA_ONLY');
  assert.equal(Object.isFrozen(result.checks[0]), true);
});
