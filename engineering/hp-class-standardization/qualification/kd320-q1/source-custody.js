const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
});

export const KD320_Q1_CONTROLLED_SOURCE_BINDINGS = Object.freeze({
  'Q1-SRC-B313-2024': 'SRC-B313-2024-CONTROLLED',
  'Q1-SRC-VIII3-2025': 'SRC-VIII3-2025-CONTROLLED',
});

const RECEIPT_EXPECTATIONS = Object.freeze({
  'Q1-SRC-B313-2024': { standard: 'ASME B31.3', edition: '2024' },
  'Q1-SRC-VIII3-2025': { standard: 'ASME BPVC Section VIII Division 3', edition: '2025' },
});
const PENDING_RECEIPT = 'PENDING_CONTROLLED_SOURCE_RECEIPT';
const VERIFIED_RECEIPT = 'CONTROLLED_RECEIPT_VERIFIED';
const PENDING_SOURCE = 'PENDING_SECURE_HASH_AND_LOCATOR_RECONCILIATION';
const RECONCILED_SOURCE = 'CONTROLLED_SOURCE_RECONCILED';
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function text(value) {
  return String(value ?? '').trim();
}

function identity(value) {
  return text(value).toLowerCase();
}

function distinct(a, b) {
  return Boolean(text(a) && text(b) && identity(a) !== identity(b));
}

function mapUnique(items, key, duplicateCode, blockers) {
  const map = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const id = text(item?.[key]);
    if (!id || map.has(id)) {
      blockers.push(duplicateCode);
      return null;
    }
    map.set(id, item);
  }
  return map;
}

function authorityFalse(authority) {
  return Object.entries(AUTHORITY_FALSE).every(([key, value]) => authority?.[key] === value);
}

function requireReceipt(condition, receiptId, code, blockers) {
  if (!condition) blockers.push(`${receiptId}:${code}`);
  return Boolean(condition);
}

function pendingReceiptReady(receipt, receiptId, blockers) {
  let ready = true;
  for (const field of [
    'secureStorageRef', 'documentSha256', 'verifiedBy', 'verifiedAt',
    'independentCheckBy', 'independentCheckedAt',
  ]) {
    ready = requireReceipt(receipt[field] == null, receiptId,
      `PENDING_RECEIPT_${field.toUpperCase()}_MUST_BE_EMPTY`, blockers) && ready;
  }
  ready = requireReceipt(Array.isArray(receipt.exactLocators) && receipt.exactLocators.length === 0,
    receiptId, 'PENDING_RECEIPT_LOCATORS_MUST_BE_EMPTY', blockers) && ready;
  return ready;
}

function verifiedReceiptReady(receipt, receiptId, blockers) {
  let ready = true;
  ready = requireReceipt(Boolean(text(receipt.secureStorageRef)), receiptId,
    'VERIFIED_RECEIPT_SECURE_STORAGE_REF_MISSING', blockers) && ready;
  ready = requireReceipt(SHA256.test(text(receipt.documentSha256)), receiptId,
    'VERIFIED_RECEIPT_DOCUMENT_SHA256_INVALID', blockers) && ready;
  ready = requireReceipt(Array.isArray(receipt.exactLocators) && receipt.exactLocators.length > 0
    && receipt.exactLocators.every((value) => Boolean(text(value))), receiptId,
  'VERIFIED_RECEIPT_EXACT_LOCATORS_MISSING', blockers) && ready;
  ready = requireReceipt(Boolean(text(receipt.verifiedBy)) && ISO.test(text(receipt.verifiedAt)),
    receiptId, 'VERIFIED_RECEIPT_VERIFIER_CUSTODY_INCOMPLETE', blockers) && ready;
  ready = requireReceipt(distinct(receipt.verifiedBy, receipt.independentCheckBy)
    && ISO.test(text(receipt.independentCheckedAt)), receiptId,
  'VERIFIED_RECEIPT_INDEPENDENT_CHECK_INCOMPLETE', blockers) && ready;
  return ready;
}

function receiptContractReady(receipt, receiptId, blockers) {
  const expected = RECEIPT_EXPECTATIONS[receiptId];
  let ready = true;
  ready = requireReceipt(text(receipt.standard) === expected.standard, receiptId,
    'RECEIPT_STANDARD_MISMATCH', blockers) && ready;
  ready = requireReceipt(text(receipt.edition) === expected.edition, receiptId,
    'RECEIPT_EDITION_MISMATCH', blockers) && ready;
  ready = requireReceipt(text(receipt.storageClass) === 'SECURE_STORE', receiptId,
    'RECEIPT_STORAGE_CLASS_INVALID', blockers) && ready;
  ready = requireReceipt(text(receipt.licenseClass) === 'LICENSED_RESTRICTED', receiptId,
    'RECEIPT_LICENSE_CLASS_INVALID', blockers) && ready;
  ready = requireReceipt(receipt.publicRepositoryContentAllowed === false, receiptId,
    'RECEIPT_PUBLIC_CONTENT_MUST_BE_FALSE', blockers) && ready;

  if (receipt.status === PENDING_RECEIPT) return pendingReceiptReady(receipt, receiptId, blockers) && ready;
  if (receipt.status === VERIFIED_RECEIPT) return verifiedReceiptReady(receipt, receiptId, blockers) && ready;
  blockers.push(`${receiptId}:RECEIPT_STATUS_INVALID`);
  return false;
}

