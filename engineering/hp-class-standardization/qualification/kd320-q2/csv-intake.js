import {
  evaluateKd320Q2AdmissionCandidate,
  KD320_Q2_METHOD_SEMANTICS,
  KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_SEMANTICS,
  KD320_Q2_TARGET,
} from './intake.js';
import {
  evaluateKd320EditionReconciliation,
  KD320_EDITION_RECONCILIATION_SCHEMA,
  KD320_EDITION_RECONCILIATION_TARGET,
} from './edition-reconciliation/evaluator.js';

export const KD320_CSV_MODES = Object.freeze({
  PROJECT: 'PROJECT_CHECKED_CALCULATION',
  PUBLISHED: 'PUBLISHED_NUMERICAL_ORACLE',
});

const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false, codeCompliance: false, canUseForDesignAuthority: false,
  productionKernelAllowed: false, automaticPromotionAllowed: false,
});
const SHA256 = /^sha256:[0-9a-f]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const PROJECT_SEMANTICS = Object.freeze([...KD320_Q2_METHOD_SEMANTICS]);
const PUBLISHED_SEMANTICS = Object.freeze([...KD320_Q2_METHOD_SEMANTICS]);
const PROJECT_HEADERS = Object.freeze([
  'calculation_ref', 'location_id', 'b313_edition', 'viii3_edition', 'salt_mpa',
  'associated_mean_stress_mpa', 'correction_parameters_json', 'seq_mpa',
  'permissible_cycles', 'calculated_by', 'calculated_at', 'checked_by', 'checked_at',
  'semantic_refs', 'source_receipt_refs',
]);
const PUBLISHED_HEADERS = Object.freeze([
  'reference_id', 'source_code_edition', 'target_viii3_edition', 'bibliographic_ref',
  'exact_locator', 'source_sha256', 'controlled_2025_secure_storage_ref',
  'controlled_2025_document_sha256', 'semantic_reconciliation_json', 'salt_mpa',
  'associated_mean_stress_mpa', 'correction_parameters_json', 'seq_mpa',
  'permissible_cycles', 'semantic_refs', 'source_receipt_refs',
  'extracted_by', 'extracted_at', 'admitted_by', 'admitted_at',
]);

function text(value) { return String(value ?? '').trim(); }
function identity(value) { return text(value).toLowerCase(); }
function list(value) { return text(value).split(';').map((item) => item.trim()).filter(Boolean); }
function number(value) { const raw = text(value); if (!raw) return null; const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : null; }
function issue(row, code, field, message) { return { row, code, field, message }; }

function parseDelimited(source) {
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
  return rows.filter((values) => values.some((value) => text(value)));
}

function parseCsvObjects(source) {
  const rows = parseDelimited(source);
  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0].map((value, index) =>
    index === 0 ? text(value).replace(/^\uFEFF/, '') : text(value));
  const records = rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ''])));
  return { headers, records };
}

function validateHeaders(headers, required) {
  const actual = new Set(headers);
  const requiredSet = new Set(required);
  return {
    missing: required.filter((header) => !actual.has(header)),
    unknown: headers.filter((header) => !requiredSet.has(header)),
  };
}

function requiredText(row, field, rowNumber, issues) {
  const value = text(row[field]);
  if (!value) issues.push(issue(rowNumber, 'REQUIRED_FIELD_MISSING', field, `${field} is required.`));
  return value;
}

function requiredNumber(row, field, rowNumber, issues, { positive = false } = {}) {
  const value = number(row[field]);
  if (value === null || (positive && !(value > 0))) {
    issues.push(issue(rowNumber, positive ? 'POSITIVE_NUMBER_REQUIRED' : 'FINITE_NUMBER_REQUIRED',
      field, `${field} must be ${positive ? '> 0' : 'finite'}.`));
  }
  return value;
}

function requiredTimestamp(row, field, rowNumber, issues) {
  const value = requiredText(row, field, rowNumber, issues);
  if (value && !ISO.test(value)) {
    issues.push(issue(rowNumber, 'ISO_UTC_TIMESTAMP_REQUIRED', field, `${field} must be ISO-8601 UTC.`));
  }
  return value;
}

