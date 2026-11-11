import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createVibrationActionCompletionRecord,
  createVibrationActionOccurrence,
} from '../converters/vibration/facility/action-completion.js';
import {
  appendVibrationActionCompletionRecord,
  createVibrationActionCompletionLedger,
} from '../converters/vibration/facility/action-completion-ledger.js';
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
  createVibrationMitigationImplementation,
  createVibrationMitigationProposal,
} from '../converters/vibration/mitigation/contracts.js';
import {
  appendVibrationMitigationImplementation,
  appendVibrationMitigationProposal,
  createVibrationMitigationLedger,
} from '../converters/vibration/mitigation/ledger.js';
import {
  VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2,
  VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY,
  assertVibrationIntegrityProject,
  attachVibrationProjectLifecycleLedgers,
  migrateVibrationIntegrityProjectToV2,
  vibrationProjectLifecycleLedgers,
} from '../converters/vibration/project/schema.js';
import {
  parseVibrationIntegrityProject,
  serializeVibrationIntegrityProject,
} from '../converters/vibration/project/serialize.js';
import { createVibrationRcaHypothesis } from '../converters/vibration/rca/contracts.js';
import {
  appendVibrationRcaHypothesis,
  createVibrationRcaLedger,
} from '../converters/vibration/rca/ledger.js';
import {
  VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY,
  assertVibrationProjectLifecycleHandoff,
  createVibrationProjectLifecycleHandoff,
  createVibrationProjectLifecycleHandoffFromState,
} from '../tabs/vibration-project-lifecycle-handoff.js';
import { createVibrationRoadmapController } from '../tabs/vibration-roadmap-controller.js';
import {
  VERIFICATION_SNAPSHOT_HASH,
  verificationEvidencePackage,
  verificationProject,
} from './vibration-verification-fixtures.mjs';

const PROJECT_ID = 'P-1';

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
    runId: 'RUN-1', datasetId: 'DATASET-1', scenarioSetKey: 'VFSK1-project-v2',
  });
  return createVibrationActionOccurrence({
    action: actionInput,
    runBasis,
    scenarioExecutionBasis: {
      datasetId: 'DATASET-1',
      scenarioId: 'OCS-1',
      scenarioSnapshotHash: VERIFICATION_SNAPSHOT_HASH,
      line: 'L-1',
      caseId: 'NORMAL',
    },
  });
}

function lifecycleLedgers(projectId = PROJECT_ID) {
  const actionInput = action();
  const occurrenceInput = occurrence(actionInput);

  const completion = createVibrationActionCompletionRecord({
    occurrence: occurrenceInput,
    sequence: 1,
    transition: 'COMPLETE',
    recordedAt: '2026-09-02T09:00:00Z',
    actorId: 'ENGINEER-1',
    reason: 'Required action completed with retained field evidence.',
    evidenceRefs: ['FIELD-PACK-001'],
  });
  const actionCompletionLedger = appendVibrationActionCompletionRecord(
    createVibrationActionCompletionLedger(),
    completion,
  );

  const requirement = createVibrationActionVerificationRequirement({
    action: actionInput,
    occurrence: occurrenceInput,
    requirementId: 'VERIFY-1',
    requirementType: 'BASIC_MEASUREMENT',
    reason: 'Verify the exact action occurrence using retained field measurement evidence.',
    requiredProductTypes: ['OVERALL'],
  });
  const attachment = createVibrationActionVerificationAttachment({
    action: actionInput,
    occurrence: occurrenceInput,
    requirement,
    measurementEvidence: verificationEvidencePackage(),
  });
  const actionVerificationLedger = appendVibrationActionVerificationAttachment(
    createVibrationActionVerificationLedger(),
    projectId,
    attachment,
    '2026-09-02T09:01:00Z',
  );

  const hypothesis = createVibrationRcaHypothesis({
    projectId,
    occurrence: occurrenceInput,
    mechanismId: actionInput.mechanismId,
    verificationLedger: actionVerificationLedger,
    hypothesisId: 'RCA-1',
    statement: 'Observed response is consistent with the identified vibration mechanism.',
    evidenceForRecordIds: [actionVerificationLedger.records[0].recordId],
  });
  const rcaLedger = appendVibrationRcaHypothesis(
    createVibrationRcaLedger(),
    projectId,
    hypothesis,
    '2026-09-02T09:02:00Z',
  );

  const proposal = createVibrationMitigationProposal({
    projectId,
    action: actionInput,
    occurrence: occurrenceInput,
    proposalId: 'MIT-1',
    engineerId: 'ENGINEER-1',
    proposedAt: '2026-09-02T09:03:00Z',
    proposalText: 'Modify the local support arrangement following detailed engineering design review.',
    rationale: 'Project custody only; this proposal does not approve design or predict benefit.',
    verificationLedger: actionVerificationLedger,
    verificationRecordIds: [actionVerificationLedger.records[0].recordId],
    rcaLedger,
    rcaRecordIds: [rcaLedger.records[0].recordId],
    evidenceRefs: ['ENG-NOTE-001'],
  });
  let mitigationLedger = appendVibrationMitigationProposal(createVibrationMitigationLedger(), proposal);
  const implementation = createVibrationMitigationImplementation({
    proposal,
    implementationId: 'IMPL-1',
    implementedBy: 'FIELD-ENGINEER-1',
    implementedAt: '2026-09-02T09:04:00Z',
    implementationStatement: 'Modification installed under the separately approved field package.',
    evidenceRefs: ['WORK-PACK-001'],
  });
  mitigationLedger = appendVibrationMitigationImplementation(mitigationLedger, implementation);

  return {
    actionCompletionLedger,
    actionVerificationLedger,
    rcaLedger,
    mitigationLedger,
  };
}

