import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const KEY = '20260819-sbc-connection-authoring-1';
const TYPE3_KEY = '20260815-sbc-pf05-cache-1';

function source(path) {
  return readFileSync(`${root}/${path}`, 'utf8');
}

const EDGES = Object.freeze([
  ['index.html', `./main-rhbg-fitguard.js?v=${KEY}`],
  ['main-rhbg-fitguard.js', `./core/app.js?v=${KEY}`],
  ['core/app.js', `./engineering-tabs-extension.js?v=${KEY}`],
  ['core/engineering-tabs-extension.js', `../tabs/engineering-workspace-tab.js?v=${KEY}`],
  ['tabs/engineering-workspace-tab.js', `./engineering-calculations-tab.js?v=${KEY}`],
  ['tabs/engineering-calculations-tab.js', `./vibration-integrity-tab.js?v=${KEY}`],
  ['tabs/vibration-integrity-tab.js', `./vibration-integrity-user-data-shell.js?v=${KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-connection-model.js?v=${KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-workspace-model.js?v=${KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-sbc-workspace-view.js?v=${KEY}`],
  ['tabs/vibration-integrity-user-data-shell.js', `./vibration-integrity-ui-contract.js?v=${KEY}`],
  ['tabs/vibration-integrity-sbc-workspace-view.js', `./vibration-integrity-sbc-workspace-model.js?v=${KEY}`],
  ['tabs/vibration-integrity-sbc-workspace-view.js', `./vibration-integrity-sbc-connection-view.js?v=${KEY}`],
  ['tabs/vibration-integrity-sbc-connection-view.js', `./vibration-integrity-sbc-connection-model.js?v=${KEY}`],
]);

test('startup through SBC connection authoring uses one current UI release identity', () => {
  for (const [path, expected] of EDGES) {
    assert.ok(source(path).includes(expected), `${path} must contain ${expected}`);
  }
});

test('connection authoring release does not silently re-version qualified Type-3 descendants', () => {
  const shell = source('tabs/vibration-integrity-user-data-shell.js');
  const workspaceView = source('tabs/vibration-integrity-sbc-workspace-view.js');
  assert.ok(shell.includes(`type3-user-data.js?v=${TYPE3_KEY}`));
  assert.ok(shell.includes(`vibration-integrity-sbc-type3-controller.js?v=${TYPE3_KEY}`));
  assert.ok(shell.includes(`vibration-integrity-sbc-type3-state.js?v=${TYPE3_KEY}`));
  assert.ok(workspaceView.includes(`vibration-integrity-sbc-type3-view.js?v=${TYPE3_KEY}`));
  assert.equal(shell.includes(`type3-user-data.js?v=${KEY}`), false);
});