function jsonArray(row, field, rowNumber, issues, { optional = false } = {}) {
  const raw = text(row[field]);
  if (!raw && optional) return [];
  if (!raw) { issues.push(issue(rowNumber, 'JSON_ARRAY_REQUIRED', field, `${field} is required.`)); return []; }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not array');
    return parsed;
  } catch {
    issues.push(issue(rowNumber, 'JSON_ARRAY_INVALID', field, `${field} must contain a JSON array.`));
    return [];
  }
}

function validateCorrectionParameters(parameters, rowNumber, issues) {
  if (!parameters.length) {
    issues.push(issue(rowNumber, 'CORRECTION_PARAMETERS_MISSING',
      'correction_parameters_json', 'At least one correction parameter is required.'));
  }
  for (const [index, parameter] of parameters.entries()) {
    const valid = text(parameter?.name) && Number.isFinite(parameter?.value) && text(parameter?.units)
      && KD320_Q2_METHOD_SEMANTICS.includes(text(parameter?.semanticRef));
    if (!valid) {
      issues.push(issue(rowNumber, 'CORRECTION_PARAMETER_INVALID', 'correction_parameters_json',
        `Correction parameter ${index + 1} is incomplete or has an invalid method semanticRef.`));
    }
  }
}

function chainFromRow(row, rowNumber, issues) {
  const correctionParameters = jsonArray(row, 'correction_parameters_json', rowNumber, issues);
  validateCorrectionParameters(correctionParameters, rowNumber, issues);
  return {
    alternatingStressIntensityMpa: requiredNumber(row, 'salt_mpa', rowNumber, issues, { positive: true }),
    associatedMeanStressMpa: requiredNumber(row, 'associated_mean_stress_mpa', rowNumber, issues),
    correctionParameters,
    equivalentAlternatingStressMpa: requiredNumber(row, 'seq_mpa', rowNumber, issues, { positive: true }),
    permissibleCycles: requiredNumber(row, 'permissible_cycles', rowNumber, issues, { positive: true }),
  };
}

function ensureDistinct(a, b, rowNumber, issues, fields, code) {
  if (text(a) && text(b) && identity(a) === identity(b)) {
    issues.push(issue(rowNumber, code, fields, 'Independent custody identities must be distinct.'));
  }
}

function requireSemanticRefs(actual, required, rowNumber, issues) {
  if (!required.every((id) => actual.includes(id))) {
    issues.push(issue(rowNumber, 'SEMANTIC_REFS_INCOMPLETE', 'semantic_refs',
      'KD320-SEM-002 through KD320-SEM-013 are required.'));
  }
  const invalid = actual.filter((id) => !KD320_Q2_REQUIRED_SEMANTICS.includes(id));
  if (invalid.length) {
    issues.push(issue(rowNumber, 'SEMANTIC_REFS_INVALID', 'semantic_refs',
      `Unknown semantic refs: ${invalid.join(', ')}.`));
  }
}

function requireReceiptRefs(actual, required, rowNumber, issues, message) {
  if (!required.every((id) => actual.includes(id))) {
    issues.push(issue(rowNumber, 'SOURCE_RECEIPT_REFS_INCOMPLETE', 'source_receipt_refs', message));
  }
  const invalid = actual.filter((id) => !KD320_Q2_REQUIRED_RECEIPTS.includes(id));
  if (invalid.length) {
    issues.push(issue(rowNumber, 'SOURCE_RECEIPT_REFS_INVALID', 'source_receipt_refs',
      `Unknown source receipt refs: ${invalid.join(', ')}.`));
  }
}

function pendingSourceReceipts() {
  return KD320_Q2_REQUIRED_RECEIPTS.map((receiptId) => ({
    receiptId, status: 'PENDING_CONTROLLED_SOURCE_RECEIPT', secureStorageRef: null,
    documentSha256: null, exactLocators: [], verifiedBy: null, verifiedAt: null,
    independentCheckBy: null, independentCheckedAt: null,
  }));
}

