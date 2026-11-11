import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SBC_WORKSPACE_KEY = '20260819-sbc-connection-authoring-1';
const SBC_TYPE3_KEY = '20260815-sbc-pf05-cache-1';
const AIV_KEY = '20260816-aiv-canvas-release-1';

function source(path) {
  return readFileSync(`${root}/${path}`, 'utf8');
}

const WORKSPACE_EDGES = Object.freeze([
  ['tabs/engineering-calculations-tab.js', `./vibration-integrity-tab.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-tab.js', `./vibration-integrity-user-data-shell.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-connection-model.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-workspace-model.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-workspace-view.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-ui-contract.js?v=${SBC_WORKSPACE_KEY}`],
  ['tabs/vibration-integrity-sbc-workspace-view.js', `./vibration-integrity-sbc-connection-view.js?v=${SBC_WORKSPACE_KEY}`],
]);

const TYPE3_EDGES = Object.freeze([
  ['tabs/vibration-integrity-user-data-shell.js', `../converters/vibration/sbc/type3-user-data.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-type3-controller.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-type3-state.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-view.js?v=${SBC_TYPE3_KEY}`],

  ['tabs/vibration-integrity-sbc-type3-controller.js', `../converters/vibration/sbc/type3-master-assisted-candidate.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-sbc-type3-controller.js', `../converters/vibration/sbc/type3-master-assisted-derivation.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-sbc-type3-controller.js', `./vibration-integrity-sbc-candidate-currentness.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-sbc-type3-controller.js', `./vibration-integrity-sbc-type3-state.js?v=${SBC_TYPE3_KEY}`],

  ['tabs/vibration-integrity-sbc-type3-state.js', `../converters/vibration/sbc/type3-user-data.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-sbc-type3-state.js', `./vibration-integrity-sbc-candidate-currentness.js?v=${SBC_TYPE3_KEY}`],

  ['converters/vibration/sbc/type3-master-assisted-candidate.js', `./type3-combination.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/sbc/type3-master-assisted-candidate.js', `./type3-master-assisted-derivation.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/sbc/type3-master-assisted-candidate.js', `./type3-user-data.js?v=${SBC_TYPE3_KEY}`],

  ['converters/vibration/sbc/type3-master-assisted-derivation.js', `./type3-user-data.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/sbc/type3-master-assisted-derivation.js', `./type3-noncurve-candidate-data.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/sbc/type3-user-data.js', `./type3-combination.js?v=${SBC_TYPE3_KEY}`],

  ['tabs/vibration-integrity-view.js', `./vibration-integrity-mechanisms.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-mechanisms.js', `../converters/vibration/sbc/facility.js?v=${SBC_TYPE3_KEY}`],
  ['tabs/vibration-integrity-mechanisms.js', `../converters/vibration/mechanisms/index.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/mechanisms/index.js', `./sbc.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/mechanisms/sbc.js', `../sbc/facility.js?v=${SBC_TYPE3_KEY}`],
  ['converters/vibration/sbc/facility.js', `./type3-user-data.js?v=${SBC_TYPE3_KEY}`],
]);

test('SBC connection authoring uses the current UI release identity', () => {
  for (const [path, expected] of WORKSPACE_EDGES) {
    assert.ok(source(path).includes(expected), `${path} must contain ${expected}`);
  }
});

test('unchanged Type-3 runtime descendants retain the frozen PF-005 identity', () => {
  for (const [path, expected] of TYPE3_EDGES) {
    assert.ok(source(path).includes(expected), `${path} must contain ${expected}`);
  }
});

test('shared Engineering Calculations entry preserves current AIV cache custody', () => {
  const engineering = source('tabs/engineering-calculations-tab.js');
  assert.ok(engineering.includes(`./vibration-aiv-qualification-tab.js?v=${AIV_KEY}`));
  assert.equal(engineering.includes('vibration-integrity-fit-placeholder-1'), false);
  assert.equal(engineering.includes('vibration-aiv-qualification-tab.js?v=aiv-qualification-2'), false);
});

test('SBC cache identities do not version untouched Mechanical dependencies', () => {
  const shell = source('tabs/vibration-integrity-user-data-shell.js');
  const matrix = source('tabs/vibration-integrity-mechanisms.js');
  assert.ok(shell.includes("from './vibration-integrity-mechanical-controller.js'"));
  assert.ok(shell.includes("from './vibration-integrity-mechanical-view.js'"));
  assert.ok(matrix.includes("from '../converters/vibration/mechanical/facility.js'"));
  assert.equal(shell.includes(`vibration-integrity-mechanical-controller.js?v=${SBC_WORKSPACE_KEY}`), false);
  assert.equal(matrix.includes(`vibration/mechanical/facility.js?v=${SBC_TYPE3_KEY}`), false);
});
