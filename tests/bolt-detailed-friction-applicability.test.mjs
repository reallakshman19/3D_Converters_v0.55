import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateLegacyThreadGeometry } from '../converters/engineering-calculations/bolts/detailed-friction.js';

test('legacy workbook thread-geometry helper fails closed outside its qualified 60-degree thread form', () => {
  assert.throws(() => calculateLegacyThreadGeometry({
    nominalDiameterM: 0.01,
    pitchM: 0.0015,
    includedThreadAngleDeg: 55,
    starts: 1,
  }), /60-degree included thread angle/);
});