function pendingSemanticItems() {
  return KD320_Q2_REQUIRED_SEMANTICS.map((semanticId, index) => ({
    semanticId, status: 'PENDING_CONTROLLED_SOURCE',
    controlledSourceRef: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
    exactSourceLocator: null, controlledSemanticRef: null, approvedPublicParaphrase: null,
    units: null, signConvention: null, selectionRule: null, interpolationRule: null,
    applicabilityRule: null, extractedBy: null, extractedAt: null,
    independentCheckBy: null, independentCheckedAt: null,
  }));
}

function pendingQ2Candidate(overrides = {}) {
  return {
    schema: 'kd320-q2-admission-candidate/v1',
    target: { ...KD320_Q2_TARGET },
    authority: { ...AUTHORITY_FALSE },
    sourceReceipts: pendingSourceReceipts(),
    semanticItems: pendingSemanticItems(),
    projectOracle: null, publishedOracle: null, ...overrides,
  };
}

function projectOracle(row, rowNumber, issues) {
  const calculatedBy = requiredText(row, 'calculated_by', rowNumber, issues);
  const checkedBy = requiredText(row, 'checked_by', rowNumber, issues);
  ensureDistinct(calculatedBy, checkedBy, rowNumber, issues,
    'calculated_by/checked_by', 'INDEPENDENT_CHECK_IDENTITY_REQUIRED');
  const semanticRefs = list(row.semantic_refs);
  const receiptRefs = list(row.source_receipt_refs);
  requireSemanticRefs(semanticRefs, PROJECT_SEMANTICS, rowNumber, issues);
  requireReceiptRefs(receiptRefs, KD320_Q2_REQUIRED_RECEIPTS, rowNumber, issues,
    'Both controlled Q1 receipt refs are required.');
  const b313Edition = requiredText(row, 'b313_edition', rowNumber, issues);
  const viii3Edition = requiredText(row, 'viii3_edition', rowNumber, issues);
  if (b313Edition && b313Edition !== '2024') {
    issues.push(issue(rowNumber, 'B313_EDITION_MISMATCH', 'b313_edition', 'Target B31.3 edition is 2024.'));
  }
  if (viii3Edition && viii3Edition !== '2025') {
    issues.push(issue(rowNumber, 'VIII3_EDITION_MISMATCH', 'viii3_edition', 'Target VIII-3 edition is 2025.'));
  }
  return {
    benchmarkId: 'KD3-QF-023', calculationRef: requiredText(row, 'calculation_ref', rowNumber, issues),
    locationId: requiredText(row, 'location_id', rowNumber, issues), b313Edition, viii3Edition,
    controlledSourceReceiptRefs: receiptRefs, semanticRefs, chain: chainFromRow(row, rowNumber, issues),
    calculatedBy, calculatedAt: requiredTimestamp(row, 'calculated_at', rowNumber, issues),
    checkedBy, checkedAt: requiredTimestamp(row, 'checked_at', rowNumber, issues),
    evidenceClass: 'INDEPENDENT_CHECKED_PROJECT_CALCULATION',
    methodId: 'KD3-FATIGUE-001', routeId: 'ROUTE-KD3-2024',
  };
}

