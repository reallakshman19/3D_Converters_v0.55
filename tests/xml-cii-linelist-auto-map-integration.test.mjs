import assert from 'node:assert/strict';
import test from 'node:test';

import { autoMapStandaloneMasterFields } from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js';

function fixture() {
  return [
    {
      __EMPTY_1: 'Notes',
      __EMPTY_2: 'General notes',
      __EMPTY_3: 'From',
      __EMPTY_4: 'To',
      __EMPTY_7: 'Fluid',
      __EMPTY_12: 'Density',
      __EMPTY_13: 'Liquid',
      __EMPTY_14: 'Mixed',
      __EMPTY_21: 'Piping class',
    },
    {
      __EMPTY_1: '1',
      __EMPTY_2: 'Line Number',
      __EMPTY_3: 'SOURCE HEADER',
      __EMPTY_4: 'DEST HEADER',
      __EMPTY_7: 'HC',
      __EMPTY_12: 'Gas',
      __EMPTY_13: 'kg/m³',
      __EMPTY_14: 'kg/m³',
      __EMPTY_21: '93833',
    },
    {
      __EMPTY_1: 'Service',
      __EMPTY_2: '4110001',
      __EMPTY_3: 'SOURCE-1',
      __EMPTY_4: 'DEST-1',
      __EMPTY_7: 'HC',
      __EMPTY_12: 'kg/m³',
      __EMPTY_13: '900',
      __EMPTY_14: '850',
      __EMPTY_21: '11502',
    },
  ];
}

test('combined auto-map rejects stale incompatible claims and preserves explicit semantics', () => {
  const rows = fixture();
  const map = autoMapStandaloneMasterFields('lineList', rows, {
    lineSeqNo: '__EMPTY_21',
    from: '__EMPTY_21',
    to: '__EMPTY_21',
  });

  assert.equal(map.lineKey1, '__EMPTY_1');
  assert.equal(map.lineKey2, '__EMPTY_2');
  assert.equal(map.lineSeqNo, '__EMPTY_2');
  assert.equal(map.pipingClass, '__EMPTY_21');
  assert.equal(map.phase, '__EMPTY_7');
  assert.equal(map.from, '__EMPTY_3');
  assert.equal(map.to, '__EMPTY_4');
  assert.equal(map.densityGas, '__EMPTY_12');
  assert.equal(map.densityLiquid, '__EMPTY_13');
  assert.equal(map.densityMixed, '__EMPTY_14');
  assert.equal(map.density, '');
});
