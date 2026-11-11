import assert from 'node:assert/strict';
import { buildXmlCiiFlangeWeightFallback } from '../converters/xml-cii2019-core/flange-weight-fallback.js';

const config = {
  weight: {
    masterRows: [{
      convertedBore: 80,
      lengthMm: 80,
      weight: 9,
      rating: 300,
      type: 'FLAN',
      typeDesc: 'WELDING NECK FLANGE SCH 40 300#',
    }],
  },
};

const oneFlange = buildXmlCiiFlangeWeightFallback({
  boreMm: 80,
  rating: 300,
  lengthMm: 84.37,
  candidates: [],
}, config);
assert.ok(oneFlange);
assert.equal(oneFlange.suggestedWeight, 9.492);
assert.equal(oneFlange.weightMethod, 'flange-length-extrapolated');

const combinedAssembly = buildXmlCiiFlangeWeightFallback({
  boreMm: 80,
  rating: 300,
  lengthMm: 168.74,
  candidates: [],
}, config);
assert.ok(combinedAssembly);
assert.equal(combinedAssembly.suggestedWeight, 18.983);
assert.equal(combinedAssembly.score, 0.45, '0.45 is a fallback rank/confidence score, not engineering deviation');

assert.equal(2 * 84.37, 168.74, 'assembly span is two component-local flange lengths');
assert.ok(Math.abs(combinedAssembly.suggestedWeight - (2 * oneFlange.suggestedWeight)) <= 0.002,
  'each proposal is independently rounded to 0.001 kg');
console.log('Issue #776 flange weight geometry regression verified.');
