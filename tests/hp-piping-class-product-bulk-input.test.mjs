import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HP_PIPING_CLASS_PRODUCT_BULK_HEADERS,
  applyHpPipingClassProductBulkInput,
  previewHpPipingClassProductBulkInput,
} from '../tabs/hp-piping-class-product-bulk-input.js';

const header = HP_PIPING_CLASS_PRODUCT_BULK_HEADERS.join(',');

function baseProject() {
  return {
    schemaVersion: 'hp-piping-class-project/v2',
    metadata: {
      projectId: 'P1', classId: 'HP-CS-001', revision: 'A',
      referenceSampleId: 'REFERENCE-1', referenceSource: 'reference.js',
    },
    methodManifest: {
      b313Edition: '2024', viii3Edition: '2025', calculationMode: 'USER_CALCULATED_KD3',
      nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false,
    },
    classBasis: { designPressureMpa: 20, internalAllowanceMm: 1, externalAllowanceMm: 1 },
    products: [
      {
        productId: 'GOV-1', nominalSize: 'NPS 3',
        calculationBasis: { mode: 'GOVERNED_BASIS_PACKAGE', basisPackage: { basisId: 'B1' } },
        wallState: { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' },
      },
      {
        productId: 'NPS4-S160', nominalSize: 'NPS 4', calculationBasis: {
          mode: 'DIRECT_ENGINEERING_INPUT', outsideDiameterMm: 114.3, allowableStressMpa: 130, nominalWallMm: 13.49, minusTolerancePct: 12.5,
        },
        wallState: { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' },
      },
      {
        productId: 'REMOVE-ME', nominalSize: 'NPS 2', calculationBasis: {
          mode: 'DIRECT_ENGINEERING_INPUT', outsideDiameterMm: 60.3, allowableStressMpa: 120, nominalWallMm: 8, minusTolerancePct: 12.5,
        },
        wallState: { fatigueWallBasis: 'END_OF_LIFE_EFFECTIVE' },
      },
    ],
    transient: { spectrum: null, states: [], transitions: [] },
    fatigueEvidence: [
      { productId: 'GOV-1', externalResults: [{ cycleId: 'C-GOV' }] },
      { productId: 'NPS4-S160', externalResults: [{ cycleId: 'C1', calculationBasis: { calculationRef: 'KEEP-ME' } }] },
      { productId: 'REMOVE-ME', externalResults: [{ cycleId: 'C2', calculationBasis: { calculationRef: 'DROP-ME' } }] },
    ],
  };
}

function greenfieldMatrix() {
  return `${header}\n`
    + 'NPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,\n'
    + 'NPS6-XXS,NPS 6,168.3,138,18.26,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,';
}

test('valid class matrix computes hand-checkable minimum and effective wall', () => {
  const preview = previewHpPipingClassProductBulkInput(baseProject(), greenfieldMatrix());
  assert.equal(preview.ok, true);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.classBasisPatch.internalAllowanceMm, 3);
  assert.equal(preview.classBasisPatch.externalAllowanceMm, 0);
  assert.ok(Math.abs(preview.rows[0].minimumAsManufacturedWallMm - 11.80375) < 1e-12);
  assert.ok(Math.abs(preview.rows[0].effectiveNetWallMm - 8.80375) < 1e-12);
  assert.ok(Math.abs(preview.rows[1].minimumAsManufacturedWallMm - 15.9775) < 1e-12);
  assert.ok(Math.abs(preview.rows[1].effectiveNetWallMm - 12.9775) < 1e-12);
});

test('class-level allowance conflict fails closed', () => {
  const source = `${header}\n`
    + 'P1,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,\n'
    + 'P2,NPS 6,168.3,138,18.26,12.5,2,0,END_OF_LIFE_EFFECTIVE,,,';
  const preview = previewHpPipingClassProductBulkInput(baseProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_CLASS_ALLOWANCE_CONFLICT'), true);
});

test('case-insensitive duplicate product identity fails closed', () => {
  const source = `${header}\n`
    + 'NPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,\n'
    + 'nps4-s160,NPS 4 alt,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,';
  const preview = previewHpPipingClassProductBulkInput(baseProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_PRODUCT_ID_DUPLICATE'), true);
});

test('effective wall must remain positive after tolerance and allowances', () => {
  const source = `${header}\nP1,NPS 1,33.4,100,3,12.5,3,0,END_OF_LIFE_EFFECTIVE,, ,`;
  const preview = previewHpPipingClassProductBulkInput(baseProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_EFFECTIVE_WALL_NONPOSITIVE'), true);
});

test('projected EOL basis requires measured wall and explicit future losses', () => {
  const incomplete = `${header}\nP1,NPS 4,114.3,138,13.49,12.5,3,0,PROJECTED_END_OF_LIFE,,,`;
  const blocked = previewHpPipingClassProductBulkInput(baseProject(), incomplete);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.issues.some((row) => row.code === 'PRODUCT_BULK_PROJECTED_WALL_REQUIRES_MEASUREMENT'), true);

  const complete = `${header}\nP1,NPS 4,114.3,138,13.49,12.5,3,0,PROJECTED_END_OF_LIFE,12,1,0.5`;
  const preview = previewHpPipingClassProductBulkInput(baseProject(), complete);
  assert.equal(preview.ok, true);
  assert.equal(preview.rows[0].projectedEndOfLifeWallMm, 10.5);
});

test('bulk input cannot overwrite an existing governed product', () => {
  const source = `${header}\nGOV-1,NPS 3,88.9,138,10,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,`;
  const preview = previewHpPipingClassProductBulkInput(baseProject(), source);
  assert.equal(preview.ok, false);
  assert.equal(preview.issues.some((row) => row.code === 'PRODUCT_BULK_GOVERNED_PRODUCT_WRITE_BLOCKED'), true);
});

test('apply replaces direct matrix while preserving governed products and matching fatigue custody', () => {
  const before = baseProject();
  const result = applyHpPipingClassProductBulkInput(before, greenfieldMatrix());
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.deepEqual(result.project.products.map((row) => row.productId), ['GOV-1', 'NPS4-S160', 'NPS6-XXS']);
  assert.equal(result.project.products[1].nominalSize, 'NPS 4');
  assert.equal(result.project.products[1].calculationBasis.allowableStressMpa, 138);
  assert.equal(result.project.classBasis.internalAllowanceMm, 3);
  assert.equal(result.project.classBasis.externalAllowanceMm, 0);
  assert.deepEqual(result.project.fatigueEvidence.map((row) => row.productId), ['GOV-1', 'NPS4-S160']);
  assert.equal(result.project.fatigueEvidence[1].externalResults[0].calculationBasis.calculationRef, 'KEEP-ME');
  assert.deepEqual(result.plan.removedFatigueProductIds, ['REMOVE-ME']);
  assert.equal('referenceSampleId' in result.project.metadata, false);
  assert.equal('referenceSource' in result.project.metadata, false);
  assert.equal(result.project.methodManifest.nativeCoreKd3Qualified, false);
  assert.equal(result.project.methodManifest.codeCompliance, false);
  assert.equal(result.project.methodManifest.canUseForDesignAuthority, false);
});

test('failed apply does not return a mutated project', () => {
  const value = baseProject();
  const before = structuredClone(value);
  const result = applyHpPipingClassProductBulkInput(value, `${header}\nP1,NPS 1,33.4,100,3,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,`);
  assert.equal(result.applied, false);
  assert.equal(result.project, null);
  assert.deepEqual(value, before);
});
