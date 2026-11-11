import assert from 'node:assert/strict';
import test from 'node:test';

import { createVibrationActionOccurrence } from '../converters/vibration/facility/action-completion.js';
import {
  createVibrationActionVerificationAttachment,
  createVibrationActionVerificationRequirement,
} from '../converters/vibration/facility/action-verification.js';
import {
  appendVibrationActionVerificationAttachment,
  createVibrationActionVerificationLedger,
} from '../converters/vibration/facility/action-verification-ledger.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';
import {
  VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY,
  VIBRATION_MITIGATION_PROPOSAL_AUTHORITY,
  assertVibrationMitigationImplementation,
  assertVibrationMitigationProposal,
  createVibrationMitigationImplementation,
  createVibrationMitigationProposal,
} from '../converters/vibration/mitigation/contracts.js';
import {
  VIBRATION_MITIGATION_LEDGER_AUTHORITY,
  appendVibrationMitigationImplementation,
  appendVibrationMitigationProposal,
  assertVibrationMitigationLedger,
  createVibrationMitigationLedger,
} from '../converters/vibration/mitigation/ledger.js';
import { createVibrationRcaHypothesis } from '../converters/vibration/rca/contracts.js';
import {
  appendVibrationRcaHypothesis,
  createVibrationRcaLedger,
} from '../converters/vibration/rca/ledger.js';
import { verificationEvidencePackage } from './vibration-verification-fixtures.mjs';

const PROJECT_ID = 'P-1';
const SNAPSHOT_HASH = `sha256:${'c'.repeat(64)}`;

function action() {
  return {
    schema: 'VibrationRequiredAction.v1',
    actionId: 'ACTION-1',
    mechanismId: 'fit',
    scope: { line: 'L-1', caseId: 'NORMAL', canonicalId: 'CAN-1' },
    module: 'FIT',
    actionKey: 'FURTHER_ASSESSMENT',
    obligation: 'SHALL',
    reason: 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED',
    completionState: 'OPEN',
    resultState: 'CURRENT_RESULT',
    source: { kind: 'FIT_SCREENING_CONTINUATION' },
  };
}

function occurrence(actionInput = action()) {
  const runBasis = createVibrationFacilityRunBasis({
    runId: 'RUN-1', datasetId: 'DATASET-1', scenarioSetKey: 'VFSK1-test',
  });
  return createVibrationActionOccurrence({
    action: actionInput,
    runBasis,
    scenarioExecutionBasis: {
      datasetId: 'DATASET-1',
      scenarioId: 'OCS-1',
      scenarioSnapshotHash: SNAPSHOT_HASH,
      line: 'L-1',
      caseId: 'NORMAL',
    },
  });
}

function verificationLedger(actionInput, occurrenceInput) {
  const requirement = createVibrationActionVerificationRequirement({
    action: actionInput,
    occurrence: occurrenceInput,
    requirementId: 'VERIFY-1',
    requirementType: 'BASIC_MEASUREMENT',
    reason: 'Field evidence supporting mitigation engineering judgement.',
    requiredProductTypes: ['OVERALL'],
  });
  const attachment = createVibrationActionVerificationAttachment({
    action: actionInput,
    occurrence: occurrenceInput,
    requirement,
    measurementEvidence: verificationEvidencePackage(),
  });
  return appendVibrationActionVerificationAttachment(
    createVibrationActionVerificationLedger(),
    PROJECT_ID,
    attachment,
    '2026-09-02T04:45:00Z',
  );
}

function rcaLedger(actionInput, occurrenceInput, verification) {
  const verificationRecord = verification.records[0];
  const hypothesis = createVibrationRcaHypothesis({
    projectId: PROJECT_ID,
    occurrence: occurrenceInput,
    mechanismId: actionInput.mechanismId,
    verificationLedger: verification,
    hypothesisId: 'RCA-1',
    statement: 'The observed response is consistent with the identified vibration mechanism.',
    evidenceForRecordIds: [verificationRecord.recordId],
  });
  return appendVibrationRcaHypothesis(
    createVibrationRcaLedger(),
    PROJECT_ID,
    hypothesis,
    '2026-09-02T04:46:00Z',
  );
}

