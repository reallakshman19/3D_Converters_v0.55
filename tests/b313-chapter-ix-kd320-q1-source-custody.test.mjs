import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  auditKd320Q1SourceCustody,
  KD320_Q1_CONTROLLED_SOURCE_BINDINGS,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/source-custody.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const q1 = path.join(root, 'engineering/hp-class-standardization/qualification/kd320-q1');
const oracle = path.join(root, 'engineering/hp-class-standardization/qualification/kd3-oracle');
const receipts = JSON.parse(fs.readFileSync(path.join(q1, 'source-receipts.json'), 'utf8'));
const sourceLedger = JSON.parse(fs.readFileSync(path.join(oracle, 'source-ledger.json'), 'utf8'));

function audit(overrides = {}) {
  return auditKd320Q1SourceCustody({
    receipts: overrides.receipts ?? structuredClone(receipts),
    sourceLedger: overrides.sourceLedger ?? structuredClone(sourceLedger),
  });
}

function source(id, ledger = sourceLedger) {
  return ledger.sources.find((item) => item.sourceId === id);
}

function receipt(id, value = receipts) {
  return value.receipts.find((item) => item.receiptId === id);
}

function completeReceiptEvidence(item, index) {
  item.status = 'CONTROLLED_RECEIPT_VERIFIED';
  item.secureStorageRef = `secure://controlled/${index}`;
  item.documentSha256 = `sha256:${String(index + 1).repeat(64)}`;
  item.exactLocators = [`CONTROLLED-LOCATOR-${index + 1}`];
  item.verifiedBy = 'Source Verifier A';
  item.verifiedAt = '2026-08-19T10:00:00Z';
  item.independentCheckBy = 'Independent Checker B';
  item.independentCheckedAt = '2026-08-19T11:00:00Z';
}

function reconcileSources(ledger) {
  for (const sourceId of Object.values(KD320_Q1_CONTROLLED_SOURCE_BINDINGS)) {
    source(sourceId, ledger).status = 'CONTROLLED_SOURCE_RECONCILED';
  }
}

test('Q1 has one distinct restricted controlled source for each required receipt', () => {
  assert.deepEqual(KD320_Q1_CONTROLLED_SOURCE_BINDINGS, {
    'Q1-SRC-B313-2024': 'SRC-B313-2024-CONTROLLED',
    'Q1-SRC-VIII3-2025': 'SRC-VIII3-2025-CONTROLLED',
  });
  const result = audit();
  assert.equal(result.ok, true, result.blockers.join('\n'));
  assert.equal(result.sourceCustodyComplete, false);
  for (const [receiptId, sourceId] of Object.entries(KD320_Q1_CONTROLLED_SOURCE_BINDINGS)) {
    assert.equal(receipt(receiptId).controlledLedgerSourceRef, sourceId);
    assert.equal(source(sourceId).receiptRef, receiptId);
    assert.equal(source(sourceId).sourceType, 'LICENSED_RESTRICTED_CONTROLLED');
    assert.equal(source(sourceId).publicRepositoryContentAllowed, false);
  }
});

test('B31.3 controlled-source identity is not inferred from public ASME identity', () => {
  const controlled = source('SRC-B313-2024-CONTROLLED');
  assert.equal(controlled.publisher, 'ASME');
  assert.equal(controlled.storageClass, 'SECURE_STORE');
  assert.equal(controlled.licenseClass, 'LICENSED_RESTRICTED');
  assert.equal(controlled.status, 'PENDING_SECURE_HASH_AND_LOCATOR_RECONCILIATION');
  assert.equal(controlled.formulaOracle, false);
  assert.equal(controlled.fatigueCurveOracle, false);
});

test('missing B31.3 controlled source fails closed', () => {
  const altered = structuredClone(sourceLedger);
  altered.sources = altered.sources.filter((item) => item.sourceId !== 'SRC-B313-2024-CONTROLLED');
  const result = audit({ sourceLedger: altered });
  assert.equal(result.ok, false);
  assert(result.blockers.includes('Q1-SRC-B313-2024:CONTROLLED_SOURCE_MISSING:SRC-B313-2024-CONTROLLED'));
});

test('receipt cannot omit or redirect controlled-ledger source identity', () => {
  for (const value of [null, 'SRC-VIII3-2025-CONTROLLED']) {
    const altered = structuredClone(receipts);
    receipt('Q1-SRC-B313-2024', altered).controlledLedgerSourceRef = value;
    const result = audit({ receipts: altered });
    assert.equal(result.ok, false);
    assert(result.blockers.includes('Q1-SRC-B313-2024:CONTROLLED_LEDGER_SOURCE_REF_MISMATCH'));
  }
});

