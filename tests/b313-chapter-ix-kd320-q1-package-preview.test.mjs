import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  KD320_CSV_MODES,
  previewKd320EvidenceCsv,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/csv-four-record-intake.js';
import { previewKd320Q1SemanticCsv } from
  '../engineering/hp-class-standardization/qualification/kd320-q1/semantic-csv-intake.js';
import {
  getKd320Q1ExitAttestationJsonTemplate,
  previewKd320Q1ExitAttestationJson,
  previewKd320Q1Package,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/package-preview.js';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;
const ISO_A = '2026-08-19T10:00:00Z';
const ISO_B = '2026-08-19T11:00:00Z';
const here = path.dirname(fileURLToPath(import.meta.url));

function receiptCsv() {
  const header = 'receipt_id,standard,edition,secure_storage_ref,document_sha256,exact_locators,verified_by,verified_at,independent_check_by,independent_checked_at';
  return `${header}\nQ1-SRC-B313-2024,ASME B31.3,2024,secure://b313,${HASH_A},KD-ROOT,Verifier A,${ISO_A},Checker B,${ISO_B}\nQ1-SRC-VIII3-2025,ASME BPVC Section VIII Division 3,2025,secure://viii3,${HASH_B},KD320,Verifier A,${ISO_A},Checker B,${ISO_B}\n`;
}

function semanticCsv() {
  const header = 'semantic_id,controlled_source_ref,exact_source_locator,controlled_semantic_ref,units,sign_convention,selection_rule,interpolation_rule,applicability_rule,extracted_by,extracted_at,independent_check_by,independent_checked_at';
  const rows = Array.from({ length: 14 }, (_, index) => {
    const id = `KD320-SEM-${String(index + 1).padStart(3, '0')}`;
    const source = index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025';
    return [id, source, `controlled-locator-${index + 1}`, `secure://semantic/${id}`,
      'METHOD_SPECIFIC', 'CONTROLLED_RULE_RECORDED', 'CONTROLLED_RULE_RECORDED',
      'CONTROLLED_RULE_RECORDED_OR_NOT_APPLICABLE', 'CONTROLLED_RULE_RECORDED',
      'Extractor A', ISO_A, 'Checker B', ISO_B].join(',');
  });
  return `${header}\n${rows.join('\n')}\n`;
}

function subpackages() {
  return {
    controlledSourceResult: previewKd320EvidenceCsv(receiptCsv(), KD320_CSV_MODES.CONTROLLED_SOURCE),
    semanticResult: previewKd320Q1SemanticCsv(semanticCsv()),
  };
}

function attestation(parts) {
  const receipts = parts.controlledSourceResult.rows.map((row) => row.evidence);
  const semantics = parts.semanticResult.rows.map((row) => row.evidence);
  return {
    schema: 'kd320-q1-exit-attestation/v1',
    recordId: 'VR-B313-CH9-KD320-NATIVE-001-Q1',
    status: 'Q1_COMPLETE_Q2_ORACLE_POPULATION_ALLOWED',
    controlledEvidenceLedgerRef: 'secure://q1/evidence-ledger',
    controlledEvidenceLedgerSha256: HASH_C,
    q1AuditReportRef: 'secure://q1/audit-report',
    q1AuditReportSha256: HASH_D,
    sourceReceipts: receipts.map(({ receiptId, documentSha256 }) => ({ receiptId, documentSha256 })),
    semanticBindings: semantics.map(({ semanticId, controlledSourceRef, exactSourceLocator, controlledSemanticRef }) => ({
      semanticId, controlledSourceRef, exactSourceLocator, controlledSemanticRef,
    })),
    evidencePassRefs: ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08'],
    gatePassRefs: ['G0', 'G1'],
    attestedBy: 'Q1 Attestor A',
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
  };
}

function previewWith(mutator = null) {
  const parts = subpackages();
  const value = attestation(parts);
  mutator?.(value, parts);
  const attestationResult = previewKd320Q1ExitAttestationJson(JSON.stringify(value));
  return previewKd320Q1Package({ ...parts, attestationResult });
}

test('two receipts plus fourteen semantics cannot complete Q1 without formal exit attestation', () => {
  const result = previewKd320Q1Package(subpackages());
  assert.equal(result.q1Complete, false);
  assert.equal(result.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert(result.blockers.includes('Q1_PACKAGE_FORMAL_EXIT_MISSING'));
});

test('exact combined package reaches formal Q1 completion but not Q2 oracle admission', () => {
  const result = previewWith();
  assert.equal(result.q1Complete, true);
  assert.equal(result.packageReady, true);
  assert.equal(result.state, 'Q1_COMPLETE_Q2_ORACLE_PENDING');
  assert.equal(result.q2OracleAdmissionReady, false);
  assert(result.blockers.includes('PROJECT_ORACLE_MISSING'));
  assert(result.blockers.includes('PRIMARY_PUBLISHED_ORACLE_MISSING'));
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.canUseForDesignAuthority, false);
  assert.equal(result.authority.productionKernelAllowed, false);
});

test('formal package fails closed when E08 or G1 is missing', () => {
  const e08 = previewWith((value) => { value.evidencePassRefs.pop(); });
  assert.equal(e08.q1Complete, false);
  assert(e08.blockers.some((code) => code.includes('Q1_EXIT_EVIDENCE_REFS_MISSING:E08')));
  const g1 = previewWith((value) => { value.gatePassRefs = ['G0']; });
  assert.equal(g1.q1Complete, false);
  assert(g1.blockers.some((code) => code.includes('Q1_EXIT_GATE_REFS_MISSING:G1')));
});

test('formal package is bound to exact receipt document hashes', () => {
  const result = previewWith((value) => { value.sourceReceipts[0].documentSha256 = HASH_B; });
  assert.equal(result.q1Complete, false);
  assert(result.blockers.includes('Q1_EXIT_RECEIPT_HASH_MISMATCH:Q1-SRC-B313-2024'));
});

test('formal package is bound to exact semantic locator and canonical source', () => {
  const locator = previewWith((value) => { value.semanticBindings[11].exactSourceLocator = 'wrong-locator'; });
  assert.equal(locator.q1Complete, false);
  assert(locator.blockers.includes('Q1_EXIT_SEMANTIC_BINDING_MISMATCH:KD320-SEM-012'));
  const source = previewWith((value) => { value.semanticBindings[0].controlledSourceRef = 'Q1-SRC-VIII3-2025'; });
  assert.equal(source.q1Complete, false);
  assert(source.blockers.includes('Q1_EXIT_SEMANTIC_BINDING_MISMATCH:KD320-SEM-001'));
});

test('formal package requires independent attestation custody', () => {
  const result = previewWith((value) => { value.independentCheckBy = ' q1 attestor a '; });
  assert.equal(result.q1Complete, false);
  assert(result.blockers.includes('Q1_EXIT_INDEPENDENT_CHECK_CUSTODY_INCOMPLETE'));
});

test('attempted production authority is a structural failure', () => {
  const result = previewWith((value) => { value.authority.productionKernelAllowed = true; });
  assert.equal(result.ok, false);
  assert.equal(result.q1Complete, false);
  assert(result.blockers.includes('Q1_EXIT_AUTHORITY_MUST_REMAIN_FALSE'));
  assert(result.blockers.includes('Q1_EXIT_STRUCTURE_DUPLICATE_OR_INVALID'));
  assert.equal(result.authority.productionKernelAllowed, false);
});

test('formal exit JSON parser blocks malformed input before package evaluation', () => {
  const parsed = previewKd320Q1ExitAttestationJson('{bad json');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.attestation, null);
  assert.equal(parsed.fileIssues[0].code, 'Q1_EXIT_JSON_PARSE_INVALID');
});

test('browser formal-exit template matches the repository custody template exactly', () => {
  const generated = JSON.parse(getKd320Q1ExitAttestationJsonTemplate());
  const committed = JSON.parse(fs.readFileSync(path.join(
    here, '..', 'engineering', 'hp-class-standardization', 'qualification', 'kd320-q1',
    'formal-exit-attestation.template.json',
  ), 'utf8'));
  assert.deepEqual(generated, committed);
});

test('formal exit template is redacted and keeps authority false', () => {
  const source = getKd320Q1ExitAttestationJsonTemplate();
  assert.doesNotMatch(source, /licensedText|codeText|equationText|fatigueCurvePoints|nativeKd320Formula|formulaExpression/);
  const value = JSON.parse(source);
  assert.equal(value.status, null);
  assert.equal(value.sourceReceipts.length, 2);
  assert.equal(value.semanticBindings.length, 14);
  assert.deepEqual(value.evidencePassRefs, ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08']);
  assert.deepEqual(value.gatePassRefs, ['G0', 'G1']);
  assert.equal(value.authority.nativeCoreKd3Qualified, false);
  assert.equal(value.authority.productionKernelAllowed, false);
});
