import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(ROOT, 'tabs/engineering-calculations-tab.js'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'tabs/vibration-roadmap-panel.css'), 'utf8');

test('engineering calculations tab mounts and destroys roadmap controller', () => {
  assert.match(source, /createVibrationRoadmapController/);
  assert.match(source, /roadmapController\.render\(\{ definition, state \}\)/);
  assert.match(source, /roadmapController\.destroy\(\)/);
});
test('roadmap uses existing calculation click seam rather than a second router', () => {
  assert.match(source, /event\.target\.closest\('\[data-calc-id\]'\)/);
  assert.doesNotMatch(source, /roadmap.*calculateEngineering\(/i);
});
test('roadmap stylesheet is separately loaded and provides an adjustable desktop third column', () => {
  assert.match(source, /vibration-roadmap-panel\.css/);
  assert.match(css, /engineering-console-layout\.has-vibration-roadmap\{grid-template-columns:[^}]*1fr[^}]*--vibration-roadmap-width/);
  assert.match(css, /vibration-roadmap-collapsed[^}]*44px/);
});
