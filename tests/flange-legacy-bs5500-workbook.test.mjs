import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLegacyBs5500WorkbookFlange } from '../converters/engineering-calculations/flange/legacy-bs5500-workbook.js';

const FIXTURE = Object.freeze({
  designPressurePa: 0.2e6,
  goM: 0.010,
  hM: 0,
  g1M: 0.010,
  flangeThicknessM: 0.044,
  flangeInsideDiameterM: 1.046,
  boltCircleDiameterM: 1.210,
  flangeOutsideDiameterM: 1.290,
  gasketType: 'spiral wound',
  gasketOuterDiameterM: 1.162,
  gasketInnerDiameterM: 1.046,
  gasketMFactor: 1.4,
  gasketYPa: 13e6,
  boltCount: 28,
  boltDiameterM: 0.039,
  singleBoltRootAreaM2: 979.75e-6,
  boltOperatingAllowablePa: 172e6,
  boltAmbientAllowablePa: 172e6,
  shapeF: 0.90892,
  shapeV: 0.550103,
  shapeStressFactor: 1,
  appliedOperatingMomentNm: 0,
});

function close(actual, expected, tolerance = 1e-10) {
  assert(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test('source fixture reproduces recovered workbook geometry and shape constants', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  close(result.gasket.effectiveWidthM, 0.01357061531397895);
  close(result.gasket.reactionDiameterM, 1.1348587693720422);
  close(result.shape.K, 1.2332695984703632);
  close(result.shape.T, 1.8253921302604372);
  close(result.shape.U, 10.308673928365396);
  close(result.shape.Y, 9.380913777978774);
  close(result.shape.Z, 4.839111273298902);
});

test('source fixture reproduces recovered pressure loads and moment arms', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  close(result.pressureLoads.Hdn, 171776.21200000003);
  close(result.pressureLoads.Hgn, 27080.646788052883);
  close(result.pressureLoads.Htn, 30424.78294803828);
  close(result.momentArmsM.hd, 0.077);
  close(result.momentArmsM.hg, 0.03757061531397892);
  close(result.momentArmsM.ht, 0.05978530765698946);
  close(result.calculatedOperatingMomentNm, 16063.159895873272);
});

test('source fixture reproduces recovered bolt-area and assembly-load chain', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  close(result.bolting.Wm1n, 229281.6417360912);
  close(result.bolting.Wm2n, 628657.8718655134);
  close(result.bolting.Am1M2, 0.0013330328007912278);
  close(result.bolting.Am2M2, 0.003654987627125078);
  close(result.bolting.actualAreaM2, 0.027433);
  close(result.bolting.assemblyBoltLoadN, 2673566.9359327564);
});

test('source fixture reproduces operating and bolt-up stress results', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  close(result.operating.hubStressPa, 127.28278394120187e6);
  close(result.operating.radialStressPa, 10.002324507627797e6);
  close(result.operating.tangentialStressPa, 26.008972518601595e6);
  close(result.operating.combinedStressPa, 76.64587822990174e6);
  close(result.boltUp.hubStressPa, 795.9358249760564e6);
  close(result.boltUp.combinedStressPa, 479.2887021398941e6);
});

test('spiral-wound branch reproduces b=min(bo, 2.52*sqrt(bo))', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  const nMm = (1162 - 1046) / 2;
  const boMm = nMm / 2;
  close(result.gasket.effectiveWidthM, Math.min(boMm, 2.52 * Math.sqrt(boMm)) / 1000);
});

test('ring-joint branch reproduces the workbook N/8 rule', () => {
  const result = calculateLegacyBs5500WorkbookFlange({ ...FIXTURE, gasketType: 'ring joint' });
  close(result.gasket.effectiveWidthM, (((1162 - 1046) / 2) / 8) / 1000);
  assert.equal(result.gasket.ringJointBranch, true);
});

test('applied operating moment is added before the recovered stress-moment factor', () => {
  const base = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  const loaded = calculateLegacyBs5500WorkbookFlange({ ...FIXTURE, appliedOperatingMomentNm: 5000 });
  close(loaded.totalOperatingMomentNm - base.totalOperatingMomentNm, 5000);
  assert(loaded.operating.combinedStressPa > base.operating.combinedStressPa);
});

test('correction factor is fail-safe floored at one as in the workbook', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  assert.equal(result.factors.correctionFactor, 1);
});

test('invalid K=A/B geometry fails closed instead of evaluating singular shape constants', () => {
  assert.throws(() => calculateLegacyBs5500WorkbookFlange({
    ...FIXTURE,
    flangeOutsideDiameterM: FIXTURE.flangeInsideDiameterM,
  }), (error) => error.code === 'INPUT_INVALID');
});

test('stress result reports the recovered reduced moment with force units, not torque units', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  close(result.operating.reducedMomentN, 15356.749422440987);
  close(result.boltUp.reducedMomentN, 96030.16717600661);
  assert.equal(Object.hasOwn(result.operating, 'momentNm'), false);
});

test('correction factor above one is reproduced without clipping to the source fixture', () => {
  const input = { ...FIXTURE, flangeThicknessM: 0.010, boltDiameterM: 0.010 };
  const result = calculateLegacyBs5500WorkbookFlange(input);
  const cMm = input.boltCircleDiameterM * 1000;
  const boltMm = input.boltDiameterM * 1000;
  const tMm = input.flangeThicknessM * 1000;
  const expected = Math.sqrt((3.14 * cMm / input.boltCount)
    / (2 * boltMm + 6 * tMm / (input.gasketMFactor + 0.5)));
  close(result.factors.correctionFactor, expected);
  assert(result.factors.correctionFactor > 1);
});

test('zero design pressure remains valid for a bolt-up-only benchmark case', () => {
  const result = calculateLegacyBs5500WorkbookFlange({ ...FIXTURE, designPressurePa: 0 });
  close(result.pressureLoads.Hdn, 0);
  close(result.pressureLoads.Hgn, 0);
  close(result.calculatedOperatingMomentNm, 0);
  assert(result.boltUp.combinedStressPa > 0);
});

test('legacy benchmark never promotes workbook acceptance to design authority', () => {
  const result = calculateLegacyBs5500WorkbookFlange(FIXTURE);
  assert.equal(result.sourceAuthority, 'LEGACY_BENCHMARK_ONLY');
  assert.equal(result.acceptanceEvaluated, false);
  assert.equal(result.codeCompliance, false);
  assert.equal(result.canUseForDesignAuthority, false);
  assert.equal(result.governingEligible, false);
});
