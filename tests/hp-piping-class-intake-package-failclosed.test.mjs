import assert from 'node:assert/strict';
import test from 'node:test';
import { HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION } from '../tabs/hp-piping-class-intake-package.js';
import { previewHpPipingClassIntakePackageForReview } from '../tabs/hp-piping-class-intake-package-review.js';

const productHeaders = ['product_id','nominal_size','od_mm','allowable_stress_mpa','nominal_wall_mm','minus_tolerance_pct','internal_allowance_mm','external_allowance_mm','fatigue_wall_basis','measured_current_wall_mm','future_internal_loss_mm','future_external_loss_mm'];
const stateHeaders = ['state_id','pressure_mpa','material_temperature_c','structural_temperature_c'];
const cycleHeaders = ['cycle_id','from_state_id','to_state_id','total_cycles','cycles_per_year','category','provenance_id'];
const kdHeaders = ['cycle_id','location_id','user_salt_mpa','seq_mpa','permissible_cycles'];

function pkg() {
  return {
    schemaVersion: HP_PIPING_CLASS_INTAKE_PACKAGE_VERSION,
    metadata: { projectId: 'P1', classId: 'HP', revision: 'A' },
    method: { b313Edition: '2024', viii3Edition: '2025' },
    classBasis: { designPressureMpa: 20 },
    spectrum: { spectrumId: 'SPEC-1', designLifeYears: 20 },
    tables: {
      products: { headers: productHeaders, rows: [['NPS4-S160','NPS 4',114.3,138,13.49,12.5,3,0,'END_OF_LIFE_EFFECTIVE',null,null,null]] },
      states: { headers: stateHeaders, rows: [['LOW',2,40,40],['HIGH',20,80,80]] },
      cycles: { headers: cycleHeaders, rows: [['C1','LOW','HIGH',500,25,'PRESSURE','OPS-1']] },
      kd: [{ productId: 'NPS4-S160', headers: kdHeaders, rows: [['C1','BORE',null,70,10000]] }],
    },
  };
}

function codes(result) { return new Set((result.issues ?? []).map((row) => row.code)); }

test('authority promotion fields are forbidden anywhere in the package', () => {
  const value = pkg();
  value.method.canUseForDesignAuthority = true;
  value.tables.products.extra = { nativeCoreKd3Qualified: true };
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('INTAKE_PACKAGE_AUTHORITY_FIELD_FORBIDDEN'));
});

test('schema and exact table header drift fail closed', () => {
  const value = pkg();
  value.schemaVersion = 'hp-piping-class-intake-package/v0';
  value.tables.products.headers[2] = 'diameter_mm';
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('INTAKE_PACKAGE_VERSION_UNSUPPORTED'));
  assert.ok(codes(result).has('INTAKE_PACKAGE_TABLE_HEADER_MISMATCH'));
});

test('transient validator remains authoritative for unknown state references', () => {
  const value = pkg();
  value.tables.cycles.rows[0][2] = 'MISSING';
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('CYCLE_BULK_STATE_UNKNOWN'));
  assert.equal(result.issues.find((row) => row.code === 'CYCLE_BULK_STATE_UNKNOWN').details.stage, 'TRANSIENT');
});

test('KD product identity is exact, case-sensitive and unique', () => {
  const caseMismatch = pkg();
  caseMismatch.tables.kd[0].productId = 'nps4-s160';
  const a = previewHpPipingClassIntakePackageForReview(caseMismatch);
  assert.equal(a.ok, false);
  assert.ok(codes(a).has('INTAKE_PACKAGE_KD_PRODUCT_CASE_MISMATCH'));

  const duplicate = pkg();
  duplicate.tables.kd.push({ ...duplicate.tables.kd[0], productId: 'nps4-s160' });
  const b = previewHpPipingClassIntakePackageForReview(duplicate);
  assert.equal(b.ok, false);
  assert.ok(codes(b).has('INTAKE_PACKAGE_KD_PRODUCT_DUPLICATE'));
});

test('VIII-3 edition identity is required when KD data is present', () => {
  const value = pkg();
  delete value.method.viii3Edition;
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('INTAKE_PACKAGE_VIII3_EDITION_REQUIRED'));
});

test('existing KD validator rejects a package missing a governed cycle', () => {
  const value = pkg();
  value.tables.cycles.rows.push(['C2','HIGH','LOW',100,5,'SHUTDOWN','OPS-2']);
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('KD_BULK_CYCLE_MISSING'));
  assert.equal(result.issues.find((row) => row.code === 'KD_BULK_CYCLE_MISSING').details.stage, 'KD');
});

test('canonical user-Salt mismatch blocks package admission before workspace mutation', () => {
  const value = pkg();
  value.tables.kd[0].rows[0][2] = 10;
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('USER_SALT_MISMATCH'));
  assert.equal(result.project, null);
  assert.ok(result.candidateProject);
});

test('required class identity and positive design pressure fail before table application', () => {
  const value = pkg();
  value.metadata.classId = '';
  value.classBasis.designPressureMpa = 0;
  const result = previewHpPipingClassIntakePackageForReview(value);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('INTAKE_PACKAGE_METADATA_REQUIRED'));
  assert.ok(codes(result).has('INTAKE_PACKAGE_DESIGN_PRESSURE_INVALID'));
});
