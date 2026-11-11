import assert from 'node:assert/strict';
import { calculateB313Thickness } from '../converters/b313-thickness/index.js';
import { calculateAndSelectPreviewB313Wall } from '../converters/xml-cii2019-core/b313-preview-wall-update.js';

const input = {
  dn: 250,
  outsideDiameterMm: 273,
  designPressure: 51.1,
  pressureUnit: 'barg',
  corrosionAllowanceMm: 6,
  allowableStress: 116.79184583043917,
  stressUnit: 'MPa',
  qualityFactorE: 1,
  weldStrengthReductionW: 1,
  coefficientY: 0.4,
  dimensionStandard: 'ASME B36.10M',
};

const direct = calculateB313Thickness({
  edition: '2024',
  pressureMode: 'internal',
  designPressure: input.designPressure,
  pressureUnit: input.pressureUnit,
  outsideDiameter: input.outsideDiameterMm,
  lengthUnit: 'mm',
  allowableStress: input.allowableStress,
  stressUnit: input.stressUnit,
  qualityFactorE: input.qualityFactorE,
  weldStrengthReductionW: input.weldStrengthReductionW,
  coefficientY: input.coefficientY,
  corrosionAllowance: input.corrosionAllowanceMm,
  allowanceUnit: 'mm',
  negativeMillTolerance: { basis: 'percent', value: 12.5 },
});
assert.equal(direct.ok, true, JSON.stringify(direct));

const preview = calculateAndSelectPreviewB313Wall(input);
assert.equal(preview.ok, true, JSON.stringify(preview));
assert.equal(preview.engineeringCalculation.calculationId, 'PIPE.B313.THICKNESS');
assert.ok(Math.abs(preview.calculation.requiredNominalThicknessMm - direct.requiredNominalThicknessMm) < 1e-12);
assert.equal(preview.calculation.pressureDesignThicknessMm, direct.pressureDesignThicknessMm);
assert.equal(preview.calculation.requiredMinimumThicknessMm, direct.requiredMinimumThicknessMm);

console.log('Issue #776 B31.3 central API parity verified.');