function publishedChainOracle(row, rowNumber, issues) {
  const extractedBy = requiredText(row, 'extracted_by', rowNumber, issues);
  const admittedBy = requiredText(row, 'admitted_by', rowNumber, issues);
  ensureDistinct(extractedBy, admittedBy, rowNumber, issues,
    'extracted_by/admitted_by', 'INDEPENDENT_ADMISSION_IDENTITY_REQUIRED');
  const sourceSha256 = requiredText(row, 'source_sha256', rowNumber, issues);
  if (sourceSha256 && !SHA256.test(sourceSha256)) {
    issues.push(issue(rowNumber, 'SOURCE_SHA256_INVALID', 'source_sha256',
      'source_sha256 must be sha256:<64 lowercase hex>.'));
  }
  const semanticRefs = list(row.semantic_refs);
  const receiptRefs = list(row.source_receipt_refs);
  requireSemanticRefs(semanticRefs, PUBLISHED_SEMANTICS, rowNumber, issues);
  requireReceiptRefs(receiptRefs, KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS, rowNumber, issues,
    'QF022 must reference the controlled VIII-3 2025 receipt.');
  return {
    benchmarkId: 'KD3-QF-022', bibliographicRef: requiredText(row, 'bibliographic_ref', rowNumber, issues),
    exactLocator: requiredText(row, 'exact_locator', rowNumber, issues), sourceSha256,
    semanticRefs, controlledSourceReceiptRefs: receiptRefs,
    chain: chainFromRow(row, rowNumber, issues), extractedBy,
    extractedAt: requiredTimestamp(row, 'extracted_at', rowNumber, issues), admittedBy,
    admittedAt: requiredTimestamp(row, 'admitted_at', rowNumber, issues),
    evidenceClass: 'PRIMARY_PUBLISHED_NUMERICAL_ORACLE',
    viii3Edition: '2025', methodId: 'KD3-FATIGUE-001',
  };
}

function editionCandidate(row, rowNumber, issues) {
  const semanticReconciliation = jsonArray(
    row, 'semantic_reconciliation_json', rowNumber, issues, { optional: true });
  return {
    schema: KD320_EDITION_RECONCILIATION_SCHEMA,
    target: { ...KD320_EDITION_RECONCILIATION_TARGET },
    authority: { targetQf022Ready: false, q2OracleAdmissionReady: false, ...AUTHORITY_FALSE },
    sourceEvidence: {
      referenceId: text(row.reference_id), sourceCodeEdition: '2023',
      bibliographicRef: text(row.bibliographic_ref), exactLocator: text(row.exact_locator),
      paperSha256: text(row.source_sha256) || null,
    },
    targetEvidence: {
      controlledSourceRef: 'Q1-SRC-VIII3-2025',
      secureStorageRef: text(row.controlled_2025_secure_storage_ref) || null,
      documentSha256: text(row.controlled_2025_document_sha256) || null,
    },
    semanticReconciliation,
  };
}

function previewProject(row, rowNumber) {
  const issues = [];
  const oracle = projectOracle(row, rowNumber, issues);
  if (issues.length) return blocked(rowNumber, issues);
  const admission = evaluateKd320Q2AdmissionCandidate(pendingQ2Candidate({ projectOracle: oracle }));
  return { rowNumber, ok: true, preflightState: 'PROJECT_ORACLE_READY_FOR_Q2_CANDIDATE',
    issues: [], oracle, admission, editionReconciliation: null, authority: { ...AUTHORITY_FALSE } };
}

function previewPublished(row, rowNumber) {
  const issues = [];
  const referenceId = requiredText(row, 'reference_id', rowNumber, issues);
  const sourceEdition = requiredText(row, 'source_code_edition', rowNumber, issues);
  const targetEdition = requiredText(row, 'target_viii3_edition', rowNumber, issues);
  const oracle = publishedChainOracle(row, rowNumber, issues);
  if (targetEdition && targetEdition !== '2025') {
    issues.push(issue(rowNumber, 'TARGET_VIII3_EDITION_MISMATCH',
      'target_viii3_edition', 'Target VIII-3 edition must be 2025.'));
  }
  if (!['2023', '2025'].includes(sourceEdition)) {
    issues.push(issue(rowNumber, 'PUBLISHED_SOURCE_EDITION_UNSUPPORTED', 'source_code_edition',
      'Supported preview routes are source edition 2025 direct or PVP2025-154710 edition 2023 reconciliation.'));
  }
  if (sourceEdition === '2023' && referenceId !== 'PVP2025-154710') {
    issues.push(issue(rowNumber, 'PUBLISHED_RECONCILIATION_ROUTE_UNSUPPORTED', 'reference_id',
      'The existing edition gate is qualified only for PVP2025-154710 2023->2025 reconciliation.'));
  }
  if (issues.length) return blocked(rowNumber, issues);
  if (sourceEdition === '2023') {
    const editionReconciliation = evaluateKd320EditionReconciliation(editionCandidate(row, rowNumber, []));
    return { rowNumber, ok: true, preflightState: 'PUBLISHED_ORACLE_REQUIRES_EDITION_RECONCILIATION',
      issues: [], oracle, admission: null, editionReconciliation, authority: { ...AUTHORITY_FALSE } };
  }
  const admission = evaluateKd320Q2AdmissionCandidate(pendingQ2Candidate({ publishedOracle: oracle }));
  return { rowNumber, ok: true, preflightState: 'PUBLISHED_ORACLE_READY_FOR_Q2_CANDIDATE',
    issues: [], oracle, admission, editionReconciliation: null, authority: { ...AUTHORITY_FALSE } };
}

