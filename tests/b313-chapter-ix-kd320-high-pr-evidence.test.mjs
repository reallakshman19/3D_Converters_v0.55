import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditHighPrEvidenceDirectory, gitBlobSha } from '../scripts/audit-b313-ch9-kd320-high-pr-evidence.mjs';

function write(dir, name, content) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
  return gitBlobSha(Buffer.from(content, 'utf8'));
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kd320-high-pr-'));
  const files = {};
  files['B313_CHAPTER_IX_MASTER_DATA_SPECIFICATION.md'] = write(dir, 'B313_CHAPTER_IX_MASTER_DATA_SPECIFICATION.md', '# project specification\n');
  files['method_manifest.csv'] = write(dir, 'method_manifest.csv', [
    'method_id,method_revision,application_scope,b313_edition,b313_scope,viii3_source_id,kd2_method_id,kd3_method_id,kd4_policy_id,b31j_edition,material_property_policy_id,fatigue_route_id,effective_from,qualification_state,verified_by,verified_at',
    'B313-CH9-PF-2024-R1,1.0.0,STRAIGHT_PIPE_PRESSURE_ONLY,2024,HIGH_PRESSURE_FLUID_SERVICE,SRC-VIII3-2025,KD2-ELASTIC-001,KD3-FATIGUE-001,KD4,2020,MAT,ROUTE-KD3-2024,2024-01-01,APPROVED,A,2026-01-01',
  ].join('\n') + '\n');
  files['fatigue_route.csv'] = write(dir, 'fatigue_route.csv', [
    'fatigue_route_id,method_revision,kd_route_id,stress_basis,seq_route,mean_stress_route,fatigue_curve_id,interpolation_rule,extrapolation_allowed,applicability,source_id,qualification_state',
    'ROUTE-KD3-2024,1.0.0,KD3-FATIGUE-001,TRESCA_STRESS_INTENSITY,KD320_MEAN_STRESS_CORRECTION,ALGEBRAIC_MEAN_STRESS,VIII3-KD3-CS-001,LOG_LOG,FALSE,STRAIGHT_PIPE_REMOTE_FROM_DISCONTINUITY,SRC-VIII3-2025,APPROVED',
  ].join('\n') + '\n');
  files['fatigue_curve.csv'] = write(dir, 'fatigue_curve.csv', [
    'fatigue_curve_id,standard,edition,material_scope,temp_min_c,temp_max_c,environment_scope,mean_stress_embedded,source_id,source_locator,license_class,qualification_state',
    'VIII3-KD3-CS-001,VIII3,2025,CARBON,-29,371,AIR,FALSE,SRC-VIII3-2025,Table A,LICENSED_RESTRICTED,APPROVED',
    'VIII3-KD3-SS-001,VIII3,2025,SS,-196,427,AIR,FALSE,SRC-VIII3-2025,Table B,LICENSED_RESTRICTED,APPROVED',
    'VIII3-KD3-NICKEL-001,VIII3,2025,NICKEL,-196,427,AIR,FALSE,SRC-VIII3-2025,Table C,LICENSED_RESTRICTED,APPROVED',
  ].join('\n') + '\n');
  files['fatigue_curve_point.csv'] = write(dir, 'fatigue_curve_point.csv', [
    'fatigue_curve_id,point_no,n_cycles,sa_mpa,source_locator,verified_by,verified_at',
    'VIII3-KD3-CS-001,1,1000,200,Table A,A,2026',
    'VIII3-KD3-CS-001,2,10000,100,Table A,A,2026',
    'VIII3-KD3-CS-001,3,100000,50,Table A,A,2026',
    'VIII3-KD3-SS-001,1,1000,220,Table B,A,2026',
    'VIII3-KD3-SS-001,2,10000,110,Table B,A,2026',
  ].join('\n') + '\n');
  files['material_property.csv'] = write(dir, 'material_property.csv', 'material_id,temperature_c,yield_strength_mpa\nMAT,100,200\n');
  files['benchmark_case.csv'] = write(dir, 'benchmark_case.csv', [
    'benchmark_id,benchmark_family,method_id,method_revision,source_type,source_id,independent,inputs_json,expected_intermediates_json,expected_result_json,tolerance_type,tolerance_value,reviewer,status',
    'HP-CODE-24-F01,CLASS_E_CODE_LICENSED,B313-CH9-PF-2024-R1,1.0.0,CODE_OFFICIAL_EXAMPLE,SRC-B313-2024,TRUE,"{}","{}","{""validation_basis"":""CROSS_SOLVER"",""disposition"":""CONGRUENT""}",EXACT,0,LEAD,QUALIFIED',
  ].join('\n') + '\n');
  files['code_source_revision.csv'] = write(dir, 'code_source_revision.csv', [
    'source_id,standard,edition,addenda,document_title,document_hash,license_class,storage_class,source_locator,verified_by,verified_at,status',
    'SRC-B313-2024,B31.3,2024,NONE,B31.3,sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,LICENSED_RESTRICTED,SECURE_STORE,K304,A,2026,ACTIVE',
    'SRC-VIII3-2025,VIII3,2025,NONE,VIII3,sha256:91c28f30e4b76a0129cd3e845f012a6789bcde0123456789abcdef0123456789,LICENSED_RESTRICTED,SECURE_STORE,KD-3,A,2026,ACTIVE',
  ].join('\n') + '\n');
  const manifest = {
    schema: 'kd320-high-pr-reconciliation/v1',
    sourceSnapshot: { repository: 'TEST', commit: crypto.randomBytes(20).toString('hex'), path: 'High Pr', files: Object.entries(files).map(([name, gitBlobSha]) => ({ name, gitBlobSha, required: true })) },
    target: {
      methodId: 'B313-CH9-PF-2024-R1', methodRevision: '1.0.0', b313Edition: '2024', viii3SourceId: 'SRC-VIII3-2025', kd3MethodId: 'KD3-FATIGUE-001', routeId: 'ROUTE-KD3-2024', stressBasis: 'TRESCA_STRESS_INTENSITY', seqRoute: 'KD320_MEAN_STRESS_CORRECTION', meanStressRoute: 'ALGEBRAIC_MEAN_STRESS', carbonCurveId: 'VIII3-KD3-CS-001', stainlessCurveId: 'VIII3-KD3-SS-001', nickelCurveId: 'VIII3-KD3-NICKEL-001', interpolationRule: 'LOG_LOG', extrapolationAllowed: 'FALSE', applicability: 'STRAIGHT_PIPE_REMOTE_FROM_DISCONTINUITY',
    },
    authority: { evidenceClass: 'PROJECT_MASTER_DEVELOPMENT_EVIDENCE', canSatisfyControlledSourceReceipt: false, canPromoteQ1SemanticItem: false, nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false },
    nativeSemanticBlockers: ['CONTROLLED_VIII3_SOURCE_RECEIPT_PENDING', 'KD320_ASSOCIATED_MEAN_STRESS_DEFINITION_NOT_CONTROLLED'],
  };
  return { dir, manifest };
}

