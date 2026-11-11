import assert from 'node:assert/strict';
import test from 'node:test';
import { distributeLinearBoltGroupLoads } from '../converters/engineering-calculations/bolts/group-loads.js';

const SQUARE = Object.freeze([
  { id: 'B1', xM: -0.1, yM: -0.1 },
  { id: 'B2', xM: 0.1, yM: -0.1 },
  { id: 'B3', xM: 0.1, yM: 0.1 },
  { id: 'B4', xM: -0.1, yM: 0.1 },
]);

function close(actual, expected, tolerance = 1e-10) {
  assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

function assertEquilibrium(result, tolerance = 1e-10) {
  const residual = result.equilibrium.residual;
  for (const value of Object.values(residual)) close(value, 0, tolerance);
}

test('pure axial load distributes equally across a symmetric four-bolt group', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: SQUARE,
    forceN: { z: 4000 },
  });
  assert.deepEqual(result.bolts.map((row) => row.externalAxialN), [1000, 1000, 1000, 1000]);
  assert.deepEqual(result.bolts.map((row) => row.shearResultantN), [0, 0, 0, 0]);
  assertEquilibrium(result);
  assert.equal(result.canUseForDesignAuthority, false);
});

test('pure Mx creates signed axial pair pattern and reproduces applied moment', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: SQUARE,
    momentNm: { x: 200 },
  });
  result.bolts.forEach((row, index) => close(row.externalAxialN, [-500, -500, 500, 500][index]));
  assertEquilibrium(result);
});

test('pure My creates orthogonal signed axial pair pattern', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: SQUARE,
    momentNm: { y: 200 },
  });
  result.bolts.forEach((row, index) => close(row.externalAxialN, [500, -500, -500, 500][index]));
  assertEquilibrium(result);
});

test('pure torsion produces tangential shear and exactly recovers Mz', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: SQUARE,
    momentNm: { z: 40 },
  });
  const expected = [
    { x: 50, y: -50 },
    { x: 50, y: 50 },
    { x: -50, y: 50 },
    { x: -50, y: -50 },
  ];
  result.bolts.forEach((row, index) => {
    close(row.shearXn, expected[index].x);
    close(row.shearYn, expected[index].y);
  });
  assertEquilibrium(result);
});

test('combined six-DOF load preserves force and moment equilibrium', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: SQUARE,
    forceN: { x: 1200, y: -800, z: 5000 },
    momentNm: { x: 140, y: -90, z: 35 },
  });
  assertEquilibrium(result, 1e-9);
  assert.equal(result.method, 'LINEAR_RIGID_PLATE_EQUAL_BOLT_STIFFNESS_REFERENCE');
  assert.match(result.assumptions.join('\n'), /not clipped/i);
  assert.match(result.assumptions.join('\n'), /friction/i);
});

test('asymmetric non-collinear group still satisfies equilibrium', () => {
  const result = distributeLinearBoltGroupLoads({
    bolts: [
      { id: 'A', xM: -0.12, yM: -0.04 },
      { id: 'B', xM: 0.08, yM: -0.07 },
      { id: 'C', xM: 0.11, yM: 0.09 },
      { id: 'D', xM: -0.05, yM: 0.13 },
    ],
    forceN: { x: 620, y: 310, z: 2400 },
    momentNm: { x: 75, y: -55, z: 18 },
  });
  assertEquilibrium(result, 1e-9);
  close(result.bolts.reduce((sum, row) => sum + row.xM, 0), 0);
  close(result.bolts.reduce((sum, row) => sum + row.yM, 0), 0);
});

test('collinear geometry fails closed instead of inventing a bending distribution', () => {
  assert.throws(() => distributeLinearBoltGroupLoads({
    bolts: [
      { id: 'A', xM: -0.1, yM: 0 },
      { id: 'B', xM: 0, yM: 0 },
      { id: 'C', xM: 0.1, yM: 0 },
    ],
    momentNm: { x: 10 },
  }), /degenerate|collinear/i);
});

test('duplicate bolt identity fails closed', () => {
  assert.throws(() => distributeLinearBoltGroupLoads({
    bolts: [
      { id: 'A', xM: -0.1, yM: -0.1 },
      { id: 'A', xM: 0.1, yM: -0.1 },
      { id: 'C', xM: 0, yM: 0.1 },
    ],
  }), /unique/i);
});