function sourceContractReady(source, receiptId, blockers) {
  const sourceId = KD320_Q1_CONTROLLED_SOURCE_BINDINGS[receiptId];
  let ready = true;
  const require = (condition, code) => {
    if (!condition) {
      blockers.push(`${receiptId}:${code}`);
      ready = false;
    }
  };

  require(Boolean(source), `CONTROLLED_SOURCE_MISSING:${sourceId}`);
  if (!source) return false;
  require(text(source.sourceType) === 'LICENSED_RESTRICTED_CONTROLLED', 'CONTROLLED_SOURCE_TYPE_INVALID');
  require(text(source.publisher) === 'ASME', 'CONTROLLED_SOURCE_PUBLISHER_INVALID');
  require(text(source.storageClass) === 'SECURE_STORE', 'CONTROLLED_SOURCE_STORAGE_CLASS_INVALID');
  require(text(source.licenseClass) === 'LICENSED_RESTRICTED', 'CONTROLLED_SOURCE_LICENSE_CLASS_INVALID');
  require(text(source.receiptRef) === receiptId, 'CONTROLLED_SOURCE_RECEIPT_BACKREF_MISMATCH');
  require(source.publicRepositoryContentAllowed === false, 'CONTROLLED_SOURCE_PUBLIC_CONTENT_MUST_BE_FALSE');
  require(source.formulaOracle === false, 'CONTROLLED_SOURCE_FORMULA_ORACLE_MUST_BE_FALSE');
  require(source.fatigueCurveOracle === false, 'CONTROLLED_SOURCE_CURVE_ORACLE_MUST_BE_FALSE');
  return ready;
}

function receiptSourceStatusReady(receipt, source, blockers) {
  const receiptId = text(receipt.receiptId);
  if (!source) return false;
  if (receipt.status === PENDING_RECEIPT && source.status !== PENDING_SOURCE) {
    blockers.push(`${receiptId}:PENDING_RECEIPT_SOURCE_STATUS_MISMATCH`);
    return false;
  }
  if (receipt.status === VERIFIED_RECEIPT && source.status !== RECONCILED_SOURCE) {
    blockers.push(`${receiptId}:VERIFIED_RECEIPT_REQUIRES_RECONCILED_SOURCE`);
    return false;
  }
  return true;
}

export function auditKd320Q1SourceCustody({ receipts = {}, sourceLedger = {} } = {}) {
  const blockers = [];
  if (!authorityFalse(receipts.authority)) blockers.push('Q1_RECEIPT_AUTHORITY_MUST_REMAIN_FALSE');
  if (!authorityFalse(sourceLedger.authority)) blockers.push('Q1_SOURCE_LEDGER_AUTHORITY_MUST_REMAIN_FALSE');

  const receiptMap = mapUnique(receipts.receipts, 'receiptId', 'Q1_RECEIPT_SET_DUPLICATE_OR_INVALID', blockers);
  const sourceMap = mapUnique(sourceLedger.sources, 'sourceId', 'Q1_SOURCE_SET_DUPLICATE_OR_INVALID', blockers);
  if (!receiptMap || !sourceMap) {
    return { ok: false, blockers: [...new Set(blockers)], sourceCustodyComplete: false, authority: { ...AUTHORITY_FALSE } };
  }

  const usedSources = new Set();
  for (const [receiptId, expectedSourceId] of Object.entries(KD320_Q1_CONTROLLED_SOURCE_BINDINGS)) {
    const receipt = receiptMap.get(receiptId);
    if (!receipt) {
      blockers.push(`${receiptId}:RECEIPT_MISSING`);
      continue;
    }
    receiptContractReady(receipt, receiptId, blockers);
    if (text(receipt.controlledLedgerSourceRef) !== expectedSourceId) {
      blockers.push(`${receiptId}:CONTROLLED_LEDGER_SOURCE_REF_MISMATCH`);
    }
    if (usedSources.has(text(receipt.controlledLedgerSourceRef))) {
      blockers.push(`${receiptId}:CONTROLLED_LEDGER_SOURCE_REUSED`);
    }
    usedSources.add(text(receipt.controlledLedgerSourceRef));

    const source = sourceMap.get(expectedSourceId);
    sourceContractReady(source, receiptId, blockers);
    receiptSourceStatusReady(receipt, source, blockers);
  }

  const statusesComplete = Object.keys(KD320_Q1_CONTROLLED_SOURCE_BINDINGS).every((receiptId) =>
    receiptMap.get(receiptId)?.status === VERIFIED_RECEIPT
    && sourceMap.get(KD320_Q1_CONTROLLED_SOURCE_BINDINGS[receiptId])?.status === RECONCILED_SOURCE);
  const ok = blockers.length === 0;

  return {
    ok,
    blockers: [...new Set(blockers)],
    bindings: { ...KD320_Q1_CONTROLLED_SOURCE_BINDINGS },
    sourceCustodyComplete: ok && statusesComplete,
    authority: { ...AUTHORITY_FALSE },
  };
}

export const KD320_Q1_SOURCE_CUSTODY_AUTHORITY = AUTHORITY_FALSE;
