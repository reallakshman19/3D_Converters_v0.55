import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { auditPr1290CandidateDirectory, gitBlobSha } from '../engineering/hp-class-standardization/qualification/kd320-q1/pr1290-candidate-audit.js';

function write(dir, name, content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  fs.writeFileSync(path.join(dir, name), buffer);
  return gitBlobSha(buffer);
}

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pr1290-candidate-'));
  const kd2Pdf = Buffer.from('candidate-kd2-pdf');
  const kd3Pdf = Buffer.from('candidate-kd3-pdf');
  const kd2Hash = crypto.createHash('sha256').update(kd2Pdf).digest('hex');
  const kd3Hash = crypto.createHash('sha256').update(kd3Pdf).digest('hex');
  const files = {};
  files['ASME_VIII_3_KD2_Stress_Basis_Package.md'] = write(dir, 'ASME_VIII_3_KD2_Stress_Basis_Package.md', '# KD2 candidate\n');
  files['ASME_VIII_3_KD3_Fatigue_Evaluation_Package.md'] = write(dir, 'ASME_VIII_3_KD3_Fatigue_Evaluation_Package.md', [
    '# KD3 candidate (2013 Edition)',
    'Mean clamp 0.90; K_r and K_e.',
    'Exact Analytical Curve Fit Formulations.',
    'Log-Log Interpolation Rule.',
    'Temperature 700^\\circ F.',
    'Assign $N_f = 10^8 cycles$ or evaluate infinite life cutoff per owner specification.',
  ].join('\n'));
  files['B31_3_Chapter_IX_Authority_Package.md'] = write(dir, 'B31_3_Chapter_IX_Authority_Package.md', '# B31 candidate\n');
  files['README.md'] = write(dir, 'README.md', '# candidate source package\n');
  files['asme_viii_3_kd2_manifest.yaml'] = write(dir, 'asme_viii_3_kd2_manifest.yaml', `standard: ASME Section VIII Division 3\nsource_pdf: kd2.pdf\nsha256: ${kd2Hash}\n`);
  files['asme_viii_3_kd3_manifest.yaml'] = write(dir, 'asme_viii_3_kd3_manifest.yaml', `standard: ASME Section VIII Division 3\nsource_pdf: kd3.pdf\nsha256: ${kd3Hash}\n`);
  files['b31_3_chapter_ix_manifest.yaml'] = write(dir, 'b31_3_chapter_ix_manifest.yaml', 'standard: ASME B31.3\nedition: 2024 / 2022\n');
  files['kd2.pdf'] = write(dir, 'kd2.pdf', kd2Pdf);
  files['kd3.pdf'] = write(dir, 'kd3.pdf', kd3Pdf);
  files['kd3_fatigue_curves_data.csv'] = write(dir, 'kd3_fatigue_curves_data.csv', [
    'figure_id,curve_id,5E1,1E2,2E2,5E2,1E3,1E4,1E5',
    'KD-320.1,CS90,311,226,164,113,89,49,29',
    'KD-320.3,SS,345,261,201,148,119,64,41',
  ].join('\n') + '\n');
  const map = Array.from({ length: 14 }, (_, index) => ({
    semanticId: `KD320-SEM-${String(index + 1).padStart(3, '0')}`,
    candidateFile: index === 0 ? 'B31_3_Chapter_IX_Authority_Package.md' : 'ASME_VIII_3_KD3_Fatigue_Evaluation_Package.md',
    candidateLocator: `candidate-${index + 1}`,
    status: index === 13 ? 'NOT_ESTABLISHED' : 'CANDIDATE_UNVERIFIED',
  }));
  const manifest = {
    schema: 'kd320-pr1290-candidate-reconciliation/v1',
    sourceSnapshot: { repository: 'TEST', pullRequest: 1290, mergeCommit: 'a'.repeat(40), path: 'Hi PR', files: Object.entries(files).map(([name, gitBlobSha]) => ({ name, gitBlobSha, required: true })) },
    target: { b313Edition: '2024', viii3Edition: '2025', b313ReceiptId: 'Q1-SRC-B313-2024', viii3ReceiptId: 'Q1-SRC-VIII3-2025' },
    authority: { evidenceClass: 'PROJECT_SOURCE_EXTRACTION_CANDIDATE', canSatisfyControlledSourceReceipt: false, canPromoteQ1SemanticItem: false, q1EvidenceStateMayChange: false, nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false, productionKernelAllowed: false, automaticPromotionAllowed: false },
    semanticCandidates: map,
  };
  return { dir, manifest };
}

