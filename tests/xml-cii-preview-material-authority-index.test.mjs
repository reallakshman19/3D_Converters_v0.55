import assert from 'node:assert/strict';
import {
  applyPreviewMaterialCodeAuthority,
  buildPreviewMaterialLineListIndex,
  resolvePreviewMaterialCodeAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-material-authority.js';

const fieldMap = { lineKey1: 'Service', lineKey2: 'Line Number', material: 'Material' };
const mapRows = [{ Material: 'ASTM A106 Gr B', 'Material Code': 'MAT1' }];

function legacyLineListMaterial(row, config) {
  const direct = String(row?.processMaterial || row?.lineListMaterial || '').trim();
  if (direct) return direct;
  const normal = (value) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const aliases = (value) => {
    const compact = normal(value);
    return [...new Set([compact, compact.replace(/^[A-Z](?=\d{5,}$)/, '')].filter(Boolean))];
  };
  const wanted = new Set([...aliases(row?.lineKey), ...aliases(row?.lineKeyProposed)]);
  for (const raw of config.linelist.masterRows) {
    const key = `${raw.Service || ''}${raw['Line Number'] || ''}`.replace(/\s+/g, '');
    if (!aliases(key).some((alias) => wanted.has(alias))) continue;
    return String(raw.Material || '').trim().toUpperCase();
  }
  return '';
}

{
  const config = {
    linelist: { fieldMap, masterRows: [
      { Service: 'A', 'Line Number': '12345', Material: '' },
      { Service: 'B', 'Line Number': '12345', Material: 'ASTM A106 Gr B' },
    ] },
    material: { mapRows }, overrides: {},
  };
  const row = { lineKey: '12345' };
  assert.equal(legacyLineListMaterial(row, config), '', 'reference must stop on first matching blank row');
  const indexed = resolvePreviewMaterialCodeAuthority(row, config, { lineListIndex: buildPreviewMaterialLineListIndex(config) });
  assert.equal(indexed.material, '', 'indexed lookup must preserve first matching blank row semantics');
  assert.equal(indexed.materialCode, '');
}

{
  const config = {
    linelist: { fieldMap, masterRows: [
      { Service: 'A', 'Line Number': '11111', Material: 'ASTM A106 Gr B' },
      { Service: 'B', 'Line Number': '22222', Material: 'ASTM A312 TP316L' },
    ] },
    material: { mapRows }, overrides: {},
  };
  const row = { lineKey: 'B22222', lineKeyProposed: 'A11111' };
  assert.equal(legacyLineListMaterial(row, config), 'ASTM A106 GR B');
  const indexed = resolvePreviewMaterialCodeAuthority(row, config, { lineListIndex: buildPreviewMaterialLineListIndex(config) });
  assert.equal(indexed.material, 'ASTM A106 GR B', 'earliest source row must win across all target aliases');
  assert.equal(indexed.materialCode, 'MAT1');
}

{
  let masterReads = 0;
  const sourceRows = Array.from({ length: 10_000 }, (_, index) => ({
    Service: 'A', 'Line Number': String(10000 + index), Material: 'ASTM A106 Gr B',
  }));
  const masterRows = new Proxy(sourceRows, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && /^\d+$/.test(prop)) masterReads += 1;
      return Reflect.get(target, prop, receiver);
    },
  });
  const config = { linelist: { fieldMap, masterRows }, material: { mapRows }, overrides: {} };
  const branchRows = Array.from({ length: 100 }, () => ({ lineKey: 'A19999' }));
  const output = applyPreviewMaterialCodeAuthority({ config, result: { branchRows, nodeRows: [] } });
  assert.equal(output.branchRows.length, 100);
  assert.equal(masterReads, sourceRows.length, 'Line List master must be traversed once for the whole apply pass');
}

function countedMaterialMap(rowCount) {
  let reads = 0;
  const rows = Array.from({ length: rowCount }, (_, index) => index === 0
    ? { Material: 'ASTM A106 Gr B', 'Material Code': 'MAT1' }
    : { Material: `OTHER ${index}`, 'Material Code': `X${index}` });
  return {
    rows: new Proxy(rows, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && /^\d+$/.test(prop)) reads += 1;
        return Reflect.get(target, prop, receiver);
      },
    }),
    reads: () => reads,
  };
}

{
  const singleMap = countedMaterialMap(250);
  applyPreviewMaterialCodeAuthority({
    config: { linelist: { masterRows: [], fieldMap }, material: { mapRows: singleMap.rows }, overrides: {} },
    result: { branchRows: [{ processMaterial: 'ASTM A106 Gr B' }] },
  });
  const singleReads = singleMap.reads();

  const repeatedMap = countedMaterialMap(250);
  const output = applyPreviewMaterialCodeAuthority({
    config: { linelist: { masterRows: [], fieldMap }, material: { mapRows: repeatedMap.rows }, overrides: {} },
    result: { branchRows: Array.from({ length: 100 }, (_, index) => ({
      processMaterial: 'ASTM A106 Gr B',
      material: index === 0 ? 'ASTM A106 Gr B' : '',
      materialSource: index === 0 ? 'override' : '',
    })) },
  });
  assert.equal(repeatedMap.reads(), singleReads, 'identical process material must invoke the Material Map resolver once per apply pass');
  assert.equal(output.branchRows[0].materialSource, 'override', 'per-row authority must remain outside the cached resolver result');
  assert.equal(output.branchRows[1].materialSource, 'process-linelist-material');
  assert.equal(output.branchRows[99].materialCode, 'MAT1');
}

console.log('XML CII Preview Material authority indexing checks passed.');