function v1Project() {
  return verificationProject(verificationEvidencePackage());
}

function fakeContainer(events = []) {
  class FakeCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }
  return {
    ownerDocument: {
      defaultView: {
        CustomEvent: FakeCustomEvent,
        localStorage: {
          getItem() { return null; },
          setItem() {},
          removeItem() {},
        },
        addEventListener() {},
        removeEventListener() {},
      },
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent(event) { events.push(event); return true; },
  };
}

test('v1 projects remain valid and serialize without implicit migration', () => {
  const project = v1Project();
  assert.equal(assertVibrationIntegrityProject(project), project);
  const restored = parseVibrationIntegrityProject(serializeVibrationIntegrityProject(project));
  assert.equal(restored.schema, 'VibrationIntegrityProject.v1');
  assert.deepEqual(restored, project);
});

test('v1 migration creates a closed non-authorizing v2 project with empty lifecycle custody', () => {
  const project = migrateVibrationIntegrityProjectToV2(v1Project());
  assert.equal(project.schema, VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2);
  assert.deepEqual(project.authority, VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY);
  assert.equal(project.currentResults.length, 0);
  assert.equal(project.historicalCalculationEvidence.length, 0);
  assert.equal(project.activity.actionCompletion.ledger.records.length, 0);
  assert.equal(project.activity.actionVerification.ledger.records.length, 0);
  assert.equal(project.activity.rca.ledger.records.length, 0);
  assert.equal(project.activity.mitigation.ledger.records.length, 0);
  assert.equal(project.authority.calculationEligibilityAuthority, false);
});

test('legacy unknown v1 top-level values migrate only into explicit extensions', () => {
  const source = { ...v1Project(), futureLegacyField: { retained: true } };
  const migrated = migrateVibrationIntegrityProjectToV2(source);
  assert.deepEqual(migrated.extensions.legacyV1TopLevel.futureLegacyField, { retained: true });
  assert.equal('futureLegacyField' in migrated, false);
  const injected = JSON.parse(JSON.stringify(migrated));
  injected.unregisteredTopLevel = true;
  assert.throws(
    () => assertVibrationIntegrityProject(injected),
    (error) => error?.code === 'VIBRATION_PROJECT_V2_SHAPE_INVALID',
  );
});

test('M13-M16 lifecycle ledgers persist through deterministic vibproj round-trip without authority promotion', () => {
  const attached = attachVibrationProjectLifecycleLedgers(v1Project(), lifecycleLedgers());
  assert.equal(attached.schema, VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2);
  assert.equal(attached.activity.actionCompletion.ledger.records.length, 1);
  assert.equal(attached.activity.actionVerification.ledger.records.length, 1);
  assert.equal(attached.activity.rca.ledger.records.length, 1);
  assert.equal(attached.activity.mitigation.ledger.records.length, 2);
  assert.equal(attached.activity.actionCompletion.ledger.authority.persistenceAuthority, 'NONE');
  assert.equal(attached.activity.actionVerification.ledger.authority.persistenceAuthority, 'NONE');
  assert.equal(attached.activity.rca.ledger.authority.persistenceAuthority, 'NONE');
  assert.equal(attached.activity.mitigation.ledger.authority.persistenceAuthority, 'NONE');
  assert.equal(attached.authority.lifecycleEvidenceIsCurrentEngineeringAuthority, false);
  assert.equal(attached.authority.screeningAuthorized, false);
  assert.equal(attached.authority.designAuthority, false);

  const serialized = serializeVibrationIntegrityProject(attached);
  const restored = parseVibrationIntegrityProject(serialized);
  assert.deepEqual(vibrationProjectLifecycleLedgers(restored), vibrationProjectLifecycleLedgers(attached));
  assert.equal(serializeVibrationIntegrityProject(restored), serialized);
});

test('project-scoped M14-M16 records from another project fail closed', () => {
  const foreign = lifecycleLedgers('P-FOREIGN');
  assert.throws(
    () => attachVibrationProjectLifecycleLedgers(v1Project(), foreign),
    (error) => error?.code === 'VIBRATION_PROJECT_V2_ACTIVITY_RECORD_PROJECT_MISMATCH',
  );
});