test('reconciles PR1290 as candidate evidence while keeping Q1 and native KD320 blocked', () => {
  const { dir, manifest } = fixture();
  const result = auditPr1290CandidateDirectory(dir, manifest);
  assert.equal(result.ok, true);
  assert.equal(result.qualificationReady, false);
  assert.equal(result.sourceSnapshot.integrityOk, true);
  assert.equal(result.sourceHashes.every((row) => row.matches), true);
  assert.equal(result.curves.structurallyValid, true);
  assert.equal(result.semanticCandidates.length, 14);
  assert.equal(result.semanticCandidates.every((row) => row.promotable === false), true);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.q1Impact.g0G1RemainBlocked, true);
});

test('enumerates edition, source-custody, endpoint and SEM014 blockers', () => {
  const { dir, manifest } = fixture();
  const result = auditPr1290CandidateDirectory(dir, manifest);
  for (const blocker of [
    'PR1290_B313_MIXED_OR_NON_TARGET_EDITION_CLAIM',
    'PR1290_B313_CONTROLLED_SOURCE_IDENTITY_INCOMPLETE',
    'PR1290_KD2_EDITION_UNDECLARED',
    'PR1290_KD3_2013_TO_2025_RECONCILIATION_REQUIRED',
    'PR1290_INDEPENDENT_CHECKER_CUSTODY_MISSING',
    'PR1290_CURVE_BELOW_DOMAIN_RULE_AMBIGUOUS',
    'PR1290_SEM014_RESULT_RELEASE_CUSTODY_NOT_ESTABLISHED',
  ]) assert(result.blockers.includes(blocker), blocker);
});

test('arithmetic checks verify candidate formulas without granting Code authority', () => {
  const { dir, manifest } = fixture();
  const result = auditPr1290CandidateDirectory(dir, manifest);
  assert.equal(result.arithmetic.b313ThicknessPressureRoundTrip.pass, true);
  assert.equal(result.arithmetic.kd2BoreStressIdentity.pass, true);
  assert.equal(result.arithmetic.kd3LogLogMidpointIdentity.pass, true);
  assert.equal(result.arithmetic.authority, 'ARITHMETIC_CONSISTENCY_ONLY_NOT_CODE_QUALIFICATION');
});

test('fails candidate reconciliation on pinned-byte drift', () => {
  const { dir, manifest } = fixture();
  fs.appendFileSync(path.join(dir, 'README.md'), 'drift\n');
  const result = auditPr1290CandidateDirectory(dir, manifest);
  assert.equal(result.ok, false);
  assert(result.integrityIssues.includes('PR1290_PINNED_SOURCE_BLOB_MISMATCH'));
});

test('fails candidate reconciliation when a declared source SHA-256 does not match the retained bytes', () => {
  const { dir, manifest } = fixture();
  const file = path.join(dir, 'kd3.pdf');
  fs.writeFileSync(file, Buffer.from('tampered'));
  manifest.sourceSnapshot.files.find((row) => row.name === 'kd3.pdf').gitBlobSha = gitBlobSha(Buffer.from('tampered'));
  const result = auditPr1290CandidateDirectory(dir, manifest);
  assert.equal(result.ok, false);
  assert(result.integrityIssues.includes('PR1290_DECLARED_SOURCE_SHA256_MISMATCH'));
});

test('fails closed if candidate authority flags are promoted', () => {
  const { dir, manifest } = fixture();
  manifest.authority.productionKernelAllowed = true;
  const result = auditPr1290CandidateDirectory(dir, manifest);
  assert.equal(result.ok, false);
  assert(result.integrityIssues.includes('PR1290_CANDIDATE_AUTHORITY_MUST_REMAIN_FALSE'));
});
