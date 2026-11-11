import {
  getKd320EvidenceCsvTemplate as getLegacyTemplate,
  KD320_CSV_MODES as LEGACY_MODES,
  previewKd320EvidenceCsv as previewLegacyCsv,
} from './csv-intake.js';
import {
  evaluateKd320Q2AdmissionCandidate,
  KD320_Q2_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_SEMANTICS,
  KD320_Q2_TARGET,
} from './intake.js';
import {
  evaluateKd320EditionReconciliation,
  KD320_EDITION_RECONCILIATION_SCHEMA,
  KD320_EDITION_RECONCILIATION_SEMANTICS,
  KD320_EDITION_RECONCILIATION_TARGET,
} from './edition-reconciliation/evaluator.js';

export const KD320_CSV_MODES = Object.freeze({
  CONTROLLED_SOURCE: 'CONTROLLED_SOURCE',
  EDITION_SEMANTIC: 'EDITION_SEMANTIC',
  QF022_ORACLE: 'QF022_ORACLE',
  QF023_PROJECT_CALC: 'QF023_PROJECT_CALC',
  PROJECT: 'QF023_PROJECT_CALC',
  PUBLISHED: 'QF022_ORACLE',
});

const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
  productionKernelAllowed: false,
  automaticPromotionAllowed: false,
});
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SOURCE_EXPECTATIONS = Object.freeze({
  'Q1-SRC-B313-2024': { standard: 'ASME B31.3', edition: '2024' },
  'Q1-SRC-VIII3-2025': { standard: 'ASME BPVC Section VIII Division 3', edition: '2025' },
});

export const KD320_CONTROLLED_SOURCE_CSV_HEADERS = Object.freeze([
  'receipt_id', 'standard', 'edition', 'secure_storage_ref', 'document_sha256', 'exact_locators',
  'verified_by', 'verified_at', 'independent_check_by', 'independent_checked_at',
]);
export const KD320_EDITION_SEMANTIC_CSV_HEADERS = Object.freeze([
  'reference_id', 'source_code_edition', 'target_viii3_edition', 'bibliographic_ref', 'exact_locator',
  'source_sha256', 'controlled_2025_secure_storage_ref', 'controlled_2025_document_sha256', 'semantic_id',
  'source_locator', 'target_controlled_locator', 'controlled_semantic_ref', 'comparison_status',
  'compared_by', 'compared_at', 'independent_check_by', 'independent_checked_at',
]);

function text(value) { return String(value ?? '').trim(); }
function identity(value) { return text(value).toLowerCase(); }
function list(value) { return text(value).split(';').map((item) => item.trim()).filter(Boolean); }
function issue(row, code, field, message) { return { row, code, field, message }; }
function validTimestamp(value) { return ISO.test(text(value)); }
function distinct(a, b) { return Boolean(text(a) && text(b) && identity(a) !== identity(b)); }

function parseCsv(source) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  const input = String(source ?? '').replace(/\r/g, '');
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted && ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === ',') { row.push(cell); cell = ''; }
    else if (!quoted && ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (quoted) throw new Error('CSV_QUOTE_UNTERMINATED');
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const nonBlank = rows.filter((values) => values.some((value) => text(value)));
  if (!nonBlank.length) return { headers: [], records: [] };
  const headers = nonBlank[0].map((value, index) => index === 0 ? text(value).replace(/^\uFEFF/, '') : text(value));
  return { headers, records: nonBlank.slice(1).map((values) => Object.fromEntries(headers.map((key, i) => [key, values[i] ?? '']))) };
}

function fileContract(parsed, headers) {
  const fileIssues = [];
  const actual = new Set(parsed.headers);
  const expected = new Set(headers);
  const missing = headers.filter((header) => !actual.has(header));
  const unknown = parsed.headers.filter((header) => !expected.has(header));
  if (missing.length) fileIssues.push(issue(0, 'CSV_HEADERS_MISSING', 'header', `Missing: ${missing.join(', ')}`));
  if (unknown.length) fileIssues.push(issue(0, 'CSV_HEADERS_UNKNOWN', 'header', `Unknown: ${unknown.join(', ')}`));
  if (!parsed.records.length) fileIssues.push(issue(0, 'CSV_DATA_ROWS_MISSING', 'file', 'At least one data row is required.'));
  return fileIssues;
}