test('current and historical calculation evidence cannot be smuggled into v2 persistence', () => {
  const project = attachVibrationProjectLifecycleLedgers(v1Project(), lifecycleLedgers());
  const current = JSON.parse(JSON.stringify(project));
  current.currentResults.push({ result: 'forbidden' });
  assert.throws(
    () => assertVibrationIntegrityProject(current),
    (error) => error?.code === 'VIBRATION_PROJECT_CURRENT_RESULT_CONTRACT_UNQUALIFIED',
  );
  const historical = JSON.parse(JSON.stringify(project));
  historical.historicalCalculationEvidence.push({ result: 'reserved-not-qualified' });
  assert.throws(
    () => assertVibrationIntegrityProject(historical),
    (error) => error?.code === 'VIBRATION_PROJECT_V2_HISTORICAL_CALCULATION_CONTRACT_UNQUALIFIED',
  );
});

test('v2 authority is closed against persistence-driven engineering or calculation promotion', () => {
  const project = attachVibrationProjectLifecycleLedgers(v1Project(), lifecycleLedgers());
  for (const [key, value] of [
    ['screeningAuthorized', true],
    ['designAuthority', true],
    ['calculationEligibilityAuthority', true],
    ['lifecycleEvidenceIsCurrentEngineeringAuthority', true],
  ]) {
    const tampered = JSON.parse(JSON.stringify(project));
    tampered.authority[key] = value;
    assert.throws(
      () => assertVibrationIntegrityProject(tampered),
      (error) => error?.code === 'VIBRATION_PROJECT_V2_AUTHORITY_INVALID',
    );
  }
});

test('lifecycle handoff preserves project scope and rejects authority promotion', () => {
  const project = attachVibrationProjectLifecycleLedgers(v1Project(), lifecycleLedgers());
  const handoff = createVibrationProjectLifecycleHandoff({ project });
  assert.equal(handoff.projectId, PROJECT_ID);
  assert.equal(handoff.actionCompletionLedger.records.length, 1);
  assert.equal(handoff.actionVerificationLedger.records.length, 1);
  assert.equal(handoff.rcaLedger.records.length, 1);
  assert.equal(handoff.mitigationLedger.records.length, 2);
  assert.deepEqual(handoff.authority, VIBRATION_PROJECT_LIFECYCLE_HANDOFF_AUTHORITY);

  const promoted = JSON.parse(JSON.stringify(handoff));
  promoted.authority.screeningAuthority = 'AUTHORIZED';
  assert.throws(
    () => assertVibrationProjectLifecycleHandoff(promoted),
    (error) => error?.code === 'VIBRATION_PROJECT_LIFECYCLE_AUTHORITY_INVALID',
  );
});

test('v1 project lifecycle handoff is empty until an explicit lifecycle mutation upgrades the project', () => {
  const handoff = createVibrationProjectLifecycleHandoff({ project: v1Project() });
  assert.equal(handoff.projectId, PROJECT_ID);
  assert.equal(handoff.actionCompletionLedger.records.length, 0);
  assert.equal(handoff.actionVerificationLedger.records.length, 0);
  assert.equal(handoff.rcaLedger.records.length, 0);
  assert.equal(handoff.mitigationLedger.records.length, 0);
});

test('roadmap controller persists an exact lifecycle handoff and upgrades v1 without changing calculation authority', () => {
  const events = [];
  const controller = createVibrationRoadmapController(fakeContainer(events), {
    initialState: { project: v1Project(), context: { lineId: 'L-1' } },
  });
  const handoff = createVibrationProjectLifecycleHandoffFromState({
    projectId: PROJECT_ID,
    state: lifecycleLedgers(),
  });
  const persisted = controller.applyLifecycleHandoff(handoff);
  assert.equal(persisted.schema, VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2);
  assert.equal(persisted.activity.actionCompletion.ledger.records.length, 1);
  assert.equal(persisted.activity.mitigation.ledger.records.length, 2);
  assert.equal(persisted.authority.screeningAuthorized, false);
  assert.equal(persisted.authority.designAuthority, false);
  assert.equal(persisted.authority.calculationEligibilityAuthority, false);
  const changed = events.find((event) => event.type === 'vibration-project-changed');
  assert.equal(changed?.detail?.project?.schema, VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2);
  assert.equal(changed?.detail?.lineId, 'L-1');
  controller.destroy();
});

test('roadmap controller rejects lifecycle custody from another project without replacing current project', () => {
  const controller = createVibrationRoadmapController(fakeContainer(), {
    initialState: { project: v1Project(), context: { lineId: 'L-1' } },
  });
  const foreign = createVibrationProjectLifecycleHandoffFromState({
    projectId: 'P-FOREIGN',
    state: lifecycleLedgers('P-FOREIGN'),
  });
  assert.equal(controller.applyLifecycleHandoff(foreign), null);
  controller.destroy();
});