test('controlled source must back-reference the exact receipt', () => {
  const altered = structuredClone(sourceLedger);
  source('SRC-B313-2024-CONTROLLED', altered).receiptRef = 'Q1-SRC-VIII3-2025';
  const result = audit({ sourceLedger: altered });
  assert.equal(result.ok, false);
  assert(result.blockers.includes('Q1-SRC-B313-2024:CONTROLLED_SOURCE_RECEIPT_BACKREF_MISMATCH'));
});

test('controlled source cannot be downgraded to public or public-content-allowed custody', () => {
  const typeAltered = structuredClone(sourceLedger);
  source('SRC-B313-2024-CONTROLLED', typeAltered).sourceType = 'PUBLIC_OFFICIAL_IDENTITY';
  assert(audit({ sourceLedger: typeAltered }).blockers.includes(
    'Q1-SRC-B313-2024:CONTROLLED_SOURCE_TYPE_INVALID'));

  const contentAltered = structuredClone(sourceLedger);
  source('SRC-B313-2024-CONTROLLED', contentAltered).publicRepositoryContentAllowed = true;
  assert(audit({ sourceLedger: contentAltered }).blockers.includes(
    'Q1-SRC-B313-2024:CONTROLLED_SOURCE_PUBLIC_CONTENT_MUST_BE_FALSE'));
});

test('verified receipt cannot coexist with unreconciled controlled-source status', () => {
  const altered = structuredClone(receipts);
  completeReceiptEvidence(receipt('Q1-SRC-B313-2024', altered), 0);
  const result = audit({ receipts: altered });
  assert.equal(result.ok, false);
  assert(result.blockers.includes('Q1-SRC-B313-2024:VERIFIED_RECEIPT_REQUIRES_RECONCILED_SOURCE'));
  assert.equal(result.sourceCustodyComplete, false);
});

test('terminal status strings without receipt evidence cannot complete source custody', () => {
  const alteredReceipts = structuredClone(receipts);
  const alteredLedger = structuredClone(sourceLedger);
  for (const item of alteredReceipts.receipts) item.status = 'CONTROLLED_RECEIPT_VERIFIED';
  reconcileSources(alteredLedger);
  const result = audit({ receipts: alteredReceipts, sourceLedger: alteredLedger });
  assert.equal(result.ok, false);
  assert.equal(result.sourceCustodyComplete, false);
  assert(result.blockers.includes('Q1-SRC-B313-2024:VERIFIED_RECEIPT_DOCUMENT_SHA256_INVALID'));
  assert(result.blockers.includes('Q1-SRC-VIII3-2025:VERIFIED_RECEIPT_EXACT_LOCATORS_MISSING'));
});

test('terminal status strings cannot override a structurally invalid binding', () => {
  const alteredReceipts = structuredClone(receipts);
  const alteredLedger = structuredClone(sourceLedger);
  alteredReceipts.receipts.forEach(completeReceiptEvidence);
  reconcileSources(alteredLedger);
  source('SRC-B313-2024-CONTROLLED', alteredLedger).receiptRef = 'Q1-SRC-VIII3-2025';
  const result = audit({ receipts: alteredReceipts, sourceLedger: alteredLedger });
  assert.equal(result.ok, false);
  assert.equal(result.sourceCustodyComplete, false);
  assert(result.blockers.includes('Q1-SRC-B313-2024:CONTROLLED_SOURCE_RECEIPT_BACKREF_MISMATCH'));
});

test('complete synthetic custody metadata can satisfy structure without granting KD320 authority', () => {
  const alteredReceipts = structuredClone(receipts);
  const alteredLedger = structuredClone(sourceLedger);
  alteredReceipts.receipts.forEach(completeReceiptEvidence);
  reconcileSources(alteredLedger);
  const result = audit({ receipts: alteredReceipts, sourceLedger: alteredLedger });
  assert.equal(result.ok, true, result.blockers.join('\n'));
  assert.equal(result.sourceCustodyComplete, true);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});

test('source custody cannot promote native KD320 authority', () => {
  const result = audit();
  assert.deepEqual(result.authority, {
    nativeCoreKd3Qualified: false,
    codeCompliance: false,
    canUseForDesignAuthority: false,
  });
  const sourceText = fs.readFileSync(
    path.join(q1, 'source-custody.js'), 'utf8');
  assert.doesNotMatch(sourceText, /nativeCoreKd3Qualified:\s*true/);
  assert.doesNotMatch(sourceText, /codeCompliance:\s*true/);
  assert.doesNotMatch(sourceText, /canUseForDesignAuthority:\s*true/);
});
