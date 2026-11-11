import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateUg44RatedFlange, ug44AcceptanceEquation } from '../converters/engineering-calculations/flange/ug44.js';
import { resolveFlangeOpeningLoads, transportMomentToJointFace } from '../converters/engineering-calculations/flange/joint-loads.js';

function relativeError(actual, expected) {
  return Math.abs(actual - expected) / Math.abs(expected);
}

test('UG-44 SI arithmetic preserves pressure-equivalent identity', () => {
  const g = 0.1;
  const targetExternalPressure = 3_000_000;
  const bendingMomentNm = targetExternalPressure * Math.PI * g ** 3 / 16;
  const result = calculateUg44RatedFlange({
    ratedPressurePa: 4_000_000,
    designPressurePa: 1_000_000,
    gasketReactionDiameterM: g,
    momentFactor: 0.5,
    bendingMomentNm,
    openingAxialForceN: 0,
  });

  assert.ok(Math.abs(result.bendingPressurePa - targetExternalPressure) < 1e-8);
  assert.equal(result.maximumPressurePa, 3_000_000);
  assert.equal(result.pass, true);
  assert.ok(Math.abs(result.utilization - (4_000_000 / 6_000_000)) < 1e-12);
});

test('acceptance equation and pressure form give the same disposition', () => {
  const input = {
    ratedPressurePa: 3_712_053,
    designPressurePa: 420_361,
    gasketReactionDiameterM: 0.196088,
    momentFactor: 0.5,
    bendingMomentNm: 7_354,
    openingAxialForceN: 5_500,
  };
  const pressure = calculateUg44RatedFlange(input);
  const equation = ug44AcceptanceEquation(input);
  assert.equal(pressure.pass, equation.pass);
});

test('PV Elite rounded C101 examples reproduce within displayed-input tolerance', () => {
  const cases = [
    { gMm: 77.900, fm: 0.50, meNm: 460, feN: 900, expectedKPa: 429.409 },
    { gMm: 988.600, fm: 0.10, meNm: 90_188, feN: 25_927, expectedKPa: 3574.263 },
    { gMm: 196.088, fm: 0.50, meNm: 7_354, feN: 5_500, expectedKPa: 420.361 },
    { gMm: 357.251, fm: 0.50, meNm: 33_517, feN: 15_000, expectedKPa: 1676.048 },
  ];

  for (const item of cases) {
    const result = calculateUg44RatedFlange({
      ratedPressurePa: 3_712.053 * 1000,
      designPressurePa: 420.361 * 1000,
      gasketReactionDiameterM: item.gMm / 1000,
      momentFactor: item.fm,
      bendingMomentNm: item.meNm,
      openingAxialForceN: item.feN,
    });
    assert.ok(relativeError(result.maximumPressurePa / 1000, item.expectedKPa) <= 0.02);
  }
});

test('joint load resolution ignores closing axial load and resolves in-plane bending', () => {
  assert.deepEqual(resolveFlangeOpeningLoads({
    forceN: { x: 3, y: 4, z: -100 },
    momentNm: { x: 6, y: 8, z: -2 },
  }), {
    openingAxialForceN: 0,
    bendingMomentNm: 10,
    torsionalMomentNm: 2,
    transverseShearN: 5,
  });
});

test('moment transport applies r cross F at the joint face', () => {
  assert.deepEqual(transportMomentToJointFace({
    forceN: { x: 0, y: 100, z: 0 },
    momentNm: { x: 1, y: 2, z: 3 },
    offsetM: { x: 2, y: 0, z: 0 },
  }), { x: 1, y: 2, z: 203 });
});

test('invalid geometry fails closed', () => {
  assert.throws(() => calculateUg44RatedFlange({
    ratedPressurePa: 1,
    designPressurePa: 0,
    gasketReactionDiameterM: 0,
    momentFactor: 0,
    bendingMomentNm: 0,
    openingAxialForceN: 0,
  }), /gasketReactionDiameterM/);
});
