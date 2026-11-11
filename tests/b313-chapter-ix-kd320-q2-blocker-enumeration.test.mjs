import assert from 'node:assert/strict';
import test from 'node:test';

import {
  KD320_Q1_EXIT_EVIDENCE_REFS,
  KD320_Q1_EXIT_GATE_REFS,
  KD320_Q1_EXIT_STATUS,
} from '../engineering/hp-class-standardization/qualification/kd320-q1/formal-exit.js';
import {
  evaluateKd320Q2AdmissionCandidate,
  KD320_Q2_METHOD_SEMANTICS,
  KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS,
  KD320_Q2_REQUIRED_SEMANTICS,
} from '../engineering/hp-class-standardization/qualification/kd320-q2/intake.js';

const ISO_A = '2026-08-18T08:00:00Z';
const ISO_B = '2026-08-18T09:00:00Z';
const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;
const HASH_C = `sha256:${'c'.repeat(64)}`;
const HASH_D = `sha256:${'d'.repeat(64)}`;

function targetAndAuthority() {
  return {
    schema: 'kd320-q2-admission-candidate/v1',
    target: {
      b313Edition: '2024',
      viii3Edition: '2025',
      methodId: 'KD3-FATIGUE-001',
      routeId: 'ROUTE-KD3-2024',
    },
    authority: {
      nativeCoreKd3Qualified: false,
      codeCompliance: false,
      canUseForDesignAuthority: false,
      productionKernelAllowed: false,
      automaticPromotionAllowed: false,
    },
  };
}

function pendingCandidate() {
  return {
    ...targetAndAuthority(),
    sourceReceipts: ['Q1-SRC-B313-2024', 'Q1-SRC-VIII3-2025'].map((receiptId) => ({
      receiptId,
      status: 'PENDING_CONTROLLED_SOURCE_RECEIPT',
      secureStorageRef: null,
      documentSha256: null,
      exactLocators: [],
      verifiedBy: null,
      verifiedAt: null,
      independentCheckBy: null,
      independentCheckedAt: null,
    })),
    semanticItems: KD320_Q2_REQUIRED_SEMANTICS.map((semanticId, index) => ({
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
    })),
    q1ExitAttestation: null,
  };
}

function receipt(receiptId, documentSha256) {
  return {
    receiptId,
    status: 'VERIFIED',
    secureStorageRef: `secure://${receiptId}`,
    documentSha256,
    exactLocators: ['controlled-locator'],
    verifiedBy: 'Extractor A',
    verifiedAt: ISO_A,
    independentCheckBy: 'Checker B',
    independentCheckedAt: ISO_B,
  };
}

function semantic(semanticId, index) {
  return {
    semanticId,
    status: 'INDEPENDENTLY_CHECKED',
    controlledSourceRef: index === 0 ? 'Q1-SRC-B313-2024' : 'Q1-SRC-VIII3-2025',
    exactSourceLocator: `controlled-locator-${index + 1}`,
    controlledSemanticRef: `secure://semantic/${semanticId}`,
    units: 'METHOD_SPECIFIC',
    signConvention: 'CONTROLLED_RULE_RECORDED',
    selectionRule: 'CONTROLLED_RULE_RECORDED',
    interpolationRule: 'CONTROLLED_RULE_RECORDED_OR_NOT_APPLICABLE',
    applicabilityRule: 'CONTROLLED_RULE_RECORDED',
    extractedBy: 'Extractor A',
    extractedAt: ISO_A,
    independentCheckBy: 'Checker B',
    independentCheckedAt: ISO_B,
  };
}

function formalExit(sourceReceipts, semanticItems, overrides = {}) {
  return {
    schema: 'kd320-q1-exit-attestation/v1',
    recordId: 'VR-B313-CH9-KD320-NATIVE-001-Q1',
    status: KD320_Q1_EXIT_STATUS,
    controlledEvidenceLedgerRef: 'secure://q1/evidence-ledger',
    controlledEvidenceLedgerSha256: HASH_C,
    q1AuditReportRef: 'secure://q1/audit-report',
    q1AuditReportSha256: HASH_D,
    sourceReceipts: sourceReceipts.map(({ receiptId, documentSha256 }) => ({ receiptId, documentSha256 })),
    semanticBindings: semanticItems.map((item) => ({
      semanticId: item.semanticId,
      controlledSourceRef: item.controlledSourceRef,
      exactSourceLocator: item.exactSourceLocator,
      controlledSemanticRef: item.controlledSemanticRef,
    })),
    evidencePassRefs: [...KD320_Q1_EXIT_EVIDENCE_REFS],
    gatePassRefs: [...KD320_Q1_EXIT_GATE_REFS],
    attestedBy: 'Q1 Engineer A',
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
    ...overrides,
  };
}

