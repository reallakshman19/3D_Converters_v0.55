import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKd320EvidenceCsvTemplate,
  KD320_CONTROLLED_SOURCE_CSV_HEADERS,
  KD320_CSV_MODES,
  KD320_EDITION_SEMANTIC_CSV_HEADERS,
  previewKd320EvidenceCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/csv-four-record-intake.js';
import {
  KD320_PROJECT_CSV_HEADERS,
  KD320_PUBLISHED_CSV_HEADERS,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/csv-intake.js';
import { KD320_Q2_METHOD_SEMANTICS } from '../engineering/hp-class-standardization/qualification/kd320-q2/intake.js';

function escape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csv(headers, rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  return `${headers.join(',')}\n${list.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')).join('\n')}\n`;
}

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const correctionParameters = JSON.stringify([
  { name: 'Kmean', value: 1.125, units: 'ratio', semanticRef: 'KD320-SEM-006' },
]);
const semanticRefs = KD320_Q2_METHOD_SEMANTICS.join(';');

function sourceRows() {
  return [
    {
      receipt_id: 'Q1-SRC-B313-2024', standard: 'ASME B31.3', edition: '2024', secure_storage_ref: 'secure://b313/2024',
      document_sha256: HASH_A, exact_locators: 'Chapter IX;fatigue invocation', verified_by: 'Verifier A',
      verified_at: '2026-08-19T01:00:00Z', independent_check_by: 'Checker B', independent_checked_at: '2026-08-19T02:00:00Z',
    },
    {
      receipt_id: 'Q1-SRC-VIII3-2025', standard: 'ASME BPVC Section VIII Division 3', edition: '2025', secure_storage_ref: 'secure://viii3/2025',
      document_sha256: HASH_B, exact_locators: 'KD-3;KD-320', verified_by: 'Verifier C',
      verified_at: '2026-08-19T01:30:00Z', independent_check_by: 'Checker D', independent_checked_at: '2026-08-19T02:30:00Z',
    },
  ];
}

function editionRows() {
  return Array.from({ length: 12 }, (_, index) => {
    const semanticId = `KD320-SEM-${String(index + 2).padStart(3, '0')}`;
    return {
      reference_id: 'PVP2025-154710', source_code_edition: '2023', target_viii3_edition: '2025',
      bibliographic_ref: 'doi:10.1115/PVP2025-154710', exact_locator: 'published numerical example', source_sha256: HASH_A,
      controlled_2025_secure_storage_ref: 'secure://viii3/2025', controlled_2025_document_sha256: HASH_B,
      semantic_id: semanticId, source_locator: `paper:${semanticId}`, target_controlled_locator: `controlled:${semanticId}`,
      controlled_semantic_ref: `secure:${semanticId}`, comparison_status: 'IDENTICAL', compared_by: 'Comparator A',
      compared_at: '2026-08-19T03:00:00Z', independent_check_by: 'Checker B', independent_checked_at: '2026-08-19T03:30:00Z',
    };
  });
}

function projectRow(overrides = {}) {
  return {
    calculation_ref: 'CALC-001', location_id: 'LOC-001', b313_edition: '2024', viii3_edition: '2025', salt_mpa: '63.3',
    associated_mean_stress_mpa: '25', correction_parameters_json: correctionParameters, seq_mpa: '70', permissible_cycles: '10000',
    calculated_by: 'Engineer A', calculated_at: '2026-08-19T01:00:00Z', checked_by: 'Engineer B', checked_at: '2026-08-19T02:00:00Z',
    semantic_refs: semanticRefs, source_receipt_refs: 'Q1-SRC-B313-2024;Q1-SRC-VIII3-2025', ...overrides,
  };
}

function publishedRow(overrides = {}) {
  return {
    reference_id: 'PVP2025-154710', source_code_edition: '2025', target_viii3_edition: '2025',
    bibliographic_ref: 'doi:10.1115/PVP2025-154710', exact_locator: 'Section 3.2 Table 3', source_sha256: HASH_A,
    controlled_2025_secure_storage_ref: '', controlled_2025_document_sha256: '', semantic_reconciliation_json: '[]',
    salt_mpa: '63.3', associated_mean_stress_mpa: '20', correction_parameters_json: correctionParameters, seq_mpa: '70',
    permissible_cycles: '10000', semantic_refs: semanticRefs, source_receipt_refs: 'Q1-SRC-VIII3-2025',
    extracted_by: 'Extractor A', extracted_at: '2026-08-19T01:00:00Z',
    admitted_by: 'Admitter B', admitted_at: '2026-08-19T02:00:00Z', ...overrides,
  };
}

test('templates expose exactly the four intended record classes without engineering values', () => {
  const source = getKd320EvidenceCsvTemplate(KD320_CSV_MODES.CONTROLLED_SOURCE);
  const edition = getKd320EvidenceCsvTemplate(KD320_CSV_MODES.EDITION_SEMANTIC);
  assert.equal(source.split('\n')[0], KD320_CONTROLLED_SOURCE_CSV_HEADERS.join(','));
  assert.equal(source.trim().split('\n').length, 3);
  assert.match(source, /Q1-SRC-B313-2024/);
  assert.match(source, /Q1-SRC-VIII3-2025/);
  assert.equal(edition.split('\n')[0], KD320_EDITION_SEMANTIC_CSV_HEADERS.join(','));
  assert.equal(edition.trim().split('\n').length, 13);
  assert.match(edition, /KD320-SEM-002/);
  assert.match(edition, /KD320-SEM-013/);
  assert.doesNotMatch(source + edition, /63\.3|10000/);
});

test('complete controlled-source receipt set preflights and remains Q1-gated', () => {
  const result = previewKd320EvidenceCsv(csv(KD320_CONTROLLED_SOURCE_CSV_HEADERS, sourceRows()), KD320_CSV_MODES.CONTROLLED_SOURCE);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 2);
  assert.equal(result.admission.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert.equal(result.admission.q1Complete, false);
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});

test('controlled-source intake reports missing and duplicate receipt identities at file level', () => {
  const missing = previewKd320EvidenceCsv(csv(KD320_CONTROLLED_SOURCE_CSV_HEADERS, [sourceRows()[0]]), KD320_CSV_MODES.CONTROLLED_SOURCE);
  assert(missing.fileIssues.some((item) => item.code === 'CONTROLLED_SOURCE_RECEIPT_MISSING'));
  const duplicateRows = [sourceRows()[0], sourceRows()[0], sourceRows()[1]];
  const duplicate = previewKd320EvidenceCsv(csv(KD320_CONTROLLED_SOURCE_CSV_HEADERS, duplicateRows), KD320_CSV_MODES.CONTROLLED_SOURCE);
  assert(duplicate.fileIssues.some((item) => item.code === 'CONTROLLED_SOURCE_RECEIPT_DUPLICATE'));
});

test('controlled-source intake blocks invalid hash and non-independent custody', () => {
  const rows = sourceRows();
  rows[0] = { ...rows[0], document_sha256: 'abc', independent_check_by: ' verifier a ' };
  const result = previewKd320EvidenceCsv(csv(KD320_CONTROLLED_SOURCE_CSV_HEADERS, rows), KD320_CSV_MODES.CONTROLLED_SOURCE);
  assert.equal(result.ok, false);
  assert(result.rows[0].issues.some((item) => item.code === 'DOCUMENT_SHA256_INVALID'));
  assert(result.rows[0].issues.some((item) => item.code === 'INDEPENDENT_CHECK_IDENTITY_REQUIRED'));
});

test('complete edition-semantic file drives the existing 2023-to-2025 evaluator', () => {
  const result = previewKd320EvidenceCsv(csv(KD320_EDITION_SEMANTIC_CSV_HEADERS, editionRows()), KD320_CSV_MODES.EDITION_SEMANTIC);
  assert.equal(result.ok, true);
  assert.equal(result.rows.length, 12);
  assert.equal(result.editionReconciliation.state, 'EDITION_RECONCILIATION_READY_FOR_Q2_ADMISSION');
  assert.equal(result.editionReconciliation.editionReconciliationReady, true);
  assert.equal(result.editionReconciliation.targetQf022Ready, false);
  assert.equal(result.editionReconciliation.authority.q2OracleAdmissionReady, false);
});

test('edition-semantic intake fails closed on missing or duplicate KD320-SEM-002 through 013', () => {
  const missingRows = editionRows().slice(0, 11);
  const missing = previewKd320EvidenceCsv(csv(KD320_EDITION_SEMANTIC_CSV_HEADERS, missingRows), KD320_CSV_MODES.EDITION_SEMANTIC);
  assert(missing.fileIssues.some((item) => item.code === 'EDITION_SEMANTIC_MISSING' && item.message.includes('KD320-SEM-013')));
  const duplicateRows = [...editionRows(), editionRows()[0]];
  const duplicate = previewKd320EvidenceCsv(csv(KD320_EDITION_SEMANTIC_CSV_HEADERS, duplicateRows), KD320_CSV_MODES.EDITION_SEMANTIC);
  assert(duplicate.fileIssues.some((item) => item.code === 'EDITION_SEMANTIC_DUPLICATE'));
});

test('edition-semantic intake blocks edition drift and inconsistent package context', () => {
  const rows = editionRows();
  rows[3] = { ...rows[3], source_code_edition: '2025' };
  const result = previewKd320EvidenceCsv(csv(KD320_EDITION_SEMANTIC_CSV_HEADERS, rows), KD320_CSV_MODES.EDITION_SEMANTIC);
  assert.equal(result.ok, false);
  assert(result.rows[3].issues.some((item) => item.code === 'SOURCE_EDITION_MUST_BE_2023'));
  assert(result.fileIssues.some((item) => item.code === 'EDITION_CONTEXT_INCONSISTENT'));
});

test('QF022 record class delegates with explicit SEM-002..013 and target receipt custody', () => {
  const result = previewKd320EvidenceCsv(csv(KD320_PUBLISHED_CSV_HEADERS, publishedRow()), KD320_CSV_MODES.QF022_ORACLE);
  assert.equal(result.ok, true);
  assert.equal(result.delegatedMode, 'PUBLISHED_NUMERICAL_ORACLE');
  assert.equal(result.rows[0].preflightState, 'PUBLISHED_ORACLE_READY_FOR_Q2_CANDIDATE');
  assert.deepEqual(result.rows[0].oracle.semanticRefs, KD320_Q2_METHOD_SEMANTICS);
  assert.deepEqual(result.rows[0].oracle.controlledSourceReceiptRefs, ['Q1-SRC-VIII3-2025']);
});

test('QF023 record class delegates with explicit SEM-002..013 custody', () => {
  const result = previewKd320EvidenceCsv(csv(KD320_PROJECT_CSV_HEADERS, projectRow()), KD320_CSV_MODES.QF023_PROJECT_CALC);
  assert.equal(result.ok, true);
  assert.equal(result.delegatedMode, 'PROJECT_CHECKED_CALCULATION');
  assert.equal(result.rows[0].preflightState, 'PROJECT_ORACLE_READY_FOR_Q2_CANDIDATE');
  assert.deepEqual(result.rows[0].oracle.semanticRefs, KD320_Q2_METHOD_SEMANTICS);
});

test('QF022/QF023 facade fails closed when SEM-012/013 custody is incomplete', () => {
  const incomplete = KD320_Q2_METHOD_SEMANTICS.filter((id) => id !== 'KD320-SEM-013').join(';');
  const qf022 = previewKd320EvidenceCsv(
    csv(KD320_PUBLISHED_CSV_HEADERS, publishedRow({ semantic_refs: incomplete })), KD320_CSV_MODES.QF022_ORACLE);
  assert.equal(qf022.ok, false);
  assert(qf022.rows[0].issues.some((item) => item.code === 'SEMANTIC_REFS_INCOMPLETE'));
  const qf023 = previewKd320EvidenceCsv(
    csv(KD320_PROJECT_CSV_HEADERS, projectRow({ semantic_refs: incomplete })), KD320_CSV_MODES.QF023_PROJECT_CALC);
  assert.equal(qf023.ok, false);
  assert(qf023.rows[0].issues.some((item) => item.code === 'SEMANTIC_REFS_INCOMPLETE'));
});

test('new record classes reject unknown CSV headers and malformed quoting', () => {
  const badHeaders = [...KD320_CONTROLLED_SOURCE_CSV_HEADERS, 'licensed_text'];
  const unknown = previewKd320EvidenceCsv(csv(badHeaders, { ...sourceRows()[0], licensed_text: 'not allowed' }), KD320_CSV_MODES.CONTROLLED_SOURCE);
  assert(unknown.fileIssues.some((item) => item.code === 'CSV_HEADERS_UNKNOWN'));
  const malformed = `${KD320_EDITION_SEMANTIC_CSV_HEADERS.join(',')}\n\"unterminated`;
  const blocked = previewKd320EvidenceCsv(malformed, KD320_CSV_MODES.EDITION_SEMANTIC);
  assert(blocked.fileIssues.some((item) => item.code === 'CSV_PARSE_INVALID'));
});
