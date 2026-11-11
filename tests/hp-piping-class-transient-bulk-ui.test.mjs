import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../tabs/engineering-workspace-tab.js', import.meta.url), 'utf8');
const enhancer = await readFile(new URL('../tabs/hp-piping-class-transient-bulk-enhancer.js', import.meta.url), 'utf8');
const input = await readFile(new URL('../tabs/hp-piping-class-transient-bulk-input.js', import.meta.url), 'utf8');

test('active HP route still composes the product/KD workbench and adds transient bulk enhancer', () => {
  assert.match(route, /hp-piping-class-product-bulk-workbench-tab\.js/);
  assert.match(route, /hp-piping-class-transient-bulk-enhancer\.js/);
  assert.match(route, /hp-piping-class-kd-bulk-workbench-tab\.js/);
  assert.match(route, /installHpPipingClassTransientBulkEnhancer/);
  assert.match(route, /destroyTransientBulk/);
  assert.match(route, /destroyWorkbench/);
});

test('transient bulk UI is injected only into Pressure Cycles', () => {
  assert.match(enhancer, /Pressure Cycles/);
  assert.match(enhancer, /Operating states/);
  assert.match(enhancer, /data-hpwb-transient-editor/);
  assert.match(enhancer, /data-hpwb-transient-states/);
  assert.match(enhancer, /data-hpwb-transient-cycles/);
  assert.match(enhancer, /Validate spectrum/);
  assert.match(enhancer, /Apply \+ recalculate/);
});

test('apply path reuses existing JSON import controller and review calculation action', () => {
  assert.match(enhancer, /serializeHpPipingClassWorkspaceProject/);
  assert.match(enhancer, /new DataTransfer\(\)/);
  assert.match(enhancer, /data-hpwb-file/);
  assert.ok(enhancer.includes('[data-hpwb-action="calculate"]'));
  assert.match(enhancer, /waitForImportedProject/);
});

test('UI explains that Seq/N is neither inferred nor silently reused after transient drift', () => {
  assert.match(enhancer, /No Seq, N or KD-3 engineering quantity is inferred here/);
  assert.match(enhancer, /cycle ID, from-state, to-state and the referenced state pressure\/material\/structural temperatures remain exactly unchanged/);
  assert.match(enhancer, /cycle\/state-pair \+ state-value custody/);
  assert.match(enhancer, /Stale external rows removed/);
});

test('bulk contract owns state/cycle fields but not design pressure or KD values', () => {
  for (const token of [
    'state_id', 'pressure_mpa', 'material_temperature_c', 'structural_temperature_c',
    'cycle_id', 'from_state_id', 'to_state_id', 'total_cycles', 'cycles_per_year', 'category', 'provenance_id',
  ]) assert.match(input, new RegExp(token));
  for (const forbidden of ['design_pressure_mpa', 'seq_mpa', 'permissible_cycles', 'user_salt_mpa']) assert.doesNotMatch(input, new RegExp(forbidden));
});

test('bulk helper contains no Chapter IX pressure or fatigue engineering equation', () => {
  assert.doesNotMatch(input, /Math\.exp\(/);
  assert.doesNotMatch(input, /Math\.log\(/);
  assert.doesNotMatch(input, /calculateChapterIx/);
  assert.doesNotMatch(input, /equivalentAlternatingStressMpa\s*=/);
});
