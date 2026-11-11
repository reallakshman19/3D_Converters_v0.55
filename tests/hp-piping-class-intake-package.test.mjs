import assert from 'node:assert/strict';
import test from 'node:test';
import { HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION } from '../tabs/hp-piping-class-intake-package.js';
import {
  applyHpPipingClassIntakePackageForReview,
  previewHpPipingClassIntakePackageForReview,
} from '../tabs/hp-piping-class-intake-package-review.js';

const productHeaders = [
  'product_id','nominal_size','od_mm','allowable_stress_mpa','nominal_wall_mm','minus_tolerance_pct',
  'internal_allowance_mm','external_allowance_mm','fatigue_wall_basis','measured_current_wall_mm',
  'future_internal_loss_mm','future_external_loss_mm',
];
const stateHeaders = ['state_id','pressure_mpa','material_temperature_c','structural_temperature_c'];
const cycleHeaders = ['cycle_id','from_state_id','to_state_id','total_cycles','cycles_per_year','category','provenance_id'];
const kdHeaders = ['cycle_id','location_id','user_salt_mpa','seq_mpa','permissible_cycles'];

function packageObject() {
  return {
    schemaVersion: HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION,
    metadata: { projectId: 'HP-CLASS-001', classId: 'HP-A', revision: 'A' },
    method: { b313Edition: '2024', viii3Edition: '2025' },
    classBasis: { designPressureMpa: 20 },
    spectrum: { spectrumId: 'OPS-20Y', designLifeYears: 20, preparedBy: 'Engineer A' },
    tables: {
      products: {
        headers: productHeaders,
        rows: [
          ['NPS4-S160','NPS 4',114.3,138,13.49,12.5,3,0,'END_OF_LIFE_EFFECTIVE',null,null,null],
          ['NPS6-XXS','NPS 6',168.3,138,18.26,12.5,3,0,'END_OF_LIFE_EFFECTIVE',null,null,null],
        ],
      },
      states: { headers: stateHeaders, rows: [['LOW',2,40,45],['HIGH',20,80,75]] },
      cycles: { headers: cycleHeaders, rows: [['C1','LOW','HIGH',500,25,'PRESSURE_CYCLE','OPS-001']] },
      kd: [{ productId: 'NPS4-S160', headers: kdHeaders, rows: [['C1','BORE_INNER_SURFACE',null,70,10000]] }],
    },
  };
}

function approx(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}

test('single package composes products, transient spectrum and per-product KD through existing contracts', () => {
  const result = previewHpPipingClassIntakePackageForReview(packageObject());
  assert.equal(result.ok, true);
  assert.equal(result.summary.products, 2);
  assert.equal(result.summary.states, 2);
  assert.equal(result.summary.cycles, 1);
  assert.equal(result.summary.kdProducts, 1);
  assert.equal(result.summary.kdRows, 1);
  assert.equal(result.summary.canonicalProjectState, 'CALCULATED_NOT_AUTHORIZED');
  assert.equal(result.summary.calculationBlocked, 0);
  assert.equal(result.summary.fatigueEvaluated, 1);
  assert.equal(result.project.classBasis.internalAllowanceMm, 3);
  assert.equal(result.project.classBasis.externalAllowanceMm, 0);
  assert.equal(result.project.transient.states[1].pressureMpa, 20);
  assert.equal(result.project.fatigueEvidence[0].productId, 'NPS4-S160');
});

test('canonical preflight reproduces NPS4 static/wall/fatigue bookkeeping and NPS6 static result', () => {
  const result = previewHpPipingClassIntakePackageForReview(packageObject());
  const nps4 = result.calculation.products.find((row) => row.productId === 'NPS4-S160');
  const nps6 = result.calculation.products.find((row) => row.productId === 'NPS6-XXS');
  approx(nps4.calculations.static.outputs.requiredNominalThicknessMm, 12.240449712388969, 1e-10);
  approx(nps4.calculations.static.outputs.pressureRatingMpa, 23.086120852009273, 1e-10);
  approx(nps4.calculations.wallState.outputs.endOfLifeEffectiveWallMm, 8.80375, 1e-12);
  approx(nps4.calculations.fatigue.outputs.cycles[0].coreSaltMpa, 63.29949581051363, 1e-10);
  approx(nps4.calculations.fatigue.outputs.cumulativeUsage, 0.05, 1e-12);
  approx(nps6.calculations.static.outputs.pressureRatingMpa, 23.114229, 1e-5);
  assert.equal(nps6.assessment.fatigueEvaluated, false);
});

test('apply returns canonical project only after successful preflight', () => {
  const result = applyHpPipingClassIntakePackageForReview(JSON.stringify(packageObject()));
  assert.equal(result.ok, true);
  assert.equal(result.applied, true);
  assert.equal(result.project.metadata.classId, 'HP-A');
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.codeCompliance, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});

test('table cells with commas and quotes are delegated through CSV quoting without identity drift', () => {
  const pkg = packageObject();
  pkg.tables.cycles.rows[0][5] = 'STARTUP, PRESSURE "STEP"';
  pkg.tables.cycles.rows[0][6] = 'OPS,"A"';
  const result = previewHpPipingClassIntakePackageForReview(pkg);
  assert.equal(result.ok, true);
  assert.equal(result.project.transient.transitions[0].category, 'STARTUP, PRESSURE "STEP"');
  assert.equal(result.project.transient.transitions[0].provenanceId, 'OPS,"A"');
});

test('static reference fail remains an admissible engineering result rather than a package parser failure', () => {
  const pkg = packageObject();
  pkg.tables.products.rows[0][4] = 12.0;
  pkg.tables.kd = [];
  const result = previewHpPipingClassIntakePackageForReview(pkg);
  assert.equal(result.ok, true);
  assert.equal(result.summary.staticReferenceFailed, 1);
  assert.equal(result.calculation.products[0].engineeringState, 'STATIC_REFERENCE_FAIL');
  assert.equal(result.calculation.products[0].assessment.staticPass, false);
});
