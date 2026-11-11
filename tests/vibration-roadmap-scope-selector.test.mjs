import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildVibrationRoadmapScopeChoices,
  formatVibrationRoadmapScopeChoiceLabel,
  isGovernedVibrationRoadmapScopeChoices,
  resolveVibrationRoadmapScopeSelection,
} from '../tabs/vibration-roadmap-scope-selection.js';

function rows() {
  return [
    { rowKey: 'ROW-1', line: '10-P-100', caseId: 'NORMAL', canonicalId: 'LINE-A' },
    { rowKey: 'ROW-2', line: '10-P-100', caseId: 'STARTUP', canonicalId: 'LINE-A' },
  ];
}

test('scope choices preserve exact current register identity without creating case identity', () => {
  const value = buildVibrationRoadmapScopeChoices(rows(), 'ROW-1');
  assert.equal(value.state, 'AVAILABLE');
  assert.equal(value.selectedRowKey, 'ROW-1');
  assert.deepEqual(value.choices.map((choice) => choice.rowKey), ['ROW-1', 'ROW-2']);
  assert.equal(value.choices[1].caseId, 'STARTUP');
  assert.equal(value.authority.createsCaseIdentity, false);
  assert.equal(value.authority.persistenceAuthority, 'NONE');
  assert.equal(isGovernedVibrationRoadmapScopeChoices(value), true);
});

test('duplicate row keys fail closed instead of selecting an ambiguous case', () => {
  const value = buildVibrationRoadmapScopeChoices([...rows(), { ...rows()[1], caseId: 'ALT' }], 'ROW-1');
  assert.equal(value.state, 'AMBIGUOUS_ROW_KEY');
  assert.deepEqual(value.choices, []);
  assert.equal(resolveVibrationRoadmapScopeSelection(value, 'ROW-1'), null);
});

test('missing selected row fails closed', () => {
  const value = buildVibrationRoadmapScopeChoices(rows(), 'ROW-X');
  assert.equal(value.state, 'SELECTED_ROW_UNAVAILABLE');
  assert.deepEqual(value.choices, []);
});

test('selection accepts only governed exact row keys', () => {
  const value = buildVibrationRoadmapScopeChoices(rows(), 'ROW-1');
  assert.equal(resolveVibrationRoadmapScopeSelection(value, 'ROW-2')?.caseId, 'STARTUP');
  assert.equal(resolveVibrationRoadmapScopeSelection(value, 'ROW-X'), null);
  assert.equal(resolveVibrationRoadmapScopeSelection({ ...value, authority: {} }, 'ROW-2'), null);
});

test('forged malformed choices and selected-key mismatch fail closed', () => {
  const value = buildVibrationRoadmapScopeChoices(rows(), 'ROW-1');
  assert.equal(isGovernedVibrationRoadmapScopeChoices({
    ...value, choices: [{ ...value.choices[0], rowKey: ' ROW-1' }, value.choices[1]],
  }), false);
  assert.equal(isGovernedVibrationRoadmapScopeChoices({ ...value, selectedRowKey: 'ROW-X' }), false);
  assert.equal(isGovernedVibrationRoadmapScopeChoices({
    ...value, authority: { ...value.authority, identitySource: 'FORGED' },
  }), false);
});

test('invalid register rows are omitted rather than becoming synthetic scope identity', () => {
  const value = buildVibrationRoadmapScopeChoices([
    ...rows(),
    { rowKey: '', line: 'X', caseId: 'NORMAL', canonicalId: 'X' },
    { rowKey: 'ROW-3', line: '', caseId: 'NORMAL', canonicalId: 'X' },
    { rowKey: 'ROW-4', line: 'X', caseId: 'NORMAL', canonicalId: '' },
  ], 'ROW-1');
  assert.deepEqual(value.choices.map((choice) => choice.rowKey), ['ROW-1', 'ROW-2']);
});

test('scope labels keep line case and canonical identity visible', () => {
  assert.equal(formatVibrationRoadmapScopeChoiceLabel(rows()[0]), '10-P-100 · NORMAL · LINE-A');
  assert.equal(
    formatVibrationRoadmapScopeChoiceLabel({ line: '10-P-100', caseId: null, canonicalId: 'LINE-A' }),
    '10-P-100 · No case ID · LINE-A',
  );
});
