import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateKd320Q1ExitAttestation,
  KD320_Q1_EXIT_EVIDENCE_REFS,
  KD320_Q1_EXIT_GATE_REFS,
  KD320_Q1_EXIT_STATUS,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/formal-exit.js';

const ISO_A = '2026-08-19T12:00:00Z';
const ISO_B = '2026-08-19T12:30:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;

function receipts() {
  return [
    { receiptId: 'Q1-SRC-B313-2024', documentSha256: HASH_A },
    { receiptId: 'Q1-SRC-VIII3-2025', documentSha256: HASH_B },
  ];
}

function semantics() {
  return Array.from({ length: 14 }, (_, index) => {
    const semanticId = `KD320-SEM-${String(index + 1).padStart(3, '0')}`;
    return {
      semanticId,
      controlledSourceRef: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
      exactSourceLocator: `controlled:${semanticId}:locator`,
      controlledSemanticRef: `secure://semantic/${semanticId}`,
    };
  });
}

function attestation(overrides = {}) {
  const semanticItems = semantics();
  return {
    schema: 'kd320-q1-exit-attestation/v1',
    recordId: 'VR-B313-CH9-KD320-NATIVE-001-Q1',
    status: KD320_Q1_EXIT_STATUS,
    controlledEvidenceLedgerRef: 'secure://q1/evidence-ledger',
    controlledEvidenceLedgerSha256: HASH_C,
    q1AuditReportRef: 'secure://q1/audit-report',
    q1AuditReportSha256: HASH_D,
    sourceReceipts: receipts(),
    semanticBindings: semanticItems.map((item) => ({ ...item })),
    evidencePassRefs: [...KD320_Q1_EXIT_EVIDENCE_REFS],
    gatePassRefs: [...KD320_Q1_EXIT_GATE_REFS],
    attestedBy: 'Q1 Engineer A',
    attestedAt: ISO_A,
    independentCheckBy: 'Q1 Checker B',
    independentCheckedAt: ISO_B,
    authority: {
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
    ...overrides,
  };
}

function evaluate(value, semanticItems = semantics()) {
  return evaluateKd320Q1ExitAttestation(value, {
    sourceReceipts: receipts(),
    semanticItems,
  });
}

test('formal Q1 exit requires exact E01-E08, G0-G1 and bound controlled evidence', () => {
  const result = evaluate(attestation());
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});

test('receipts plus semantics cannot substitute for a formal Q1 exit attestation', () => {
  const result = evaluate(null);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['Q1_EXIT_ATTESTATION_MISSING']);
});

test('formal Q1 exit fails closed if E01-E08 or G0-G1 is incomplete', () => {
  const missingEvidence = attestation({ evidencePassRefs: KD320_Q1_EXIT_EVIDENCE_REFS.slice(0, -1) });
  assert(evaluate(missingEvidence).blockers.some((code) => code.includes('Q1_EXIT_EVIDENCE_REFS_MISSING:E08')));
  const missingGate = attestation({ gatePassRefs: ['G0'] });
  assert(evaluate(missingGate).blockers.some((code) => code.includes('Q1_EXIT_GATE_REFS_MISSING:G1')));
});

test('formal Q1 exit is bound to exact candidate receipt document hashes', () => {
  const value = attestation();
  value.sourceReceipts[1].documentSha256 = HASH_A;
  const result = evaluate(value);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('Q1_EXIT_RECEIPT_HASH_MISMATCH:Q1-SRC-VIII3-2025'));
});

test('formal Q1 exit is bound to every semantic source, locator and opaque semantic ref', () => {
  const value = attestation();
  value.semanticBindings[11].exactSourceLocator = 'controlled:wrong-locator';
  const result = evaluate(value);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('Q1_EXIT_SEMANTIC_BINDING_MISMATCH:KD320-SEM-012'));
});

test('formal Q1 exit independently enforces canonical B31.3/VIII-3 semantic source binding', () => {
  const semanticItems = semantics();
  semanticItems[0].controlledSourceRef = 'Q1-SRC-VIII3-2025';
  const value = attestation();
  value.semanticBindings[0].controlledSourceRef = 'Q1-SRC-VIII3-2025';
  const result = evaluate(value, semanticItems);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('Q1_EXIT_SEMANTIC_BINDING_MISMATCH:KD320-SEM-001'));
});

test('formal Q1 exit requires independent attestation custody and permanently false authority', () => {
  const value = attestation({ independentCheckBy: ' q1 engineer a ' });
  value.authority.productionKernelAllowed = true;
  const result = evaluate(value);
  assert.equal(result.ready, false);
  assert(result.blockers.includes('Q1_EXIT_INDEPENDENT_CHECK_CUSTODY_INCOMPLETE'));
  assert(result.blockers.includes('Q1_EXIT_AUTHORITY_MUST_REMAIN_FALSE'));
});

test('formal Q1 exit template contains no licensed semantic or numerical fields', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const template = fs.readFileSync(path.join(
    here, '..', 'engineering', 'hp-class-standardization', 'qualification',
    'kd320-q1', 'formal-exit-attestation.template.json',
  ), 'utf8');
  assert.doesNotMatch(template, /licensedText|codeText|equationText|fatigueCurvePoints|formulaExpression|nativeKd320Formula/);
  const parsed = JSON.parse(template);
  assert.equal(parsed.status, null);
  assert.deepEqual(parsed.evidencePassRefs, KD320_Q1_EXIT_EVIDENCE_REFS);
  assert.deepEqual(parsed.gatePassRefs, KD320_Q1_EXIT_GATE_REFS);
});
