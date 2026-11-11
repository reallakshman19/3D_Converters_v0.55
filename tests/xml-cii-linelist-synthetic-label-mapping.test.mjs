import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectLineListFieldMap,
  normalizeLineListRow,
} from '../converters/xml-cii2019-core/linelist-mapping.js';
import { fuzzyAutoMapFields } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fuzzy-mapper.js';
import { MASTER_FIELDS } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-fields-config.js';

function reportedRows() {
  return [
    {
      __EMPTY_1: 'Notes',
      __EMPTY_2: 'FOR GENERAL NOTES, HOLDS AND ABBREVIATIONS REFER SHEET-2',
      __EMPTY_3: 'From',
      __EMPTY_4: 'To',
      __EMPTY_7: 'Fluid',
      __EMPTY_12: 'Density',
      __EMPTY_13: 'Liquid',
      __EMPTY_14: 'Mixed',
      __EMPTY_20: 'Nominal Pipe size',
      __EMPTY_21: 'Piping class',
      __EMPTY_22: 'DESIGN CONDITIONS',
      __EMPTY_24: 'Temp. Max',
      __EMPTY_25: 'Temp. Min',
      __EMPTY_26: 'Material',
      __EMPTY_28: 'Insulation Thickness',
      __EMPTY_31: 'Test Pressure (Kpa)',
    },
    {
      __EMPTY_1: '1',
      __EMPTY_2: 'Line Number',
      __EMPTY_3: 'WET GAS LIFT PIPELINE SOURCE TIE-IN',
      __EMPTY_4: 'WET GAS MANIFOLD',
      __EMPTY_7: 'HC',
      __EMPTY_12: 'Gas',
      __EMPTY_13: 'kg/m³',
      __EMPTY_14: 'kg/m³',
      __EMPTY_20: 'inch',
      __EMPTY_21: '93833',
      __EMPTY_22: 'Pressure Max',
      __EMPTY_24: 'ºC',
      __EMPTY_25: 'ºC',
      __EMPTY_26: 'DSS',
      __EMPTY_31: 'kPa(g)',
    },
    {
      __EMPTY_1: 'Service',
      __EMPTY_2: '4110001',
      __EMPTY_3: 'd/s 41-RO-10008',
      __EMPTY_4: 'VENT STACK',
      __EMPTY_7: 'HC',
      __EMPTY_12: 'kg/m³',
      __EMPTY_13: '-',
      __EMPTY_14: '-',
      __EMPTY_20: '4',
      __EMPTY_21: '11502',
      __EMPTY_22: 'kPa(g)',
      __EMPTY_24: '120',
      __EMPTY_25: '-50',
      __EMPTY_26: 'LTCS',
      __EMPTY_31: '22905',
    },
  ];
}

test('synthetic labels preserve phase-specific density and explicit From/To', () => {
  const rawRows = reportedRows();
  const map = fuzzyAutoMapFields(Object.keys(rawRows[0]), MASTER_FIELDS.lineList.fields, rawRows);

  assert.equal(map.from, '__EMPTY_3');
  assert.equal(map.to, '__EMPTY_4');
  assert.equal(map.densityGas, '__EMPTY_12');
  assert.equal(map.densityLiquid, '__EMPTY_13');
  assert.equal(map.densityMixed, '__EMPTY_14');
  assert.equal(map.density, '');
  assert.equal(map.phase, '__EMPTY_7');
  assert.equal(map.pipingClass, '__EMPTY_21');
  assert.notEqual(map.lineSeqNo, '__EMPTY_21');
});

test('generic density only maps when the column has no phase qualifier', () => {
  const rawRows = [
    { __EMPTY_A: 'Density', __EMPTY_B: 'Gas', __EMPTY_C: 'Liquid' },
    { __EMPTY_A: 'kg/m³', __EMPTY_B: 'kg/m³', __EMPTY_C: 'kg/m³' },
    { __EMPTY_A: '850', __EMPTY_B: '5', __EMPTY_C: '900' },
  ];
  const map = fuzzyAutoMapFields(Object.keys(rawRows[0]), MASTER_FIELDS.lineList.fields, rawRows);
  assert.equal(map.density, '__EMPTY_A');
  assert.equal(map.densityGas, '__EMPTY_B');
  assert.equal(map.densityLiquid, '__EMPTY_C');
});

test('core detection never aliases mixed density into generic density', () => {
  const map = detectLineListFieldMap([
    { 'Density Mixed': 'Density Mixed' },
    { 'Density Mixed': 'kg/m3' },
    { 'Density Mixed': '875' },
  ]);
  assert.equal(map.densityMixed, 'Density Mixed');
  assert.equal(map.density, undefined);
});

test('persisted incompatible From/To/Line Seq mappings are rejected', () => {
  const rawRows = reportedRows();
  const map = detectLineListFieldMap(rawRows, {
    pipingClass: '__EMPTY_21',
    lineSeqNo: '__EMPTY_21',
    from: '__EMPTY_21',
    to: '__EMPTY_21',
  });
  assert.equal(map.pipingClass, '__EMPTY_21');
  assert.notEqual(map.lineSeqNo, '__EMPTY_21');
  assert.equal(map.from, '__EMPTY_3');
  assert.equal(map.to, '__EMPTY_4');
});

test('normalized rows carry From/To as canonical values', () => {
  const row = { A: 'SOURCE', B: 'DESTINATION', C: 'SV', D: '4110001' };
  const normalized = normalizeLineListRow(row, { from: 'A', to: 'B', lineKey1: 'C', lineKey2: 'D' }, 0);
  assert.equal(normalized.from, 'SOURCE');
  assert.equal(normalized.to, 'DESTINATION');
  assert.equal(normalized.lineNoKey, 'SV4110001');
});
