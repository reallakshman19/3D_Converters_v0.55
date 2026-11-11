import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('canvas presentation failure is contained without changing engineering authority', () => {
  const workspace = readFileSync(new URL('../tabs/vibration-aiv-qualification-tab.js', import.meta.url), 'utf8');
  assert.match(workspace, /try \{ canvasController\.sync\(\); \} catch \(error\) \{ showCanvasError\(state, container, error\); \}/u);
  const actions = readFileSync(new URL('../tabs/vibration-aiv-workspace-actions.js', import.meta.url), 'utf8');
  assert.match(actions, /Canvas unavailable:/u);
  assert.match(actions, /Engineering tables and screening controls remain authoritative and usable/u);
  assert.match(actions, /banner\.dataset\.aivCanvasError = 'true'/u);
});

test('AIV workspace loader uses the cache-distinct PF-01 module token', () => {
  const consoleTab = readFileSync(new URL('../tabs/engineering-calculations-tab.js', import.meta.url), 'utf8');
  assert.match(consoleTab, /vibration-aiv-qualification-tab\.js\?v=20260820-aiv-facility-scenario-1/u);
  assert.doesNotMatch(consoleTab, /vibration-aiv-qualification-tab\.js\?v=aiv-qualification-1/u);
});
