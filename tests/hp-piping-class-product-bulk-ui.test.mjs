import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { HP_PIPING_CLASS_PRODUCT_BULK_HEADERS } from '../tabs/hp-piping-class-product-bulk-input.js';

const wrapper = await readFile(new URL('../tabs/hp-piping-class-product-bulk-workbench-tab.js', import.meta.url), 'utf8');
const route = await readFile(new URL('../tabs/engineering-workspace-tab.js', import.meta.url), 'utf8');

const expectedHeaders = [
  'product_id',
  'nominal_size',
  'od_mm',
  'allowable_stress_mpa',
  'nominal_wall_mm',
  'minus_tolerance_pct',
  'internal_allowance_mm',
  'external_allowance_mm',
  'fatigue_wall_basis',
  'measured_current_wall_mm',
  'future_internal_loss_mm',
  'future_external_loss_mm',
];

test('active HP route uses the product-bulk wrapper over the existing KD/result workbench', () => {
  assert.match(route, /hp-piping-class-product-bulk-workbench-tab\.js/);
  assert.match(route, /hp-piping-class-kd-bulk-workbench-tab\.js/);
  assert.match(wrapper, /hp-piping-class-kd-bulk-workbench-tab\.js/);
});

test('design-basis UI exposes strict product matrix preview/apply controls and the canonical contract', () => {
  for (const token of [
    'data-hpwb-product-bulk',
    'Validate matrix',
    'Apply + batch calculate',
    'HP_PIPING_CLASS_PRODUCT_BULK_HEADERS',
  ]) assert.match(wrapper, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(HP_PIPING_CLASS_PRODUCT_BULK_HEADERS, expectedHeaders);
});

test('bulk apply reuses the existing governed JSON import and calculate actions', () => {
  assert.match(wrapper, /serializeHpPipingClassWorkspaceProject/);
  assert.match(wrapper, /new DataTransfer\(\)/);
  assert.match(wrapper, /data-hpwb-file/);
  assert.equal(wrapper.includes('[data-hpwb-action="calculate"]'), true);
});

test('nominal size is persisted through the existing relational input binding', () => {
  assert.match(wrapper, /products\.\$\{index\}\.nominalSize/);
  assert.match(wrapper, /data-hpwb-bind/);
  assert.match(wrapper, /Nominal size/);
});

test('governed products stay read-only and design pressure is not part of the product bulk contract', () => {
  assert.match(wrapper, /Governed\/master products remain read-only and are preserved/);
  assert.equal(HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.includes('design_pressure_mpa'), false);
  assert.equal(HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.includes('internal_allowance_mm'), true);
  assert.equal(HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.includes('external_allowance_mm'), true);
});