function parseForMode(source, headers, mode) {
  try {
    const parsed = parseCsv(source);
    return { parsed, fileIssues: fileContract(parsed, headers) };
  } catch (error) {
    return { parsed: null, fileIssues: [issue(0, 'CSV_PARSE_INVALID', 'file', String(error?.message || error))], mode };
  }
}

function pendingSemantics() {
  return KD320_Q2_REQUIRED_SEMANTICS.map((semanticId, index) => ({
    semanticId,
    status: 'PENDING_CONTROLLED_SOURCE',
    controlledSourceRef: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
    exactSourceLocator: null,
    controlledSemanticRef: null,
    units: null,
    signConvention: null,
    selectionRule: null,
    interpolationRule: null,
    applicabilityRule: null,
    extractedBy: null,
    extractedAt: null,
    independentCheckBy: null,
    independentCheckedAt: null,
  }));
}

function q2Candidate(sourceReceipts) {
  return {
    schema: 'kd320-q2-admission-candidate/v1',
    target: { ...KD320_Q2_TARGET },
    authority: { ...AUTHORITY_FALSE },
    sourceReceipts,
    semanticItems: pendingSemantics(),
    projectOracle: null,
    publishedOracle: null,
  };
}

function required(row, field, rowNumber, issues) {
  const value = text(row[field]);
  if (!value) issues.push(issue(rowNumber, 'REQUIRED_FIELD_MISSING', field, `${field} is required.`));
  return value;
}

function sourceRow(row, rowNumber) {
  const issues = [];
  const receiptId = required(row, 'receipt_id', rowNumber, issues);
  const standard = required(row, 'standard', rowNumber, issues);
  const edition = required(row, 'edition', rowNumber, issues);
  const expected = SOURCE_EXPECTATIONS[receiptId];
  if (!expected) issues.push(issue(rowNumber, 'CONTROLLED_SOURCE_RECEIPT_ID_INVALID', 'receipt_id', 'Receipt ID is not part of the Q1 controlled-source set.'));
  if (expected && standard !== expected.standard) issues.push(issue(rowNumber, 'CONTROLLED_SOURCE_STANDARD_MISMATCH', 'standard', `Expected ${expected.standard}.`));
  if (expected && edition !== expected.edition) issues.push(issue(rowNumber, 'CONTROLLED_SOURCE_EDITION_MISMATCH', 'edition', `Expected edition ${expected.edition}.`));
  const secureStorageRef = required(row, 'secure_storage_ref', rowNumber, issues);
  const documentSha256 = required(row, 'document_sha256', rowNumber, issues);
  if (documentSha256 && !SHA256.test(documentSha256)) issues.push(issue(rowNumber, 'DOCUMENT_SHA256_INVALID', 'document_sha256', 'Use sha256:<64 lowercase hex>.'));
  const exactLocators = list(row.exact_locators);
  if (!exactLocators.length) issues.push(issue(rowNumber, 'EXACT_LOCATORS_MISSING', 'exact_locators', 'At least one controlled locator is required.'));
  const verifiedBy = required(row, 'verified_by', rowNumber, issues);
  const verifiedAt = required(row, 'verified_at', rowNumber, issues);
  const independentCheckBy = required(row, 'independent_check_by', rowNumber, issues);
  const independentCheckedAt = required(row, 'independent_checked_at', rowNumber, issues);
  if (verifiedAt && !validTimestamp(verifiedAt)) issues.push(issue(rowNumber, 'VERIFIED_AT_INVALID', 'verified_at', 'ISO-8601 UTC timestamp required.'));
  if (independentCheckedAt && !validTimestamp(independentCheckedAt)) issues.push(issue(rowNumber, 'INDEPENDENT_CHECKED_AT_INVALID', 'independent_checked_at', 'ISO-8601 UTC timestamp required.'));
  if (!distinct(verifiedBy, independentCheckBy)) issues.push(issue(rowNumber, 'INDEPENDENT_CHECK_IDENTITY_REQUIRED', 'verified_by/independent_check_by', 'Verifier and checker must be distinct.'));
  const evidence = { receiptId, status: 'VERIFIED', secureStorageRef, documentSha256, exactLocators, verifiedBy, verifiedAt, independentCheckBy, independentCheckedAt };
  return { rowNumber, ok: issues.length === 0, preflightState: issues.length ? 'CSV_CONTRACT_BLOCKED' : 'CONTROLLED_SOURCE_RECEIPT_READY_FOR_Q1_CANDIDATE', issues, evidence, authority: { ...AUTHORITY_FALSE } };
}

