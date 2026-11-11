import {
  evaluateKd320Q2AdmissionCandidate,
  KD320_Q2_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_SEMANTICS,
  KD320_Q2_TARGET,
} from '../kd320-q2/intake.js';
import {
  KD320_Q1_EXIT_ATTESTATION_SCHEMA,
  KD320_Q1_EXIT_EVIDENCE_REFS,
  KD320_Q1_EXIT_GATE_REFS,
  KD320_Q1_EXIT_RECORD_ID,
} from './formal-exit.js';

const AUTHORITY_FALSE = Object.freeze({
  nativeCoreKd3Qualified: false,
  codeCompliance: false,
  canUseForDesignAuthority: false,
  productionKernelAllowed: false,
  automaticPromotionAllowed: false,
});

function text(value) { return String(value ?? '').trim(); }
function codeOf(value) { return text(value?.code || value); }

function resultBlockers(result, prefix) {
  const issues = [...(result?.fileIssues ?? []), ...((result?.rows ?? []).flatMap((row) => row.issues ?? []))];
  return issues.map((item) => `${prefix}:${codeOf(item)}`).filter((item) => !item.endsWith(':'));
}

function packageEvidence(result, expectedCount, prefix) {
  if (!result) return { ready: false, evidence: [], blockers: [`${prefix}_MISSING`] };
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const evidence = rows.map((row) => row.evidence).filter(Boolean);
  const blockers = resultBlockers(result, prefix);
  if (result.ok !== true) blockers.unshift(`${prefix}_NOT_READY`);
  if (evidence.length !== expectedCount) blockers.push(`${prefix}_COUNT_INVALID:${evidence.length}/${expectedCount}`);
  return {
    ready: result.ok === true && evidence.length === expectedCount && blockers.length === 0,
    evidence,
    blockers,
  };
}

function q2Candidate(sourceReceipts, semanticItems, q1ExitAttestation) {
  return {
    schema: 'kd320-q2-admission-candidate/v1',
    target: { ...KD320_Q2_TARGET },
    authority: { ...AUTHORITY_FALSE },
    sourceReceipts,
    semanticItems,
    q1ExitAttestation,
    projectOracle: null,
    publishedOracle: null,
  };
}

function pendingResult(blockers) {
  return {
    ok: false,
    state: 'Q1_CONTROLLED_EVIDENCE_PENDING',
    q1Complete: false,
    q2OracleAdmissionReady: false,
    blockers: [...new Set(blockers)],
    q1Exit: null,
    authority: { ...AUTHORITY_FALSE },
  };
}

export function previewKd320Q1ExitAttestationJson(source) {
  let attestation;
  try { attestation = JSON.parse(String(source ?? '')); }
  catch (error) {
    return {
      ok: false,
      fileIssues: [{ code: 'Q1_EXIT_JSON_PARSE_INVALID', message: String(error?.message || error) }],
      attestation: null,
      authority: { ...AUTHORITY_FALSE },
    };
  }
  if (!attestation || Array.isArray(attestation) || typeof attestation !== 'object') {
    return {
      ok: false,
      fileIssues: [{ code: 'Q1_EXIT_JSON_OBJECT_REQUIRED', message: 'Formal Q1 exit JSON must be one object.' }],
      attestation: null,
      authority: { ...AUTHORITY_FALSE },
    };
  }
  return { ok: true, fileIssues: [], attestation, authority: { ...AUTHORITY_FALSE } };
}

export function previewKd320Q1Package({
  controlledSourceResult = null,
  semanticResult = null,
  attestationResult = null,
} = {}) {
  const receipts = packageEvidence(controlledSourceResult, KD320_Q2_REQUIRED_RECEIPTS.length,
    'Q1_PACKAGE_CONTROLLED_SOURCE');
  const semantics = packageEvidence(semanticResult, KD320_Q2_REQUIRED_SEMANTICS.length,
    'Q1_PACKAGE_SEMANTICS');
  const blockers = [...receipts.blockers, ...semantics.blockers];
  if (!attestationResult) blockers.push('Q1_PACKAGE_FORMAL_EXIT_MISSING');
  else if (attestationResult.ok !== true) {
    blockers.push('Q1_PACKAGE_FORMAL_EXIT_NOT_READY');
    blockers.push(...(attestationResult.fileIssues ?? []).map((item) => `Q1_PACKAGE_FORMAL_EXIT:${codeOf(item)}`));
  }
  if (!receipts.ready || !semantics.ready || attestationResult?.ok !== true) return pendingResult(blockers);

  const admission = evaluateKd320Q2AdmissionCandidate(q2Candidate(
    receipts.evidence,
    semantics.evidence,
    attestationResult.attestation,
  ));
  return {
    ...admission,
    packageReady: admission.q1Complete === true,
    authority: { ...AUTHORITY_FALSE },
  };
}

function semanticBinding(semanticId, index) {
  return {
    semanticId,
    controlledSourceRef: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
    exactSourceLocator: null,
    controlledSemanticRef: null,
  };
}

export function getKd320Q1ExitAttestationJsonTemplate() {
  const template = {
    schema: KD320_Q1_EXIT_ATTESTATION_SCHEMA,
    recordId: KD320_Q1_EXIT_RECORD_ID,
    status: null,
    controlledEvidenceLedgerRef: null,
    controlledEvidenceLedgerSha256: null,
    q1AuditReportRef: null,
    q1AuditReportSha256: null,
    sourceReceipts: KD320_Q2_REQUIRED_RECEIPTS.map((receiptId) => ({ receiptId, documentSha256: null })),
    semanticBindings: KD320_Q2_REQUIRED_SEMANTICS.map(semanticBinding),
    evidencePassRefs: [...KD320_Q1_EXIT_EVIDENCE_REFS],
    gatePassRefs: [...KD320_Q1_EXIT_GATE_REFS],
    attestedBy: null,
    attestedAt: null,
    independentCheckBy: null,
    independentCheckedAt: null,
    authority: { ...AUTHORITY_FALSE },
  };
  return `${JSON.stringify(template, null, 2)}\n`;
}

export const KD320_Q1_PACKAGE_AUTHORITY = AUTHORITY_FALSE;
