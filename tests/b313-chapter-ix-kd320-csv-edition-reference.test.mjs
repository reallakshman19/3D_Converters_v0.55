import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KD320_CSV_MODES,
  KD320_EDITION_SEMANTIC_CSV_HEADERS,
  previewKd320EvidenceCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/csv-four-record-intake.js';

function escape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(rows) {
  return `${KD320_EDITION_SEMANTIC_CSV_HEADERS.join(',')}\n${rows.map((row) =>
    KD320_EDITION_SEMANTIC_CSV_HEADERS.map((header) => escape(row[header] ?? '')).join(',')).join('\n')}\n`;
}

function editionRows() {
  const hashA = `sha256:${'a'.repeat(64)}`;
  const hashB = `sha256:${'b'.repeat(64)}`;
  return Array.from({ length: 12 }, (_, index) => {
    const semanticId = `KD320-SEM-${String(index + 2).padStart(3, '0')}`;
    return {
      reference_id: 'PVP2025-154710', source_code_edition: '2023', target_viii3_edition: '2025',
      bibliographic_ref: 'doi:10.1115/PVP2025-154710', exact_locator: 'published numerical example', source_sha256: hashA,
      controlled_2025_secure_storage_ref: 'secure://viii3/2025', controlled_2025_document_sha256: hashB,
      semantic_id: semanticId, source_locator: `paper:${semanticId}`, target_controlled_locator: `controlled:${semanticId}`,
      controlled_semantic_ref: `secure:${semanticId}`, comparison_status: 'IDENTICAL', compared_by: 'Comparator A',
      compared_at: '2026-08-19T03:00:00Z', independent_check_by: 'Checker B', independent_checked_at: '2026-08-19T03:30:00Z',
    };
  });
}

test('EDITION_SEMANTIC rejects a 2023-to-2025 package for an unqualified published reference', () => {
  const rows = editionRows().map((row) => ({ ...row, reference_id: 'OTHER-PAPER' }));
  const result = previewKd320EvidenceCsv(csv(rows), KD320_CSV_MODES.EDITION_SEMANTIC);
  assert.equal(result.ok, false);
  assert.equal(result.rows.length, 12);
  assert(result.rows.every((row) => row.issues.some((item) => item.code === 'EDITION_REFERENCE_ID_UNSUPPORTED')));
  assert.equal(result.editionReconciliation.targetQf022Ready, false);
  assert.equal(result.editionReconciliation.authority.q2OracleAdmissionReady, false);
});