test('reconciles pinned High Pr development evidence without promoting native KD320', () => {
  const { dir, manifest } = fixture();
  const result = auditHighPrEvidenceDirectory(dir, manifest);
  assert.equal(result.ok, true);
  assert.equal(result.sourceSnapshot.integrityOk, true);
  assert.equal(result.route.methodMatches, true);
  assert.equal(result.route.routeMatches, true);
  assert.equal(result.curves.carbon.pointCount, 3);
  assert.equal(result.curves.carbon.monotonic, true);
  assert.equal(result.capability.userCalculatedKd3IntakeCompatible, true);
  assert.equal(result.capability.nativeKd320Ready, false);
  assert.equal(result.authority.canPromoteQ1SemanticItem, false);
  assert.equal(result.q1Impact.g0G1RemainBlocked, true);
});

test('detects qualitative Class-E evidence, placeholder-like source hash and missing nickel points', () => {
  const { dir, manifest } = fixture();
  const result = auditHighPrEvidenceDirectory(dir, manifest);
  assert.equal(result.benchmark.numericalOracleRetained, false);
  assert.equal(result.source.viii3HashLooksSynthetic, true);
  assert.equal(result.curves.nickel.declared, true);
  assert.equal(result.curves.nickel.pointCount, 0);
  assert(result.blockers.includes('HP_CODE_24_F01_REMAINS_QUALITATIVE_ONLY'));
  assert(result.blockers.includes('VIII3_SOURCE_REGISTRY_HASH_LOOKS_PLACEHOLDER'));
  assert(result.blockers.includes('NICKEL_CURVE_DECLARED_WITHOUT_NUMERICAL_POINTS'));
});

test('fails reconciliation when a pinned source file changes', () => {
  const { dir, manifest } = fixture();
  fs.appendFileSync(path.join(dir, 'fatigue_route.csv'), '# drift\n');
  const result = auditHighPrEvidenceDirectory(dir, manifest);
  assert.equal(result.ok, false);
  assert.equal(result.sourceSnapshot.integrityOk, false);
  assert(result.integrityIssues.includes('PINNED_HIGH_PR_GIT_BLOB_MISMATCH'));
});

test('fails reconciliation when the target production route is altered', () => {
  const { dir, manifest } = fixture();
  const routePath = path.join(dir, 'fatigue_route.csv');
  const changed = fs.readFileSync(routePath, 'utf8').replace('LOG_LOG,FALSE', 'LINEAR,TRUE');
  fs.writeFileSync(routePath, changed, 'utf8');
  manifest.sourceSnapshot.files.find((row) => row.name === 'fatigue_route.csv').gitBlobSha = gitBlobSha(Buffer.from(changed));
  const result = auditHighPrEvidenceDirectory(dir, manifest);
  assert.equal(result.ok, false);
  assert(result.integrityIssues.includes('TARGET_FATIGUE_ROUTE_MISMATCH'));
  assert.equal(result.capability.nativeKd320Ready, false);
});
