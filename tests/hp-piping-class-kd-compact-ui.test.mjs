import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ui = fs.readFileSync(path.join(repo, 'tabs/hp-piping-class-workbench-tab.js'), 'utf8');
const helper = fs.readFileSync(path.join(repo, 'tabs/hp-piping-class-kd-productivity.js'), 'utf8');

test('KD Review is engineering-first and keeps audit fields collapsed', () => {
  assert.match(ui, /Add all governed cycles/);
  assert.match(ui, /CORE Salt MPa/);
  assert.match(ui, /External Seq MPa/);
  assert.match(ui, /External N/);
  assert.match(ui, /Applied n/);
  assert.match(ui, /Ui=n\/N/);
  assert.match(ui, /<details class="hpwb-details">/);
  assert.match(ui, /Audit \/ calculation-basis details/);
  assert.match(ui, /Copy first-row basis to all cycles/);
});

test('compact productivity actions never implement KD320 arithmetic or promote authority', () => {
  assert.match(ui, /Native CORE KD320 remains blocked/);
  assert.match(ui, /CORE KD-3 · NOT QUALIFIED/);
  assert.match(ui, /DESIGN AUTHORITY · FALSE/);
  assert.doesNotMatch(helper, /equivalentAlternatingStressMpa\s*=/);
  assert.doesNotMatch(helper, /permissibleCycles\s*=/);
  assert.doesNotMatch(helper, /Math\.(exp|log|pow)/);
});

test('basis-copy warning explicitly excludes cycle engineering values', () => {
  assert.match(ui, /Cycle\/location\/Seq\/N values are never copied/);
  assert.match(helper, /rows\[index\]\.calculationBasis = clone\(source\)/);
});
