import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEnergyInstituteEitDocument } from '../converters/vibration/eit/parse.js';

function controlledShapeFixture() {
  return {
    options: { title: 'Controlled v5 shape fixture', version: 5, id: 8872, project: 3010 },
    lines: [
      {
        rid: '4', lref: 'Stream 7', pi: 2, si: 4, modules: 'fit,fip,sbc,mex',
        fit: '0.02', fit_data: '[{"span":"8.32"}]',
        fip: '1.00', fip_data: '[{"bref":"Recycle line","lof":1}]',
        mex: '0.40', mex_data: '[{"etype":"centrifugal compressor","lof":0.2}]',
        sbc: '0.66', sbc_data: '[{"sref":"Example D5","lof":0.66}]', maxLof: '1.00',
      },
      {
        rid: '12', lref: 'Produced water', pi: 8, si: 15, modules: 'fit,tra',
        fit: '3.12', fit_data: '[{"span":"18.61"}]',
        tra: '0.06', tra_data: '[{"itag":"FCV1002","lof":0.0577}]',
        caf: 0, caf_data: '[{"itag":"FCV1002"}]', maxLof: '3.12',
      },
      { rid: 'X', lref: 'Unknown module', pi: 1, si: 1, modules: 'fit,xyz', fit_data: 'not-json' },
    ],
    pipes: [{ pi: 1 }, { pi: 2 }, { pi: 8 }],
    streams: [{ si: 1 }, { si: 4 }, { si: 15 }],
    mats: [],
  };
}

function byCode(line, code) {
  return line.modules.find((item) => item.code === code);
}

test('generic v5 import preserves mixed-module declaration/result/detail independently', () => {
  const imported = parseEnergyInstituteEitDocument(controlledShapeFixture(), { sourceName: 'worked-example.eit' });
  assert.equal(imported.schema, 'EnergyInstituteEitImport.v1');
  assert.equal(imported.authority.importedResultsAreCurrentEngineeringAuthority, false);
  const mixed = imported.lines[0];
  for (const code of ['fit', 'fip', 'sbc', 'mex']) {
    assert.equal(byCode(mixed, code).declaredInModules, true);
    assert.equal(byCode(mixed, code).resultPresent, true);
    assert.equal(byCode(mixed, code).dataPresent, true);
  }
  assert.equal(mixed.historicalMaxLof, '1.00');
});

test('payload presence is detected even when module token is absent', () => {
  const imported = parseEnergyInstituteEitDocument(controlledShapeFixture());
  const caf = byCode(imported.lines[1], 'caf');
  assert.equal(caf.declaredInModules, false);
  assert.equal(caf.resultPresent, true);
  assert.equal(caf.dataPresent, true);
  assert.equal(caf.parseState, 'PARSED');
});

test('unknown module tokens and malformed legacy JSON are preserved visibly', () => {
  const imported = parseEnergyInstituteEitDocument(controlledShapeFixture());
  const line = imported.lines[2];
  assert.deepEqual(line.unknownDeclaredModules, ['xyz']);
  assert.equal(byCode(line, 'xyz').known, false);
  assert.equal(byCode(line, 'fit').parseState, 'MALFORMED');
  assert.equal(byCode(line, 'fit').rawData, 'not-json');
});

test('wrong .eit version fails closed', () => {
  const fixture = controlledShapeFixture();
  fixture.options.version = 4;
  assert.throws(() => parseEnergyInstituteEitDocument(fixture), /options\.version = 5/);
});