function sourceSetIssues(rows) {
  const ids = rows.map((row) => text(row.evidence?.receiptId)).filter(Boolean);
  const issues = [];
  for (const id of KD320_Q2_REQUIRED_RECEIPTS) {
    const count = ids.filter((value) => value === id).length;
    if (count === 0) issues.push(issue(0, 'CONTROLLED_SOURCE_RECEIPT_MISSING', 'receipt_id', `Missing ${id}.`));
    if (count > 1) issues.push(issue(0, 'CONTROLLED_SOURCE_RECEIPT_DUPLICATE', 'receipt_id', `Duplicate ${id}.`));
  }
  return issues;
}

function previewControlledSource(source) {
  const { parsed, fileIssues } = parseForMode(source, KD320_CONTROLLED_SOURCE_CSV_HEADERS, KD320_CSV_MODES.CONTROLLED_SOURCE);
  if (!parsed || fileIssues.length) return { ok: false, mode: KD320_CSV_MODES.CONTROLLED_SOURCE, fileIssues, rows: [], authority: { ...AUTHORITY_FALSE } };
  const rows = parsed.records.map((row, index) => sourceRow(row, index + 2));
  const setIssues = sourceSetIssues(rows);
  const admission = setIssues.length ? null : evaluateKd320Q2AdmissionCandidate(q2Candidate(rows.map((row) => row.evidence)));
  const enriched = rows.map((row) => ({ ...row, admission, editionReconciliation: null }));
  return { ok: !setIssues.length && enriched.every((row) => row.ok), mode: KD320_CSV_MODES.CONTROLLED_SOURCE, fileIssues: setIssues, rows: enriched, admission, authority: { ...AUTHORITY_FALSE } };
}