function chain(correctionSemanticRef = 'KD320-SEM-006') {
  return {
    alternatingStressIntensityMpa: 63.299495811,
    associatedMeanStressMpa: 27.6830252,
    correctionParameters: [{
      name: 'CONTROLLED_PARAMETER_1',
      value: 0.2,
      units: 'DIMENSIONLESS',
      semanticRef: correctionSemanticRef,
    }],
    equivalentAlternatingStressMpa: 70,
    permissibleCycles: 10000,
  };
}

function projectOracle(overrides = {}) {
  return {
    benchmarkId: 'KD3-QF-023',
    evidenceClass: 'INDEPENDENT_CHECKED_PROJECT_CALCULATION',
    methodId: 'KD3-FATIGUE-001',
    routeId: 'ROUTE-KD3-2024',
    calculationRef: 'CALC-KD3-001',
    locationId: 'BORE',
    b313Edition: '2024',
    viii3Edition: '2025',
    controlledSourceReceiptRefs: ['Q1-SRC-B313-2024', 'Q1-SRC-VIII3-2025'],
    semanticRefs: [...KD320_Q2_METHOD_SEMANTICS],
    chain: chain(),
    calculatedBy: 'Engineer A',
    calculatedAt: ISO_A,
    checkedBy: 'Engineer B',
    checkedAt: ISO_B,
    ...overrides,
  };
}

function publishedOracle(overrides = {}) {
  return {
    benchmarkId: 'KD3-QF-022',
    evidenceClass: 'PRIMARY_PUBLISHED_NUMERICAL_ORACLE',
    viii3Edition: '2025',
    methodId: 'KD3-FATIGUE-001',
    bibliographicRef: 'PRIMARY-PUBLICATION-REF',
    exactLocator: 'worked-example-locator',
    sourceSha256: HASH_A,
    semanticRefs: [...KD320_Q2_METHOD_SEMANTICS],
    controlledSourceReceiptRefs: [...KD320_Q2_PUBLISHED_REQUIRED_RECEIPTS],
    chain: chain(),
    extractedBy: 'Researcher A',
    extractedAt: ISO_A,
    admittedBy: 'Reviewer B',
    admittedAt: ISO_B,
    ...overrides,
  };
}

function readyCandidate() {
  const sourceReceipts = [
    receipt('Q1-SRC-B313-2024', HASH_A),
    receipt('Q1-SRC-VIII3-2025', HASH_B),
  ];
  const semanticItems = KD320_Q2_REQUIRED_SEMANTICS.map(semantic);
  return {
    ...targetAndAuthority(),
    sourceReceipts,
    semanticItems,
    q1ExitAttestation: formalExit(sourceReceipts, semanticItems),
    projectOracle: projectOracle(),
    publishedOracle: publishedOracle(),
  };
}

function hasBlocker(result, prefix) {
  return result.blockers.some((code) => code.startsWith(prefix));
}

