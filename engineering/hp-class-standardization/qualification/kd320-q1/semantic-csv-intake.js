import {
  evaluateKd320Q2AdmissionCandidate,
  KD320_Q2_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_SEMANTICS,
  KD320_Q2_TARGET,
} from '../kd320-q2/intake.js';

const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
  productionKernelAllowed: false,
  automaticPromotionAllowed: false,
});
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const EXPECTED_SOURCE = Object.freeze(Object.fromEntries(
  KD320_Q2_REQUIRED_SEMANTICS.map((id, index) => [
    id, index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
  ]),
));

export const KD320_Q1_SEMANTIC_CSV_HEADERS = Object.freeze([
  'semantic_id', 'controlled_source_ref', 'exact_source_locator', 'controlled_semantic_ref',
  'units', 'sign_convention', 'selection_rule', 'interpolation_rule', 'applicability_rule',
  'extracted_by', 'extracted_at', 'independent_check_by', 'independent_checked_at',
]);

function text(value) { return String(value ?? '').trim(); }
function identity(value) { return text(value).toLowerCase(); }
function issue(row, code, field, message) { return { row, code, field, message }; }
function distinct(a, b) { return Boolean(text(a) && text(b) && identity(a) !== identity(b)); }
function validTimestamp(value) { return ISO.test(text(value)); }

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
  const headers = nonBlank[0].map((value, index) =>
    index === 0 ? text(value).replace(/^\uFEFF/, '') : text(value));
  return {
    headers,
    records: nonBlank.slice(1).map((values) => Object.fromEntries(
      headers.map((header, index) => [header, values[index] ?? '']))),
  };
}

function fileContract(parsed) {
  const actual = new Set(parsed.headers);
  const expected = new Set(KD320_Q1_SEMANTIC_CSV_HEADERS);
  const issues = [];
  const missing = KD320_Q1_SEMANTIC_CSV_HEADERS.filter((header) => !actual.has(header));
  const unknown = parsed.headers.filter((header) => !expected.has(header));
  if (missing.length) issues.push(issue(0, 'CSV_HEADERS_MISSING', 'header', `Missing: ${missing.join(', ')}`));
  if (unknown.length) issues.push(issue(0, 'CSV_HEADERS_UNKNOWN', 'header', `Unknown: ${unknown.join(', ')}`));
  if (!parsed.records.length) issues.push(issue(0, 'CSV_DATA_ROWS_MISSING', 'file', 'At least one data row is required.'));
  return issues;
}

function required(row, field, rowNumber, issues) {
  const value = text(row[field]);
  if (!value) issues.push(issue(rowNumber, 'REQUIRED_FIELD_MISSING', field, `${field} is required.`));
  return value;
}

function semanticRow(row, rowNumber) {
  const issues = [];
  const semanticId = required(row, 'semantic_id', rowNumber, issues);
  const controlledSourceRef = required(row, 'controlled_source_ref', rowNumber, issues);
  const expectedSource = EXPECTED_SOURCE[semanticId];
  if (!expectedSource) {
    issues.push(issue(rowNumber, 'Q1_SEMANTIC_ID_INVALID', 'semantic_id', 'Semantic ID is not part of KD320-SEM-001 through KD320-SEM-014.'));
  } else if (controlledSourceRef !== expectedSource) {
    issues.push(issue(rowNumber, 'Q1_SEMANTIC_SOURCE_BINDING_MISMATCH', 'controlled_source_ref', `Expected ${expectedSource}.`));
  }
  const evidence = {
    semanticId,
    status: 'INDEPENDENTLY_CHECKED',
    controlledSourceRef,
    exactSourceLocator: required(row, 'exact_source_locator', rowNumber, issues),
    controlledSemanticRef: required(row, 'controlled_semantic_ref', rowNumber, issues),
    units: required(row, 'units', rowNumber, issues),
    signConvention: required(row, 'sign_convention', rowNumber, issues),
    selectionRule: required(row, 'selection_rule', rowNumber, issues),
    interpolationRule: required(row, 'interpolation_rule', rowNumber, issues),
    applicabilityRule: required(row, 'applicability_rule', rowNumber, issues),
    extractedBy: required(row, 'extracted_by', rowNumber, issues),
    extractedAt: required(row, 'extracted_at', rowNumber, issues),
    independentCheckBy: required(row, 'independent_check_by', rowNumber, issues),
    independentCheckedAt: required(row, 'independent_checked_at', rowNumber, issues),
    independentlyChecked: true,
  };
  if (evidence.extractedAt && !validTimestamp(evidence.extractedAt)) {
    issues.push(issue(rowNumber, 'EXTRACTED_AT_INVALID', 'extracted_at', 'ISO-8601 UTC timestamp required.'));
  }
  if (evidence.independentCheckedAt && !validTimestamp(evidence.independentCheckedAt)) {
    issues.push(issue(rowNumber, 'INDEPENDENT_CHECKED_AT_INVALID', 'independent_checked_at', 'ISO-8601 UTC timestamp required.'));
  }
  if (!distinct(evidence.extractedBy, evidence.independentCheckBy)) {
    issues.push(issue(rowNumber, 'INDEPENDENT_CHECK_IDENTITY_REQUIRED', 'extracted_by/independent_check_by', 'Extractor and checker must be distinct.'));
  }
  return {
    rowNumber,
    ok: issues.length === 0,
    preflightState: issues.length ? 'CSV_CONTRACT_BLOCKED' : 'Q1_SEMANTIC_READY_FOR_CONTROLLED_EVIDENCE_JOIN',
    issues,
    evidence,
    authority: { ...AUTHORITY_FALSE },
  };
}

