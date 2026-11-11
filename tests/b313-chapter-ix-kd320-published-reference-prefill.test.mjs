import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { auditKd320PublishedReferencePrefill } from '../scripts/audit-b313-ch9-kd320-published-reference-prefill.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const file = path.join(root, 'engineering/hp-class-standardization/qualification/kd320-q2/published-reference/candidates.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

function audit(value = data) { return auditKd320PublishedReferencePrefill(structuredClone(value)); }

test('published-reference prefill is structurally valid but cannot admit KD3-QF-022', () => {
  const result = audit();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.targetQf022Ready, false);
  assert.equal(result.authority.q2OracleAdmissionReady, false);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
});

test('PVP2025-154710 retains full numerical chain but remains blocked by VIII-3 2023 edition and custody', () => {
  const result = audit();
  const ref = result.references.find((item) => item.referenceId === 'PVP2025-154710');
  assert.equal(ref.numerical.fullChainDeclared, true);
  assert.equal(ref.numerical.rows, 6);
  assert.equal(ref.eligibleForQf022, false);
  assert.ok(ref.blockers.includes('VIII3_EDITION_2023_NOT_TARGET_2025'));
  assert.ok(ref.blockers.includes('SOURCE_SHA256_PENDING'));
  assert.ok(ref.blockers.includes('CONTROLLED_2025_EDITION_RECONCILIATION_PENDING'));
});

test('PVP2024-123674 remains a partial-chain cross-check and cannot be the target oracle', () => {
  const result = audit();
  const ref = result.references.find((item) => item.referenceId === 'PVP2024-123674');
  assert.equal(ref.numerical.fullChainDeclared, false);
  assert.equal(ref.numerical.rows, 6);
  assert.equal(ref.eligibleForQf022, false);
  assert.ok(ref.blockers.includes('VIII3_EDITION_2021_NOT_TARGET_2025'));
  assert.ok(ref.blockers.includes('FULL_SALT_MEAN_PARAMETER_SEQ_CHAIN_NOT_RETAINED'));
});

test('authority promotion in prefill artifact is rejected', () => {
  const altered = structuredClone(data);
  altered.authority.nativeCoreKd3Qualified = true;
  const result = audit(altered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('AUTHORITY_nativeCoreKd3Qualified_MUST_REMAIN_FALSE'));
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
});

test('prefill cannot auto-admit QF022 even after apparent edition/hash/reconciliation/admission completion', () => {
  const altered = structuredClone(data);
  const ref = altered.references[0];
  ref.viii3EditionUsed = '2025';
  ref.sourceSha256 = `sha256:${'a'.repeat(64)}`;
  ref.editionReconciliation.status = 'CONTROLLED_2025_EQUIVALENCE_VERIFIED';
  ref.independentAdmission = { status: 'INDEPENDENTLY_ADMITTED', checkedBy: 'Checker B', checkedAt: '2026-08-18T10:00:00Z' };
  const result = audit(altered);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('PVP2025-154710:DECLARED_ELIGIBILITY_MISMATCH'));
  assert.ok(result.errors.includes('PVP2025-154710:PREFILL_MUST_NOT_AUTO_ADMIT_QF022'));
  assert.equal(result.targetQf022Ready, false);
  assert.equal(result.authority.q2OracleAdmissionReady, false);
});
