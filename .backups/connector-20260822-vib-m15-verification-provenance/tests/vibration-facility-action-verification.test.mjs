import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_ACTION_VERIFICATION_AUTHORITY,
  assertVibrationActionVerificationAttachment,
  createVibrationActionVerificationAttachment,
  createVibrationActionVerificationRequirement,
  vibrationVerificationScopeFromActionOccurrence,
} from '../converters/vibration/facility/action-verification.js';
import {
  createVibrationActionCompletionRecord,
  createVibrationActionOccurrence,
} from '../converters/vibration/facility/action-completion.js';
import { VIBRATION_REQUIRED_ACTION_SCHEMA } from '../converters/vibration/facility/action-lifecycle.js';
import { createVibrationFacilityRunBasis } from '../converters/vibration/facility/run-basis.js';

const SNAPSHOT_HASH = `sha256:${'a'.repeat(64)}`;
const RAW_HASH = `sha256:${'b'.repeat(64)}`;
const ARTIFACT_HASH = `sha256:${'c'.repeat(64)}`;

function action(overrides = {}) {
  return {
    schema: VIBRATION_REQUIRED_ACTION_SCHEMA,
    actionId: 'ACTION-FIT-1',
    mechanismId: 'fit',
    scope: { line: 'L-100', caseId: 'NORMAL', canonicalId: 'CAN-1' },
    ...overrides,
  };
}

function occurrence(runId = 'FIT-RUN-1', overrides = {}) {
  return createVibrationActionOccurrence({
    action: action(),
    runBasis: createVibrationFacilityRunBasis({
      runId,
      datasetId: 'DATASET-1',
      scenarioSetKey: 'VFSK1-example',
    }),
    scenarioExecutionBasis: {
      datasetId: 'DATASET-1',
      scenarioId: 'OS-1',
      scenarioSnapshotHash: SNAPSHOT_HASH,
      line: 'L-100',
      caseId: 'NORMAL',
      ...overrides,
    },
  });
}

function requirement(occ = occurrence()) {
  return createVibrationActionVerificationRequirement({
    action: action(),
    occurrence: occ,
    requirementId: 'VERIFY-1',
    requirementType: 'BASIC_MEASUREMENT',
    reason: 'Confirm field vibration response before closing the required action.',
    requiredProductTypes: ['OVERALL'],
  });
}

function measurementPackage(scope = vibrationVerificationScopeFromActionOccurrence(occurrence())) {
  return {
    schema: 'VibrationMeasurementEvidencePackage.v1',
    sessions: [{
      schema: 'VibrationMeasurementSession.v1',
      sessionId: 'SESSION-1',
      scope: { ...scope },
      acquisition: {
        startedAt: '2026-08-21T09:00:00Z',
        instrumentConfiguration: {
          source: 'FIELD_CONFIGURATION',
          sourceRevision: 'REV-1',
          configurationId: 'CFG-1',
          acquisitionSystemId: 'DAQ-1',
        },
      },
      channels: [{
        channelId: 'CH-1',
        quantity: 'velocity',
        unit: 'mm/s',
        sensor: {
          sensorId: 'SENSOR-1', sensorType: 'accelerometer', model: 'MODEL-1', serialNumber: 'SN-1',
        },
        location: { subjectType: 'PIPE', subjectId: 'L-100' },
        orientation: { referenceFrame: 'PIPE_LOCAL', direction: 'RADIAL' },
        calibration: {
          source: 'CAL_CERT', sourceRevision: 'REV-1', calibrationId: 'CAL-1', certificateId: 'CERT-1', validAtAcquisition: true,
        },
        sampling: { sampleRateHz: 2048, durationS: 10 },
        rawData: { artifactId: 'RAW-1', sha256: RAW_HASH, format: 'csv', immutable: true },
      }],
      source: { source: 'FIELD_CAMPAIGN', sourceRevision: 'REV-1', recordId: 'REC-1' },
      authority: {
        authority: 'FIELD_MEASUREMENT_EVIDENCE_ONLY',
        screeningAuthority: 'NOT_AUTHORIZED',
        designAuthority: false,
        rootCauseAuthority: false,
      },
    }],
    products: [{
      schema: 'VibrationSignalProduct.v1',
      productId: 'PRODUCT-1',
      sessionId: 'SESSION-1',
      channelIds: ['CH-1'],
      productType: 'OVERALL',
      inputRawDataHashes: [RAW_HASH],
      processing: {
        source: 'SIGNAL_PIPELINE', sourceRevision: 'REV-1', processingRecipeId: 'RECIPE-1', version: '1.0.0',
      },
      artifact: { artifactId: 'PRODUCT-ART-1', sha256: ARTIFACT_HASH, format: 'json' },
      authority: {
        authority: 'DERIVED_SIGNAL_EVIDENCE_ONLY',
        screeningAuthority: 'NOT_AUTHORIZED',
        designAuthority: false,
        rootCauseAuthority: false,
      },
    }],
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY',
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
    },
  };
}

function disposition(req = requirement()) {
  return {
    schema: 'VibrationMeasurementDisposition.v1',
    dispositionId: 'DISP-1',
    requirementId: req.requirementId,
    scope: { ...req.scope },
    mechanismId: req.mechanismId,
    outcome: 'EVIDENCE_ACCEPTED_FOR_REQUIREMENT',
    evidence: { sessionIds: ['SESSION-1'], productIds: ['PRODUCT-1'] },
    review: { reviewerId: 'ENGINEER-002', reviewedAt: '2026-08-21T10:00:00Z' },
    reason: 'Required field product is present and independently reviewed.',
  };
}