function semanticSetIssues(rows) {
  const ids = rows.map((row) => text(row.evidence?.semanticId)).filter(Boolean);
  const issues = [];
  for (const id of KD320_Q2_REQUIRED_SEMANTICS) {
    const count = ids.filter((value) => value === id).length;
    if (count === 0) issues.push(issue(0, 'Q1_SEMANTIC_MISSING', 'semantic_id', `Missing ${id}.`));
    if (count > 1) issues.push(issue(0, 'Q1_SEMANTIC_DUPLICATE', 'semantic_id', `Duplicate ${id}.`));
  }
  for (const id of ids) {
    if (!KD320_Q2_REQUIRED_SEMANTICS.includes(id)) {
      issues.push(issue(0, 'Q1_SEMANTIC_UNKNOWN', 'semantic_id', `Unexpected ${id}.`));
    }
  }
  return issues;
}

function pendingReceipts() {
  return KD320_Q2_REQUIRED_RECEIPTS.map((receiptId) => ({
    receiptId,
    status: 'PENDING_CONTROLLED_SOURCE_RECEIPT',
    secureStorageRef: null,
    documentSha256: null,
    exactLocators: [],
    verifiedBy: null,
    verifiedAt: null,
    independentCheckBy: null,
    independentCheckedAt: null,
  }));
}

function admissionCandidate(semanticItems) {
  return {
    schema: 'kd320-q2-admission-candidate/v1',
    target: { ...KD320_Q2_TARGET },
    authority: { ...AUTHORITY_FALSE },
    sourceReceipts: pendingReceipts(),
    semanticItems,
    projectOracle: null,
    publishedOracle: null,
  };
}

export function previewKd320Q1SemanticCsv(source) {
  let parsed;
  try { parsed = parseCsv(source); }
  catch (error) {
    return { ok: false, fileIssues: [issue(0, 'CSV_PARSE_INVALID', 'file', String(error?.message || error))], rows: [], authority: { ...AUTHORITY_FALSE } };
  }
  const headerIssues = fileContract(parsed);
  if (headerIssues.length) return { ok: false, fileIssues: headerIssues, rows: [], authority: { ...AUTHORITY_FALSE } };
  const rows = parsed.records.map((row, index) => semanticRow(row, index + 2));
  const setIssues = semanticSetIssues(rows);
  const semanticPackageReady = setIssues.length === 0 && rows.every((row) => row.ok);
  const admission = semanticPackageReady
    ? evaluateKd320Q2AdmissionCandidate(admissionCandidate(rows.map((row) => row.evidence)))
    : null;
  const enriched = rows.map((row) => ({ ...row, admission }));
  return {
    ok: semanticPackageReady,
    semanticPackageReady,
    fileIssues: setIssues,
    rows: enriched,
    admission,
    authority: { ...AUTHORITY_FALSE },
  };
}

function escapeCsv(value) {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export function getKd320Q1SemanticCsvTemplate() {
  const rows = KD320_Q2_REQUIRED_SEMANTICS.map((semanticId, index) => {
    const values = [semanticId, index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
      '', '', '', '', '', '', '', '', '', '', ''];
    return values.map(escapeCsv).join(',');
  });
  return `${KD320_Q1_SEMANTIC_CSV_HEADERS.join(',')}\n${rows.join('\n')}\n`;
}
