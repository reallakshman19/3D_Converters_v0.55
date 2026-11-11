import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

import { detectLineListHeaderBand, refineLineListFieldMap } from '../tabs/xml-cii-2019-standalone/xml-cii-linelist-header-band.js';
import { recoverMasterDatasetRawRows } from '../tabs/xml-cii-2019-standalone/workers/master-dataset-remap-custody.js';

function reportedHeaderBand() {
  return [
    { __EMPTY_1: 'Notes', __EMPTY_2: 'FOR GENERAL NOTES, HOLDS AND ABBREVIATIONS REFER SHEET-2' },
    { __EMPTY_1: '1' },
    {
      __EMPTY_1: 'Service', __EMPTY_2: 'Line Number', __EMPTY_3: 'From', __EMPTY_4: 'To', __EMPTY_7: 'Fluid',
      __EMPTY_11: 'Temp.', __EMPTY_12: 'Density', __EMPTY_20: 'Nominal Pipe size', __EMPTY_21: 'Piping class',
      __EMPTY_22: 'DESIGN CONDITIONS', __EMPTY_24: 'Temp. Max', __EMPTY_25: 'Temp. Min', __EMPTY_26: 'Material',
      __EMPTY_28: 'Insulation Thickness', __EMPTY_31: 'Test Pressure (Kpa)',
    },
    { __EMPTY_22: 'Pressure Max' },
    { __EMPTY_12: 'Density', __EMPTY_13: 'Density', __EMPTY_14: 'Density' },
    { __EMPTY_12: 'Gas', __EMPTY_13: 'Liquid', __EMPTY_14: 'Mixed' },
    {
      __EMPTY_11: 'ºC', __EMPTY_12: 'kg/m³', __EMPTY_13: 'kg/m³', __EMPTY_14: 'kg/m³', __EMPTY_20: 'inch',
      __EMPTY_22: 'kPa(g)', __EMPTY_24: 'ºC', __EMPTY_25: 'ºC', __EMPTY_31: 'kPa(g)',
    },
    {
      __EMPTY_1: 'P', __EMPTY_2: '0310051', __EMPTY_3: 'SOURCE', __EMPTY_4: 'DESTINATION', __EMPTY_7: 'HC',
      __EMPTY_11: '35-38', __EMPTY_12: '5.1', __EMPTY_13: '850', __EMPTY_14: '420', __EMPTY_20: '10',
      __EMPTY_21: '61440', __EMPTY_22: '9440', __EMPTY_24: '82', __EMPTY_25: '5', __EMPTY_26: 'CS',
      __EMPTY_28: '50', __EMPTY_31: '15315',
    },
  ];
}

const EXPECTED = Object.freeze({
  lineKey1: '__EMPTY_1', lineKey2: '__EMPTY_2', lineSeqNo: '', pipingClass: '__EMPTY_21',
  material: '__EMPTY_26', convertedBore: '__EMPTY_20', p1: '__EMPTY_22', hydroPressure: '__EMPTY_31',
  t1: '__EMPTY_24', t2: '__EMPTY_11', t3: '__EMPTY_25', insThk: '__EMPTY_28', density: '',
  densityGas: '__EMPTY_12', densityLiquid: '__EMPTY_13', densityMixed: '__EMPTY_14', phase: '__EMPTY_7',
  from: '__EMPTY_3', to: '__EMPTY_4',
});

test('reported multi-row Line List header band maps semantic columns without false line sequence or generic density', () => {
  const result = detectLineListHeaderBand(reportedHeaderBand()).fieldMap;
  for (const [field, expected] of Object.entries(EXPECTED)) assert.equal(result[field] ?? '', expected, field);
});

test('header-band refinement overrides stale shallow draft guesses', () => {
  const refined = refineLineListFieldMap(reportedHeaderBand(), {
    lineSeqNo: '__EMPTY_2', density: '__EMPTY_12', pipingClass: '__EMPTY_1',
  });
  for (const [field, expected] of Object.entries(EXPECTED)) assert.equal(refined[field] ?? '', expected, field);
});

test('persisted Line List rows recover remap source from normalized _raw custody only', () => {
  const raw = [{ A: 'Service', B: 'Line Number' }, { A: 'P', B: '0310051' }];
  const recovered = recoverMasterDatasetRawRows({
    metadata: { masterKey: 'lineList' }, rawRows: null,
    rows: raw.map((row, index) => ({ _rowIndex: index + 1, _raw: row })),
  });
  assert.deepEqual(recovered, raw);
  assert.equal(recoverMasterDatasetRawRows({ metadata: { masterKey: 'weight' }, rows: [{ _raw: raw[0] }] }), null);
  assert.equal(recoverMasterDatasetRawRows({ metadata: { masterKey: 'lineList' }, rows: [{ _raw: null }] }), null);
});

test('UI and worker both consume the header-band mapper and restored sheet switching cannot silently no-op', () => {
  const mappingEvents = fs.readFileSync('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js', 'utf8');
  const normalize = fs.readFileSync('tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js', 'utf8');
  const service = fs.readFileSync('tabs/xml-cii-2019-standalone/workers/master-dataset-service.js', 'utf8');
  const workerEvents = fs.readFileSync('tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js', 'utf8');
  assert.match(mappingEvents, /refineLineListFieldMap\(rawRows, merged/);
  assert.match(normalize, /refineLineListFieldMap\(rawRows, merged/);
  assert.match(service, /recoverMasterDatasetRawRows\(dataset\)/);
  assert.match(workerEvents, /if \(!source\) return restoreUnavailableSheetSelection/);
  assert.match(workerEvents, /Reopen or re-import the source workbook to change sheets/);
});

test('source and docs mirrors stay byte-identical for the repaired runtime paths', () => {
  for (const path of [
    'tabs/xml-cii-2019-standalone/xml-cii-linelist-header-band.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-remap-custody.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-normalize.js',
    'tabs/xml-cii-2019-standalone/workers/master-dataset-service.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-mapping-events.js',
    'tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-worker-events.js',
  ]) {
    assert.equal(fs.readFileSync(path, 'utf8'), fs.readFileSync(`docs/${path}`, 'utf8'), path);
  }
});
