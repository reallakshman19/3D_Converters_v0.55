import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  resolveXmlCiiBoreAuthority,
  xmlCiiNominalDnFromOd,
} from '../converters/xml-cii2019-core/bore-authority.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INVENTORY_PATH = path.join(
  ROOT,
  'tests',
  'fixtures',
  'xml-cii-p2810042-c06-source-inventory.json',
);

function inventory() {
  return JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
}

test('P2810042 source inventory preserves the full-model engineering baseline', () => {
  const data = inventory();

  assert.equal(data.source.pipeFullName, '/SYS-24-P2810042');
  assert.equal(data.source.branchCount, 9);
  assert.equal(data.source.nodeCount, 172);
  assert.equal(data.source.boreTagCount, 0);
  assert.equal(data.source.wallThicknessZeroCount, 172);
  assert.deepEqual(data.source.uniqueOutsideDiameters, [33.4, 60.3, 457, 508, 610]);

  assert.equal(data.lineList.service, 'P');
  assert.equal(data.lineList.lineNumber, '2810042');
  assert.equal(data.lineList.nominalPipeSizeIn, 24);
  assert.equal(data.lineList.pipingClass, '61440');

  const byBranch = new Map(data.branches.map((row) => [row.branch, row]));
  assert.deepEqual(byBranch.get('B2')?.outsideDiameters, [508, 610]);
  assert.deepEqual(byBranch.get('B5')?.outsideDiameters, [33.4, 60.3]);
  assert.deepEqual(byBranch.get('B6')?.outsideDiameters, [33.4, 60.3, 610]);
  assert.deepEqual(byBranch.get('B8')?.outsideDiameters, [457]);

  assert.equal(data.rigidOwners.length, 11);
  assert.deepEqual(
    data.rigidOwners
      .filter((row) => row.connectionType === 'BRAN')
      .map((row) => `${row.branch}::${row.nodeNumber}`),
    ['B2::130', 'B3::150', 'EXE/B2::10'],
  );
});

test('explicit source OD wins over the model 24-inch branch identity for every observed OD', () => {
  const data = inventory();
  const expectedDn = new Map([
    [33.4, 25],
    [60.3, 50],
    [457, 450],
    [508, 500],
    [610, 600],
  ]);

  for (const od of data.source.uniqueOutsideDiameters) {
    assert.equal(xmlCiiNominalDnFromOd(od), expectedDn.get(od));
    const result = resolveXmlCiiBoreAuthority({
      xmlOutsideDiameterMm: od,
      branchName: '/HBMR-1000-24"-P2810042-61440-01/B5',
    });
    assert.equal(result.boreMm, expectedDn.get(od));
    assert.equal(result.source, 'xml-outside-diameter');
    assert.equal(result.fallbackUsed, false);
    assert.equal(result.needsReview, false);
  }

  assert.equal(
    data.authorityInvariant,
    'Line-list and Branchname 24-inch identity are line-level competing/fallback evidence; explicit node OutsideDiameter remains primary where present.',
  );
});

test('reported coordinate and zero-weight rigid witnesses remain source facts, not inferred authority', () => {
  const data = inventory();
  const witness = new Map(data.reportedWitnesses.map((row) => [row.id, row]));
  const main10 = witness.get('coordinate-main-b2-node10');
  const exe10 = witness.get('exe-480-10');
  const weight150 = witness.get('weight-149-150');

  assert.equal(main10?.position, '72298.40 115930.00 100000.00');
  assert.equal(exe10?.position, main10?.position);
  assert.equal(exe10?.componentRefNo, '=67127432/19');
  assert.equal(exe10?.weight, 0);
  assert.equal(weight150?.componentRefNo, '=67127481/44');
  assert.equal(weight150?.weight, 0);

  const reducer110 = witness.get('reducer-110');
  const reducer120 = witness.get('reducer-120');
  assert.equal(reducer110?.outsideDiameter, 610);
  assert.equal(reducer120?.outsideDiameter, 508);
});