function completion(occ = occurrence()) {
  return createVibrationActionCompletionRecord({
    occurrence: occ,
    sequence: 1,
    transition: 'COMPLETE',
    recordedAt: '2026-08-21T10:15:00Z',
    actorId: 'ENGINEER-001',
    reason: 'Verification disposition accepted for this action occurrence.',
    evidenceRefs: ['DISP-1'],
  });
}

test('M14 attachment has no screening, completion, root-cause or design authority', () => {
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.engineeringAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.screeningAuthority, 'NOT_AUTHORIZED');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.designAuthority, false);
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.completionAuthority, 'NONE');
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.determinesCompletion, false);
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.determinesAssessmentCompleteness, false);
  assert.equal(VIBRATION_ACTION_VERIFICATION_AUTHORITY.rootCauseAuthority, false);
});

test('requirement helper derives exact verification scope from the action occurrence', () => {
  const occ = occurrence();
  const req = requirement(occ);
  assert.deepEqual(req.scope, {
    lineId: 'L-100',
    caseId: 'NORMAL',
    operatingCaseSnapshotId: 'OS-1',
    operatingCaseSnapshotHash: SNAPSHOT_HASH,
  });
  assert.equal(req.mechanismId, 'fit');
});

test('accepted verification attaches exact measurement hashes and completion record custody', () => {
  const occ = occurrence();
  const req = requirement(occ);
  const attachment = createVibrationActionVerificationAttachment({
    action: action(),
    occurrence: occ,
    requirement: req,
    measurementEvidence: measurementPackage(req.scope),
    disposition: disposition(req),
    completionRecord: completion(occ),
  });
  assert.equal(attachment.verificationStatus.state, 'VERIFICATION_EVIDENCE_ACCEPTED');
  assert.equal(attachment.relation, 'ACTION_OCCURRENCE_AND_COMPLETION_RECORD');
  assert.equal(attachment.completionRecord.recordId, completion(occ).recordId);
  assert.deepEqual(attachment.evidence.sessions[0].rawDataHashes, [RAW_HASH]);
  assert.equal(attachment.evidence.products[0].artifactSha256, ARTIFACT_HASH);
  assert.match(attachment.evidenceFingerprint, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(attachment.authority.determinesCompletion, false);
});

test('measurement evidence may be attached before engineer disposition without promoting acceptance', () => {
  const occ = occurrence();
  const req = requirement(occ);
  const attachment = createVibrationActionVerificationAttachment({
    action: action(), occurrence: occ, requirement: req,
    measurementEvidence: measurementPackage(req.scope),
  });
  assert.equal(attachment.verificationStatus.state, 'AWAITING_ENGINEER_DISPOSITION');
  assert.equal(attachment.completionRecord, null);
  assert.equal(attachment.relation, 'ACTION_OCCURRENCE_ONLY');
});

test('wrong scenario snapshot requirement is rejected before attachment', () => {
  const occ = occurrence();
  const req = requirement(occ);
  const wrong = { ...req, scope: { ...req.scope, operatingCaseSnapshotHash: `sha256:${'d'.repeat(64)}` } };
  assert.throws(
    () => createVibrationActionVerificationAttachment({
      action: action(), occurrence: occ, requirement: wrong,
      measurementEvidence: measurementPackage(req.scope),
    }),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_SCOPE_MISMATCH',
  );
});

test('wrong-scope measurement evidence cannot support an accepted disposition', () => {
  const occ = occurrence();
  const req = requirement(occ);
  const wrongScope = { ...req.scope, lineId: 'L-200' };
  assert.throws(
    () => createVibrationActionVerificationAttachment({
      action: action(), occurrence: occ, requirement: req,
      measurementEvidence: measurementPackage(wrongScope),
      disposition: disposition(req),
    }),
    (error) => error?.code === 'VIBRATION_VERIFICATION_WRONG_SCOPE_EVIDENCE',
  );
});

test('completion from an identical prior run cannot be attached to the current action occurrence', () => {
  const current = occurrence('FIT-RUN-2');
  const prior = occurrence('FIT-RUN-1');
  const req = requirement(current);
  assert.throws(
    () => createVibrationActionVerificationAttachment({
      action: action(), occurrence: current, requirement: req,
      measurementEvidence: measurementPackage(req.scope),
      disposition: disposition(req),
      completionRecord: completion(prior),
    }),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_COMPLETION_OCCURRENCE_MISMATCH',
  );
});

test('attachment survives JSON round trip and evidence hash tampering breaks its fingerprint', () => {
  const occ = occurrence();
  const req = requirement(occ);
  const attachment = createVibrationActionVerificationAttachment({
    action: action(), occurrence: occ, requirement: req,
    measurementEvidence: measurementPackage(req.scope),
    disposition: disposition(req),
    completionRecord: completion(occ),
  });
  const roundTrip = JSON.parse(JSON.stringify(attachment));
  assert.doesNotThrow(() => assertVibrationActionVerificationAttachment(roundTrip));
  roundTrip.evidence.products[0].artifactSha256 = `sha256:${'e'.repeat(64)}`;
  assert.throws(
    () => assertVibrationActionVerificationAttachment(roundTrip),
    (error) => error?.code === 'VIBRATION_ACTION_VERIFICATION_EVIDENCE_FINGERPRINT_INVALID',
  );
});
