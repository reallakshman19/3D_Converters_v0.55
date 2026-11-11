import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_PRODUCT_BULK_HEADERS,
  previewHpPipingClassProductBulkInput,
} from '../tabs/hp-piping-class-product-bulk-input.js';

const header = HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.join(',');

function directProject() {
  return {
    products: [{
      productId: 'NPS4-S160',
      calculationBasis: { mode: 'DIRECT_ENGINEERING_INPUT' },
      wallState: { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' },
    }],
  };
}

test('blank required numeric cells do not coerce to zero', () => {
  const source = `${header}\nP1,NPS 4,114.3,138,13.49,,3,0,END_OF_LIFE_EFFECTIVE,,,`;
  const preview = previewHpPipingClassProductBulkInput(directProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_TOLERANCE_INVALID'), true);
});

test('case-only product identity rename is blocked to preserve custody', () => {
  const source = `${header}\nnps4-s160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,`;
  const preview = previewHpPipingClassProductBulkInput(directProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_PRODUCT_ID_CASE_RENAME_BLOCKED'), true);
});