function blocked(rowNumber, issues) {
  return { rowNumber, ok: false, preflightState: 'CSV_CONTRACT_BLOCKED', issues,
    oracle: null, admission: null, editionReconciliation: null, authority: { ...AUTHORITY_FALSE } };
}

export function previewKd320EvidenceCsv(source, mode) {
  const required = mode === KD320_CSV_MODES.PROJECT ? PROJECT_HEADERS
    : mode === KD320_CSV_MODES.PUBLISHED ? PUBLISHED_HEADERS : null;
  if (!required) {
    return { ok: false, mode,
      fileIssues: [issue(0, 'CSV_MODE_INVALID', 'mode', 'Unsupported CSV mode.')], rows: [] };
  }
  let parsed;
  try { parsed = parseCsvObjects(source); }
  catch (error) {
    return { ok: false, mode, fileIssues: [
      issue(0, 'CSV_PARSE_INVALID', 'file', String(error?.message || error))], rows: [] };
  }
  const headerCheck = validateHeaders(parsed.headers, required);
  const fileIssues = [];
  if (headerCheck.missing.length) {
    fileIssues.push(issue(0, 'CSV_HEADERS_MISSING', 'header', `Missing: ${headerCheck.missing.join(', ')}`));
  }
  if (headerCheck.unknown.length) {
    fileIssues.push(issue(0, 'CSV_HEADERS_UNKNOWN', 'header', `Unknown: ${headerCheck.unknown.join(', ')}`));
  }
  if (!parsed.records.length) fileIssues.push(issue(0, 'CSV_DATA_ROWS_MISSING', 'file', 'At least one data row is required.'));
  if (fileIssues.length) return { ok: false, mode, fileIssues, rows: [] };
  const rows = parsed.records.map((row, index) => mode === KD320_CSV_MODES.PROJECT
    ? previewProject(row, index + 2) : previewPublished(row, index + 2));
  return { ok: rows.every((row) => row.ok), mode, fileIssues: [], rows,
    authority: { ...AUTHORITY_FALSE } };
}

function csvEscape(value) {
  const valueText = String(value ?? '');
  return /[",\n]/.test(valueText) ? `"${valueText.replaceAll('"', '""')}"` : valueText;
}

export function getKd320EvidenceCsvTemplate(mode) {
  if (mode === KD320_CSV_MODES.PROJECT) {
    const row = ['', '', '2024', '2025', '', '', '[]', '', '', '', '', '', '',
      PROJECT_SEMANTICS.join(';'), KD320_Q2_REQUIRED_RECEIPTS.join(';')];
    return `${PROJECT_HEADERS.join(',')}\n${row.map(csvEscape).join(',')}\n`;
  }
  if (mode === KD320_CSV_MODES.PUBLISHED) {
    const row = ['', '2025', '2025', '', '', '', '', '', '[]', '', '', '[]', '', '',
      PUBLISHED_SEMANTICS.join(';'), KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS.join(';'), '', '', '', ''];
    return `${PUBLISHED_HEADERS.join(',')}\n${row.map(csvEscape).join(',')}\n`;
  }
  throw new Error(`Unsupported KD320 CSV mode: ${mode}`);
}

export const KD320_PROJECT_CSV_HEADERS = PROJECT_HEADERS;
export const KD320_PUBLISHED_CSV_HEADERS = PUBLISHED_HEADERS;