function proposalFixture({ includeBasis = true } = {}) {
  const actionInput = action();
  const occurrenceInput = occurrence(actionInput);
  const verification = verificationLedger(actionInput, occurrenceInput);
  const rca = rcaLedger(actionInput, occurrenceInput, verification);
  return createVibrationMitigationProposal({
    projectId: PROJECT_ID,
    action: actionInput,
    occurrence: occurrenceInput,
    proposalId: 'MIT-1',
    engineerId: 'ENGINEER-1',
    proposedAt: '2026-09-02T04:50:00Z',
    proposalText: 'Modify the local support arrangement following detailed engineering design review.',
    rationale: 'Mitigation is proposed for the exact current action occurrence; this record does not approve the design or predict benefit.',
    verificationLedger: verification,
    verificationRecordIds: includeBasis ? [verification.records[0].recordId] : [],
    rcaLedger: rca,
    rcaRecordIds: includeBasis ? [rca.records[0].recordId] : [],
    evidenceRefs: ['ENG-NOTE-001'],
  });
}

test('M16 custody cannot create screening, design, completion, numerical or recommendation authority', () => {
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.completionAuthority, 'NONE');
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.automaticRecommendation, false);
  assert.equal(VIBRATION_MITIGATION_PROPOSAL_AUTHORITY.predictedBenefitAuthority, 'NONE');
  assert.equal(VIBRATION_MITIGATION_IMPLEMENTATION_AUTHORITY.postModificationVerificationAuthority, 'NONE');
  assert.equal(VIBRATION_MITIGATION_LEDGER_AUTHORITY.persistenceAuthority, 'NONE');
});

test('proposal accepts a full lifecycle action but stores a canonical action custody snapshot', () => {
  const proposal = proposalFixture({ includeBasis: false });
  assert.deepEqual(Object.keys(proposal.action).sort(), ['actionId', 'mechanismId', 'schema', 'scope']);
  assert.equal(proposal.action.actionId, 'ACTION-1');
  assert.equal(proposal.action.mechanismId, 'fit');
});

