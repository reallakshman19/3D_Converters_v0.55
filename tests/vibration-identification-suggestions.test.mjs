import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_T1_SUGGESTION_RULES,
  collectVibrationT1Suggestions,
  suggestVibrationMechanismsForScope,
} from '../converters/vibration/mechanisms/identification-suggestions.js';
import { createVibrationMechanismIdentificationBundle } from '../converters/vibration/mechanisms/identification-producer.js';

const SCOPE = Object.freeze({ line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1' });

function fact(property, overrides = {}) {
  return {
    canonicalId: 'CAN-1', line: 'L-100', caseId: 'NORMAL', property,
    value: true, status: 'VERIFIED', source: 'P&ID-100', sourceRevision: 'C',
    recordId: `REC-${property}`, reviewer: 'engineer-a', ...overrides,
  };
}

test('six high-confidence rules are explicit facts rather than inferred free-text applicability', () => {
  assert.equal(VIBRATION_T1_SUGGESTION_RULES.length, 6);
  assert.deepEqual(VIBRATION_T1_SUGGESTION_RULES.map((item) => item.mechanismId), [
    'reciprocatingPulsation', 'mechanicalExcitation', 'deadlegPulsation',
    'aiv', 'smallBoreConnections', 'thermowells',
  ]);
  assert.equal(VIBRATION_T1_SUGGESTION_RULES.every((item) => item.requiredValue === true), true);
  assert.equal(VIBRATION_T1_SUGGESTION_RULES.every((item) => item.requiredStatus === 'VERIFIED'), true);
});

test('verified exact-scope facts produce suggestion-only records with no identification authority', () => {
  const result = suggestVibrationMechanismsForScope({
    scope: SCOPE,
    enrichment: [
      fact('T1_RECIP_PD_EQUIPMENT_PRESENT'),
      fact('T1_SMALL_BORE_CONNECTION_PRESENT'),
    ],
  });
  assert.deepEqual(result.suggestions.map((item) => item.mechanismId), [
    'reciprocatingPulsation', 'smallBoreConnections',
  ]);
  for (const suggestion of result.suggestions) {
    assert.equal(suggestion.disposition, 'PENDING_ENGINEER_REVIEW');
    assert.equal(suggestion.authority.automaticApplicabilityRules, false);
    assert.equal(suggestion.authority.createsIdentificationEvidence, false);
    assert.equal(suggestion.authority.countsTowardCompleteness, false);
    assert.equal(suggestion.authority.screeningAuthority, 'NOT_AUTHORIZED');
    assert.equal(suggestion.authority.designAuthority, false);
  }
});

test('unverified, false, wrong-scope and renamed facts do not suggest mechanisms', () => {
  const rows = [
    fact('T1_DEADLEG_PRESENT', { status: 'DRAFT' }),
    fact('T1_SMALL_BORE_CONNECTION_PRESENT', { value: false }),
    fact('T1_THERMOWELL_OR_INTRUSIVE_ELEMENT_PRESENT', { canonicalId: 'OTHER' }),
    fact('DEADLEG_PRESENT'),
  ];
  assert.deepEqual(suggestVibrationMechanismsForScope({ scope: SCOPE, enrichment: rows }).suggestions, []);
});

test('suggestions cannot be passed as identification evidence contracts', () => {
  const suggestion = suggestVibrationMechanismsForScope({
    scope: SCOPE, enrichment: [fact('T1_ROTATING_EQUIPMENT_CONNECTION_PRESENT')],
  }).suggestions[0];
  assert.throws(
    () => createVibrationMechanismIdentificationBundle({ identifications: [suggestion] }),
    /disposition must be one of REQUIRED, NOT_APPLICABLE, UNRESOLVED/u,
  );
});

test('multi-scope collector preserves exact identity and deterministic ordering', () => {
  const other = { line: 'L-200', caseId: 'STARTUP', canonicalId: 'CAN-2' };
  const suggestions = collectVibrationT1Suggestions({
    scopes: [other, SCOPE],
    enrichment: [
      fact('T1_PRESSURE_REDUCING_GAS_SOURCE_PRESENT'),
      fact('T1_THERMOWELL_OR_INTRUSIVE_ELEMENT_PRESENT', {
        line: 'L-200', caseId: 'STARTUP', canonicalId: 'CAN-2',
      }),
    ],
  });
  assert.equal(suggestions.length, 2);
  assert.deepEqual(new Set(suggestions.map((item) => item.scope.line)), new Set(['L-100', 'L-200']));
  assert.equal(Object.isFrozen(suggestions), true);
});
