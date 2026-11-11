import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  evaluateKd320EditionReconciliation,
  KD320_EDITION_RECONCILIATION_SEMANTICS,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/edition-reconciliation/evaluator.js';
import { verifyKd320EditionReconciliationFile } from
  '../scripts/verify-b313-ch9-kd320-edition-reconciliation.mjs';

const A = '2026-08-18T10:00:00Z';
const B = '2026-08-18T11:00:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

function row(semanticId) {
  return {
    semanticId,
    sourceEdition: '2023',
    targetEdition: '2025',
    sourceLocator: `PVP2025-154710:${semanticId}`,
    targetControlledLocator: `VIII3-2025:${semanticId}`,
    controlledSemanticRef: `secure://viii3-2025/${semanticId}`,
    comparisonStatus: 'IDENTICAL',
    comparedBy: 'Engineer A', comparedAt: A,
    independentCheckBy: 'Engineer B', independentCheckedAt: B,
  };
}

function complete() {
  return {
    schema: 'kd320-edition-reconciliation-candidate/v1',
    target: {
      referenceId: 'PVP2025-154710', sourceCodeEdition: '2023', targetCodeEdition: '2025',
      methodId: 'KD3-FATIGUE-001', benchmarkId: 'KD3-QF-022',
      controlledSourceRef: 'Q1-SRC-VIII3-2025',
    },
    authority: {
      targetQf022Ready: false, q2OracleAdmissionReady: false, nativeCoreKd3Qualified: false,
      codeCompliance: false, canUseForDesignAuthority: false, productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
    sourceEvidence: {
      referenceId: 'PVP2025-154710', sourceCodeEdition: '2023',
      bibliographicRef: 'doi:10.1115/PVP2025-154710', exactLocator: 'Table 3', paperSha256: HASH_A,
    },
    targetEvidence: {
      controlledSourceRef: 'Q1-SRC-VIII3-2025', secureStorageRef: 'secure://viii3-2025',
      documentSha256: HASH_B,
    },
    semanticReconciliation: KD320_EDITION_RECONCILIATION_SEMANTICS.map(row),
  };
}

test('pending candidate is structurally valid but not reconciliation-ready', () => {
  const candidate = complete();
  candidate.sourceEvidence.paperSha256 = null;
  candidate.targetEvidence.documentSha256 = null;
  candidate.semanticReconciliation.forEach((item) => {
    item.targetControlledLocator = null;
    item.controlledSemanticRef = null;
    item.comparisonStatus = 'PENDING_CONTROLLED_2025_SOURCE';
  });
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.ok, true);
  assert.equal(result.state, 'CONTROLLED_2025_RECONCILIATION_PENDING');
  assert.equal(result.targetQf022Ready, false);
  assert.ok(result.blockers.some((v) => v.startsWith('KD320-SEM-013:')));
});

test('complete equivalence is ready only for Q2 submission, never QF022 admission', () => {
  const result = evaluateKd320EditionReconciliation(complete());
  assert.equal(result.state, 'EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION');
  assert.equal(result.editionReconciliationReady, true);
  assert.equal(result.targetQf022Ready, false);
  assert.equal(result.authority.q2OracleAdmissionReady, false);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
});

test('changed semantic requires a new target-2025 oracle', () => {
  const candidate = complete();
  candidate.semanticReconciliation[3].comparisonStatus = 'CHANGED_REQUIRES_NEW_ORACLE';
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.state, 'CONTROLLED_2025_RECONCILIATION_CHANGED_NEW_ORACLE_REQUIRED');
  assert.deepEqual(result.changedSemantics, ['KD320-SEM-005']);
});

test('missing target locator keeps reconciliation pending', () => {
  const candidate = complete();
  candidate.semanticReconciliation[7].targetControlledLocator = null;
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.editionReconciliationReady, false);
  assert.ok(result.blockers.includes('KD320-SEM-009:TARGET_CONTROLLED_LOCATOR_MISSING'));
});

test('comparator and checker must be distinct', () => {
  const candidate = complete();
  candidate.semanticReconciliation[0].independentCheckBy = ' engineer a ';
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.editionReconciliationReady, false);
  assert.ok(result.blockers.includes('KD320-SEM-002:INDEPENDENT_CHECK_CUSTODY_INCOMPLETE'));
});

test('source-edition spoof to 2025 is a structural failure', () => {
  const candidate = complete();
  candidate.target.sourceCodeEdition = '2025';
  candidate.sourceEvidence.sourceCodeEdition = '2025';
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.structuralErrors.includes('TARGET_SOURCECODEEDITION_MISMATCH'));
});

test('authority promotion attempt is rejected', () => {
  const candidate = complete();
  candidate.authority.nativeCoreKd3Qualified = true;
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.structuralErrors.includes('AUTHORITY_nativeCoreKd3Qualified_MUST_REMAIN_FALSE'));
});

test('unknown or missing semantic set is rejected', () => {
  const candidate = complete();
  candidate.semanticReconciliation.pop();
  candidate.semanticReconciliation.push(row('KD320-SEM-999'));
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.ok, false);
  assert.ok(result.structuralErrors.includes('SEMANTIC_ROW_SET_MISMATCH'));
});

test('invalid source or controlled hash blocks readiness', () => {
  const candidate = complete();
  candidate.sourceEvidence.paperSha256 = 'sha256:not-a-hash';
  candidate.targetEvidence.documentSha256 = 'sha256:also-bad';
  const result = evaluateKd320EditionReconciliation(candidate);
  assert.equal(result.editionReconciliationReady, false);
  assert.ok(result.blockers.includes('PUBLISHED_PAPER_SHA256_PENDING'));
  assert.ok(result.blockers.includes('CONTROLLED_2025_DOCUMENT_SHA256_PENDING'));
});

test('file verifier consumes the same contract', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kd320-edition-'));
  const file = path.join(dir, 'candidate.json');
  fs.writeFileSync(file, JSON.stringify(complete(), null, 2));
  const result = verifyKd320EditionReconciliationFile(file, { requireReady: true });
  assert.equal(result.editionReconciliationReady, true);
  assert.equal(result.requireReady, true);
});