test('proposal binds exact occurrence plus optional M14 verification and M15 RCA snapshots', () => {
  const proposal = proposalFixture();
  assert.match(proposal.proposalFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(proposal.basis.verificationRecords.length, 1);
  assert.equal(proposal.basis.rcaRecords.length, 1);
  assert.match(proposal.basis.verificationRecords[0].verificationStatusFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.match(proposal.basis.rcaRecords[0].hypothesisFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(assertVibrationMitigationProposal(proposal), proposal);
});

test('RCA is optional and no root-cause prerequisite is inferred', () => {
  const proposal = proposalFixture({ includeBasis: false });
  assert.equal(proposal.basis.verificationRecords.length, 0);
  assert.equal(proposal.basis.rcaRecords.length, 0);
});

test('foreign verification or RCA references fail closed', () => {
  const actionInput = action();
  const occurrenceInput = occurrence(actionInput);
  assert.throws(
    () => createVibrationMitigationProposal({
      projectId: PROJECT_ID,
      action: actionInput,
      occurrence: occurrenceInput,
      proposalId: 'MIT-FOREIGN-V', engineerId: 'ENGINEER-1', proposedAt: '2026-09-02T04:51:00Z',
      proposalText: 'Proposal.', rationale: 'Rationale.',
      verificationLedger: createVibrationActionVerificationLedger(),
      verificationRecordIds: ['FOREIGN-VERIFY'],
    }),
    (error) => error?.code === 'VIBRATION_MITIGATION_VERIFICATION_REFERENCE_FOREIGN',
  );
  assert.throws(
    () => createVibrationMitigationProposal({
      projectId: PROJECT_ID,
      action: actionInput,
      occurrence: occurrenceInput,
      proposalId: 'MIT-FOREIGN-R', engineerId: 'ENGINEER-1', proposedAt: '2026-09-02T04:51:00Z',
      proposalText: 'Proposal.', rationale: 'Rationale.',
      rcaLedger: createVibrationRcaLedger(),
      rcaRecordIds: ['FOREIGN-RCA'],
    }),
    (error) => error?.code === 'VIBRATION_MITIGATION_RCA_REFERENCE_FOREIGN',
  );
});

test('proposal fingerprint rejects post-creation engineering-text drift', () => {
  const proposal = JSON.parse(JSON.stringify(proposalFixture()));
  proposal.proposalText = 'Tampered mitigation proposal.';
  assert.throws(
    () => assertVibrationMitigationProposal(proposal),
    (error) => error?.code === 'VIBRATION_MITIGATION_PROPOSAL_FINGERPRINT_INVALID',
  );
});

test('proposal rejects added authority claims and unsupported stored action fields', () => {
  const authorityTamper = JSON.parse(JSON.stringify(proposalFixture()));
  authorityTamper.authority.designApproval = true;
  assert.throws(
    () => assertVibrationMitigationProposal(authorityTamper),
    (error) => error?.code === 'VIBRATION_MITIGATION_PROPOSAL_AUTHORITY_INVALID',
  );
  const actionTamper = JSON.parse(JSON.stringify(proposalFixture()));
  actionTamper.action.designAuthority = true;
  assert.throws(
    () => assertVibrationMitigationProposal(actionTamper),
    (error) => error?.code === 'VIBRATION_MITIGATION_ACTION_SHAPE_INVALID',
  );
});

test('implementation is explicit caller attestation with evidence and no automatic action completion', () => {
  const proposal = proposalFixture();
  const implementation = createVibrationMitigationImplementation({
    proposal,
    implementationId: 'IMPL-1',
    implementedBy: 'FIELD-ENGINEER-1',
    implementedAt: '2026-09-02T05:00:00Z',
    implementationStatement: 'Support modification installed in accordance with the separately approved field package.',
    evidenceRefs: ['PHOTO-PACK-001', 'WORK-PACK-001'],
  });
  assert.equal(implementation.authority.completionAuthority, 'NONE');
  assert.equal(implementation.authority.predictedBenefitAuthority, 'NONE');
  assert.match(implementation.implementationFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(assertVibrationMitigationImplementation(implementation), implementation);
});

test('implementation fails closed without caller evidence', () => {
  assert.throws(
    () => createVibrationMitigationImplementation({
      proposal: proposalFixture(),
      implementationId: 'IMPL-NO-EVIDENCE', implementedBy: 'FIELD-ENGINEER-1',
      implementedAt: '2026-09-02T05:01:00Z', implementationStatement: 'Installed.', evidenceRefs: [],
    }),
    (error) => error?.code === 'VIBRATION_MITIGATION_IMPLEMENTATION_EVIDENCE_REQUIRED',
  );
});

test('append-only ledger requires proposal before its exact implementation and rejects duplicate implementation', () => {
  const proposal = proposalFixture();
  const implementation = createVibrationMitigationImplementation({
    proposal,
    implementationId: 'IMPL-1', implementedBy: 'FIELD-ENGINEER-1', implementedAt: '2026-09-02T05:02:00Z',
    implementationStatement: 'Installed.', evidenceRefs: ['WORK-PACK-001'],
  });
  assert.throws(
    () => appendVibrationMitigationImplementation(createVibrationMitigationLedger(), implementation),
    (error) => error?.code === 'VIBRATION_MITIGATION_LEDGER_PROPOSAL_REQUIRED',
  );
  let ledger = appendVibrationMitigationProposal(createVibrationMitigationLedger(), proposal);
  ledger = appendVibrationMitigationImplementation(ledger, implementation);
  assert.equal(ledger.records.length, 2);
  assert.equal(ledger.records[0].entryType, 'PROPOSAL');
  assert.equal(ledger.records[1].entryType, 'IMPLEMENTATION');
  assert.equal(assertVibrationMitigationLedger(ledger), ledger);
  assert.throws(
    () => appendVibrationMitigationImplementation(ledger, implementation),
    (error) => error?.code === 'VIBRATION_MITIGATION_LEDGER_DUPLICATE_IMPLEMENTATION',
  );
});

test('ledger and record fingerprints reject post-append custody drift or authority promotion', () => {
  const proposal = proposalFixture();
  const ledger = appendVibrationMitigationProposal(createVibrationMitigationLedger(), proposal);
  const parsed = JSON.parse(JSON.stringify(ledger));
  parsed.records[0].proposal.rationale = 'Tampered rationale.';
  assert.throws(
    () => assertVibrationMitigationLedger(parsed),
    (error) => error?.code === 'VIBRATION_MITIGATION_PROPOSAL_FINGERPRINT_INVALID',
  );
  const authorityTamper = JSON.parse(JSON.stringify(ledger));
  authorityTamper.authority.persistent = true;
  assert.throws(
    () => assertVibrationMitigationLedger(authorityTamper),
    (error) => error?.code === 'VIBRATION_MITIGATION_LEDGER_AUTHORITY_INVALID',
  );
});