test('pending Q2 candidate enumerates blockers across receipts, semantics and formal Q1 exit', () => {
  const result = evaluateKd320Q2AdmissionCandidate(pendingCandidate());
  assert.equal(result.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert.equal(result.q1Complete, false);
  assert.ok(result.blockers.includes('Q1-SRC-B313-2024:STATUS_NOT_VERIFIED'));
  assert.ok(result.blockers.includes('Q1-SRC-VIII3-2025:STATUS_NOT_VERIFIED'));
  assert.ok(result.blockers.includes('KD320-SEM-001:STATUS_NOT_INDEPENDENTLY_CHECKED'));
  assert.ok(result.blockers.includes('KD320-SEM-014:STATUS_NOT_INDEPENDENTLY_CHECKED'));
  assert.ok(result.blockers.includes('Q1_EXIT_ATTESTATION_MISSING'));
});

test('receipts and semantics alone never produce formal Q1 completion', () => {
  const candidate = readyCandidate();
  candidate.q1ExitAttestation = null;
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.q1Complete, false);
  assert.equal(result.q2OracleAdmissionReady, false);
  assert.equal(result.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert.ok(result.blockers.includes('Q1_EXIT_ATTESTATION_MISSING'));
});

test('full Q2 evidence reaches admission readiness only with formal Q1 exit and semantic custody', () => {
  const result = evaluateKd320Q2AdmissionCandidate(readyCandidate());
  assert.equal(result.ok, true);
  assert.equal(result.q1Exit.ready, true);
  assert.equal(result.q2OracleAdmissionReady, true);
  assert.equal(result.state, 'Q2_ORACLE_ADMISSION_READY');
  assert.deepEqual(result.oracleCustody.methodSemanticRefs, KD320_Q2_METHOD_SEMANTICS);
  assert.equal(result.oracleCustody.chainSemanticCustody.alternatingStressIntensityMpa, 'KD320-SEM-003');
  assert.equal(result.oracleCustody.chainSemanticCustody.permissibleCycles, 'KD320-SEM-010');
  assert.equal(result.authority.nativeCoreKd3Qualified, false);
  assert.equal(result.authority.productionKernelAllowed, false);
});

test('formal Q1 exit cannot claim G1 without the exact gate set', () => {
  const candidate = readyCandidate();
  candidate.q1ExitAttestation.gatePassRefs = ['G0'];
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.q1Complete, false);
  assert.ok(result.blockers.some((code) => code.includes('Q1_EXIT_GATE_REFS_MISSING:G1')));
});

test('QF023 cannot omit applicability or fail-closed semantics SEM-012/013', () => {
  const candidate = readyCandidate();
  candidate.projectOracle.semanticRefs = candidate.projectOracle.semanticRefs
    .filter((id) => !['KD320-SEM-012', 'KD320-SEM-013'].includes(id));
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.q2OracleAdmissionReady, false);
  assert.equal(result.state, 'Q2_PRIMARY_ORACLE_RETAINED_PROJECT_PENDING');
  assert(hasBlocker(result, 'PROJECT_ORACLE:SEMANTIC_REFS_INCOMPLETE:'));
  assert(result.blockers.some((code) => code.includes('KD320-SEM-012')));
  assert(result.blockers.some((code) => code.includes('KD320-SEM-013')));
});

test('QF022 cannot omit target-edition fail-closed semantic SEM-013', () => {
  const candidate = readyCandidate();
  candidate.publishedOracle.semanticRefs = candidate.publishedOracle.semanticRefs
    .filter((id) => id !== 'KD320-SEM-013');
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.q2OracleAdmissionReady, false);
  assert.equal(result.state, 'Q2_PROJECT_ORACLE_RETAINED_PRIMARY_PENDING');
  assert(hasBlocker(result, 'PRIMARY_PUBLISHED_ORACLE:SEMANTIC_REFS_INCOMPLETE:'));
  assert(result.blockers.some((code) => code.includes('KD320-SEM-013')));
});

test('QF022 requires controlled VIII-3 2025 source-receipt custody', () => {
  const candidate = readyCandidate();
  candidate.publishedOracle.controlledSourceReceiptRefs = [];
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.q2OracleAdmissionReady, false);
  assert(hasBlocker(result, 'PRIMARY_PUBLISHED_ORACLE:SOURCE_RECEIPT_REFS_INCOMPLETE:'));
  assert(result.blockers.some((code) => code.includes('Q1-SRC-VIII3-2025')));
});

test('correction parameters cannot cite non-method SEM-001 or SEM-014 custody', () => {
  for (const semanticRef of ['KD320-SEM-001', 'KD320-SEM-014']) {
    const candidate = readyCandidate();
    candidate.projectOracle.chain = chain(semanticRef);
    const result = evaluateKd320Q2AdmissionCandidate(candidate);
    assert.equal(result.q2OracleAdmissionReady, false);
    assert(result.blockers.includes('PROJECT_ORACLE:CORRECTION_PARAMETER_INVALID'));
  }
});

test('oracle custody blockers are enumerated even while Q1 controlled evidence is pending', () => {
  const candidate = pendingCandidate();
  candidate.projectOracle = projectOracle({ semanticRefs: ['KD320-SEM-003'] });
  const result = evaluateKd320Q2AdmissionCandidate(candidate);
  assert.equal(result.state, 'Q1_CONTROLLED_EVIDENCE_PENDING');
  assert.equal(result.q1Complete, false);
  assert(hasBlocker(result, 'PROJECT_ORACLE:SEMANTIC_REFS_INCOMPLETE:'));
  assert(result.blockers.some((code) => code.includes('KD320-SEM-013')));
});
