import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getKd320Q1SemanticCsvTemplate,
  KD320_Q1_SEMANTIC_CSV_HEADERS,
  previewKd320Q1SemanticCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/semantic-csv-intake.js';

function escape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function csv(headers, rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  return `${headers.join(',')}\n${list.map((row) => headers.map((header) => escape(row[header] ?? '')).join(',')).join('\n')}\n`;
}

function semanticRows() {
  return Array.from({ length: 14 }, (_, index) => {
    const semanticId = `KD320-SEM-${String(index + 1).padStart(3, '0')}`;
    return {
      semantic_id: semanticId,
      controlled_source_ref: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
      exact_source_locator: `controlled:${semanticId}:locator`,
      controlled_semantic_ref: `secure:${semanticId}`,
      units: index === 0 ? 'NOT_APPLICABLE' : 'CONTROLLED_EXPLICIT',
      sign_convention: 'CONTROLLED_EXPLICIT',
      selection_rule: 'CONTROLLED_EXPLICIT',
      interpolation_rule: 'NOT_APPLICABLE',
      applicability_rule: 'CONTROLLED_EXPLICIT',
      extracted_by: 'Extractor A',
      extracted_at: '2026-08-19T04:00:00Z',
      independent_check_by: 'Checker B',
      independent_checked_at: '2026-08-19T04:30:00Z',
    };
  });
}

test('Q1 semantic template contains exactly SEM-001 through SEM-014 with controlled-source bindings only', () => {
  const template = getKd320Q1SemanticCsvTemplate();
  const lines = template.trim().split('\n');
  assert.equal(lines[0], KD320_Q1_SEMANTIC_CSV_HEADERS.join(','));
  assert.equal(lines.length, 15);
  assert.match(lines[1], /^KD320-SEM-001,Q1-SRC-B313-2024,/);
  assert.match(lines[2], /^KD320-SEM-002,Q1-SRC-VIII3-2025,/);
  assert.match(lines[14], /^KD320-SEM-014,Q1-SRC-VIII3-2025,/);
  assert.doesNotMatch(lines[0], /engineering_definition|licensed_text|equation|curve|salt|seq|permissible_cycles/i);
});

test('complete Q1 semantic package preflights but cannot complete Q1 without source receipts', () => {
  const result = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, semanticRows()));
  assert.equal(result.ok, true);
  assert.equal(result.semanticPackageReady, true);
  assert.equal(result.rows.length, 14);
  assert.equal(result.admission.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert.equal(result.admission.q1Complete, false);
  assert.equal(result.admission.q2OracleAdmissionReady, false);
  assert(result.admission.blockers.some((item) => item.includes('Q1-SRC-B313-2024:STATUS_NOT_VERIFIED')));
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
});

test('Q1 semantic package fails closed on missing and duplicate semantic IDs', () => {
  const missing = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, semanticRows().slice(0, 13)));
  assert(missing.fileIssues.some((item) => item.code === 'Q1_SEMANTIC_MISSING' && item.message.includes('KD320-SEM-014')));
  const rows = semanticRows();
  const duplicate = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, [...rows, rows[0]]));
  assert(duplicate.fileIssues.some((item) => item.code === 'Q1_SEMANTIC_DUPLICATE' && item.message.includes('KD320-SEM-001')));
});

test('Q1 semantic package enforces canonical receipt binding for SEM-001 and SEM-002 through 014', () => {
  const rows = semanticRows();
  rows[0] = { ...rows[0], controlled_source_ref: 'Q1-SRC-VIII3-2025' };
  rows[1] = { ...rows[1], controlled_source_ref: 'Q1-SRC-B313-2024' };
  const result = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, rows));
  assert.equal(result.ok, false);
  assert(result.rows[0].issues.some((item) => item.code === 'Q1_SEMANTIC_SOURCE_BINDING_MISMATCH'));
  assert(result.rows[1].issues.some((item) => item.code === 'Q1_SEMANTIC_SOURCE_BINDING_MISMATCH'));
});

test('Q1 semantic package requires explicit semantic fields and independent custody', () => {
  const rows = semanticRows();
  rows[4] = { ...rows[4], selection_rule: '', independent_check_by: ' extractor a ' };
  const result = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, rows));
  assert.equal(result.rows[4].ok, false);
  assert(result.rows[4].issues.some((item) => item.code === 'REQUIRED_FIELD_MISSING' && item.field === 'selection_rule'));
  assert(result.rows[4].issues.some((item) => item.code === 'INDEPENDENT_CHECK_IDENTITY_REQUIRED'));
});

test('Q1 semantic package rejects non-UTC timestamps', () => {
  const rows = semanticRows();
  rows[3] = { ...rows[3], extracted_at: '2026-08-19 04:00' };
  const result = previewKd320Q1SemanticCsv(csv(KD320_Q1_SEMANTIC_CSV_HEADERS, rows));
  assert(result.rows[3].issues.some((item) => item.code === 'EXTRACTED_AT_INVALID'));
});

test('public semantic CSV contract rejects fields that could carry licensed engineering text', () => {
  const headers = [...KD320_Q1_SEMANTIC_CSV_HEADERS, 'engineering_definition'];
  const rows = semanticRows().map((row) => ({ ...row, engineering_definition: 'forbidden transport field' }));
  const result = previewKd320Q1SemanticCsv(csv(headers, rows));
  assert.equal(result.ok, false);
  assert(result.fileIssues.some((item) => item.code === 'CSV_HEADERS_UNKNOWN'));
});

test('Q1 semantic parser tolerates UTF-8 BOM and blocks unterminated quoting', () => {
  const source = `\uFEFF${csv(KD320_Q1_SEMANTIC_CSV_HEADERS, semanticRows())}`;
  assert.equal(previewKd320Q1SemanticCsv(source).ok, true);
  const malformed = `${KD320_Q1_SEMANTIC_CSV_HEADERS.join(',')}\n\"unterminated`;
  const blocked = previewKd320Q1SemanticCsv(malformed);
  assert(blocked.fileIssues.some((item) => item.code === 'CSV_PARSE_INVALID'));
});