function editionRow(row, rowNumber) {
  const issues = [];
  const semanticId = required(row, 'semantic_id', rowNumber, issues);
  const referenceId = required(row, 'reference_id', rowNumber, issues);
  const sourceEdition = required(row, 'source_code_edition', rowNumber, issues);
  const targetEdition = required(row, 'target_viii3_edition', rowNumber, issues);
  if (referenceId && referenceId !== 'PVP2025-154710') issues.push(issue(rowNumber, 'EDITION_REFERENCE_ID_UNSUPPORTED', 'reference_id', 'Edition reconciliation is qualified only for PVP2025-154710.'));
  if (sourceEdition && sourceEdition !== '2023') issues.push(issue(rowNumber, 'SOURCE_EDITION_MUST_BE_2023', 'source_code_edition', 'Source edition must be 2023.'));
  if (targetEdition && targetEdition !== '2025') issues.push(issue(rowNumber, 'TARGET_EDITION_MUST_BE_2025', 'target_viii3_edition', 'Target edition must be 2025.'));
  for (const field of ['bibliographic_ref', 'exact_locator', 'source_sha256', 'controlled_2025_secure_storage_ref', 'controlled_2025_document_sha256', 'source_locator', 'target_controlled_locator', 'controlled_semantic_ref', 'comparison_status', 'compared_by', 'compared_at', 'independent_check_by', 'independent_checked_at']) required(row, field, rowNumber, issues);
  if (text(row.source_sha256) && !SHA256.test(text(row.source_sha256))) issues.push(issue(rowNumber, 'SOURCE_SHA256_INVALID', 'source_sha256', 'Use sha256:<64 lowercase hex>.'));
  if (text(row.controlled_2025_document_sha256) && !SHA256.test(text(row.controlled_2025_document_sha256))) issues.push(issue(rowNumber, 'CONTROLLED_2025_DOCUMENT_SHA256_INVALID', 'controlled_2025_document_sha256', 'Use sha256:<64 lowercase hex>.'));
  if (text(row.compared_at) && !validTimestamp(row.compared_at)) issues.push(issue(rowNumber, 'COMPARED_AT_INVALID', 'compared_at', 'ISO-8601 UTC timestamp required.'));
  if (text(row.independent_checked_at) && !validTimestamp(row.independent_checked_at)) issues.push(issue(rowNumber, 'INDEPENDENT_CHECKED_AT_INVALID', 'independent_checked_at', 'ISO-8601 UTC timestamp required.'));
  if (!distinct(row.compared_by, row.independent_check_by)) issues.push(issue(rowNumber, 'INDEPENDENT_CHECK_IDENTITY_REQUIRED', 'compared_by/independent_check_by', 'Comparator and checker must be distinct.'));
  const evidence = {
    semanticId, sourceEdition, targetEdition,
    sourceLocator: text(row.source_locator), targetControlledLocator: text(row.target_controlled_locator),
    controlledSemanticRef: text(row.controlled_semantic_ref), comparisonStatus: text(row.comparison_status),
    comparedBy: text(row.compared_by), comparedAt: text(row.compared_at),
    independentCheckBy: text(row.independent_check_by), independentCheckedAt: text(row.independent_checked_at),
  };
  return { rowNumber, ok: issues.length === 0, preflightState: issues.length ? 'CSV_CONTRACT_BLOCKED' : 'EDITION_SEMANTIC_READY_FOR_RECONCILIATION', issues, evidence, raw: row, authority: { ...AUTHORITY_FALSE } };
}

function editionSetIssues(rows) {
  const ids = rows.map((row) => row.evidence.semanticId).filter(Boolean);
  const issues = [];
  for (const id of KD320_EDITION_RECONCILIATION_SEMANTICS) {
    const count = ids.filter((value) => value === id).length;
    if (count === 0) issues.push(issue(0, 'EDITION_SEMANTIC_MISSING', 'semantic_id', `Missing ${id}.`));
    if (count > 1) issues.push(issue(0, 'EDITION_SEMANTIC_DUPLICATE', 'semantic_id', `Duplicate ${id}.`));
  }
  for (const id of ids) if (!KD320_EDITION_RECONCILIATION_SEMANTICS.includes(id)) issues.push(issue(0, 'EDITION_SEMANTIC_UNKNOWN', 'semantic_id', `Unexpected ${id}.`));
  return issues;
}

function editionCandidate(rows) {
  const first = rows[0]?.raw ?? {};
  return {
    schema: KD320_EDITION_RECONCILIATION_SCHEMA,
    target: { ...KD320_EDITION_RECONCILIATION_TARGET },
    authority: { targetQf022Ready: false, q2OracleAdmissionReady: false, ...AUTHORITY_FALSE },
    sourceEvidence: {
      referenceId: text(first.reference_id), sourceCodeEdition: text(first.source_code_edition),
      bibliographicRef: text(first.bibliographic_ref), exactLocator: text(first.exact_locator), paperSha256: text(first.source_sha256),
    },
    targetEvidence: {
      controlledSourceRef: 'Q1-SRC-VIII3-2025', secureStorageRef: text(first.controlled_2025_secure_storage_ref),
      documentSha256: text(first.controlled_2025_document_sha256),
    },
    semanticReconciliation: rows.map((row) => row.evidence),
  };
}

function contextIssues(rows) {
  const fields = ['reference_id', 'source_code_edition', 'target_viii3_edition', 'bibliographic_ref', 'exact_locator', 'source_sha256', 'controlled_2025_secure_storage_ref', 'controlled_2025_document_sha256'];
  if (!rows.length) return [];
  return fields.filter((field) => rows.some((row) => text(row.raw[field]) !== text(rows[0].raw[field])))
    .map((field) => issue(0, 'EDITION_CONTEXT_INCONSISTENT', field, `${field} must be identical on all edition-semantic rows.`));
}

function previewEditionSemantic(source) {
  const { parsed, fileIssues } = parseForMode(source, KD320_EDITION_SEMANTIC_CSV_HEADERS, KD320_CSV_MODES.EDITION_SEMANTIC);
  if (!parsed || fileIssues.length) return { ok: false, mode: KD320_CSV_MODES.EDITION_SEMANTIC, fileIssues, rows: [], authority: { ...AUTHORITY_FALSE } };
  const rows = parsed.records.map((row, index) => editionRow(row, index + 2));
  const contractIssues = [...editionSetIssues(rows), ...contextIssues(rows)];
  const editionReconciliation = evaluateKd320EditionReconciliation(editionCandidate(rows));
  const enriched = rows.map((row) => ({ ...row, oracle: null, admission: null, editionReconciliation }));
  return { ok: !contractIssues.length && enriched.every((row) => row.ok), mode: KD320_CSV_MODES.EDITION_SEMANTIC, fileIssues: contractIssues, rows: enriched, editionReconciliation, authority: { ...AUTHORITY_FALSE } };
}

function delegatedPreview(source, mode, legacyMode) {
  const result = previewLegacyCsv(source, legacyMode);
  return { ...result, mode, delegatedMode: legacyMode, recordClass: mode };
}

export function previewKd320EvidenceCsv(source, mode) {
  if (mode === KD320_CSV_MODES.CONTROLLED_SOURCE) return previewControlledSource(source);
  if (mode === KD320_CSV_MODES.EDITION_SEMANTIC) return previewEditionSemantic(source);
  if (mode === KD320_CSV_MODES.QF022_ORACLE) return delegatedPreview(source, mode, LEGACY_MODES.PUBLISHED);
  if (mode === KD320_CSV_MODES.QF023_PROJECT_CALC) return delegatedPreview(source, mode, LEGACY_MODES.PROJECT);
  return { ok: false, mode, fileIssues: [issue(0, 'CSV_MODE_INVALID', 'mode', 'Unsupported CSV record class.')], rows: [], authority: { ...AUTHORITY_FALSE } };
}

function csvEscape(value) {
  const valueText = String(value ?? '');
  return /[",\n]/.test(valueText) ? `"${valueText.replaceAll('"', '""')}"` : valueText;
}
function csvLine(headers, row) { return headers.map((header) => csvEscape(row[header] ?? '')).join(','); }

export function getKd320EvidenceCsvTemplate(mode) {
  if (mode === KD320_CSV_MODES.QF022_ORACLE) return getLegacyTemplate(LEGACY_MODES.PUBLISHED);
  if (mode === KD320_CSV_MODES.QF023_PROJECT_CALC) return getLegacyTemplate(LEGACY_MODES.PROJECT);
  if (mode === KD320_CSV_MODES.CONTROLLED_SOURCE) {
    const rows = Object.entries(SOURCE_EXPECTATIONS).map(([receipt_id, value]) => ({ receipt_id, standard: value.standard, edition: value.edition }));
    return `${KD320_CONTROLLED_SOURCE_CSV_HEADERS.join(',')}\n${rows.map((row) => csvLine(KD320_CONTROLLED_SOURCE_CSV_HEADERS, row)).join('\n')}\n`;
  }
  if (mode === KD320_CSV_MODES.EDITION_SEMANTIC) {
    const rows = KD320_EDITION_RECONCILIATION_SEMANTICS.map((semantic_id) => ({ reference_id: 'PVP2025-154710', source_code_edition: '2023', target_viii3_edition: '2025', semantic_id }));
    return `${KD320_EDITION_SEMANTIC_CSV_HEADERS.join(',')}\n${rows.map((row) => csvLine(KD320_EDITION_SEMANTIC_CSV_HEADERS, row)).join('\n')}\n`;
  }
  throw new Error(`Unsupported KD320 CSV mode: ${mode}`);
}
