import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEnergyInstituteEitDocument } from '../converters/vibration/eit/parse.js';
import { buildVibrationIntegrityProjectFromEit } from '../converters/vibration/project/from-eit.js';
import {
  attachVibrationMeasurementEvidence,
  createEmptyVibrationMeasurementEvidencePackage,
} from '../converters/vibration/project/measurement.js';
import {
  parseVibrationIntegrityProject,
  serializeVibrationIntegrityProject,
} from '../converters/vibration/project/serialize.js';
import {
  VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
  VIBRATION_MEASUREMENT_SESSION_SCHEMA,
} from '../converters/vibration/measurement/contracts.js';

const RAW = `sha256:${'1'.repeat(64)}`;
const SNAPSHOT = `sha256:${'2'.repeat(64)}`;

function project() {
  const imported = parseEnergyInstituteEitDocument({
    options: { version: 5, title: 'Measurement Project', project: 6200 },
    lines: [{ rid: 'L1', modules: 'fit', fit: '0.1', fit_data: '[]' }],
    pipes: [], streams: [], mats: [],
  }, { sourceName: 'measurement.eit' });
  return buildVibrationIntegrityProjectFromEit(imported);
}

function packageFor(lineId) {
  return {
    schema: VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
    sessions: [{
      schema: VIBRATION_MEASUREMENT_SESSION_SCHEMA,
      sessionId: 'MS-1',
      scope: {
        lineId,
        caseId: 'NORMAL',
        operatingCaseSnapshotId: 'OCS-1',
        operatingCaseSnapshotHash: SNAPSHOT,
      },
      acquisition: {
        startedAt: '2026-08-18T09:00:00Z',
        instrumentConfiguration: {
          configurationId: 'DAQ-CFG-1', acquisitionSystemId: 'DAQ-1',
          source: 'FIELD-PACK', sourceRevision: 'REV-A',
        },
      },
      channels: [{
        channelId: 'CH-1', quantity: 'ACCELERATION', unit: 'm/s2',
        sensor: { sensorId: 'S-1', sensorType: 'ACCELEROMETER', model: 'M1', serialNumber: 'SN1' },
        location: { subjectType: 'LINE_ELEMENT', subjectId: 'E1' },
        orientation: { referenceFrame: 'PIPE_LOCAL', direction: 'VERTICAL' },
        calibration: {
          calibrationId: 'CAL-1', certificateId: 'CERT-1', source: 'CAL-LAB',
          sourceRevision: '2026-07', validAtAcquisition: true,
        },
        sampling: { sampleRateHz: 2048, durationS: 10 },
        rawData: { artifactId: 'raw.csv', sha256: RAW, format: 'CSV', immutable: true },
      }],
      source: { source: 'FIELD-PACK', sourceRevision: 'REV-A', recordId: 'MS-1' },
      authority: {
        authority: 'FIELD_MEASUREMENT_EVIDENCE_ONLY', screeningAuthority: 'NOT_AUTHORIZED',
        designAuthority: false, rootCauseAuthority: false,
      },
    }],
    products: [],
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY', screeningAuthorized: false,
      designAuthority: false, rootCauseAuthority: false,
    },
  };
}

test('VIB-PROJ-MEAS-001 new project starts with an empty validated measurement package', () => {
  const value = project();
  assert.deepEqual(value.measurementEvidence, createEmptyVibrationMeasurementEvidencePackage());
});

test('VIB-PROJ-MEAS-002 valid measurement evidence survives deterministic vibproj round-trip', () => {
  const base = project();
  const attached = attachVibrationMeasurementEvidence(base, packageFor(base.subjects.lines[0].lineId));
  const text = serializeVibrationIntegrityProject(attached);
  const restored = parseVibrationIntegrityProject(text);
  assert.deepEqual(restored.measurementEvidence, attached.measurementEvidence);
  assert.equal(serializeVibrationIntegrityProject(restored), text);
});

test('VIB-PROJ-MEAS-003 attachment is immutable and does not mutate the source project', () => {
  const base = project();
  const attached = attachVibrationMeasurementEvidence(base, packageFor(base.subjects.lines[0].lineId));
  assert.equal(base.measurementEvidence.sessions.length, 0);
  assert.equal(attached.measurementEvidence.sessions.length, 1);
  assert.equal(Object.isFrozen(attached), true);
  assert.equal(Object.isFrozen(attached.measurementEvidence), true);
});

test('VIB-PROJ-MEAS-004 measurement session cannot reference a line outside the project', () => {
  const base = project();
  assert.throws(
    () => attachVibrationMeasurementEvidence(base, packageFor('UNKNOWN-LINE')),
    /measurement session references an unknown project line/i,
  );
});

test('VIB-PROJ-MEAS-005 forged measurement authority fails closed on vibproj load', () => {
  const base = project();
  const attached = attachVibrationMeasurementEvidence(base, packageFor(base.subjects.lines[0].lineId));
  const mutable = JSON.parse(serializeVibrationIntegrityProject(attached));
  mutable.measurementEvidence.authority.rootCauseAuthority = true;
  assert.throws(() => parseVibrationIntegrityProject(JSON.stringify(mutable)), /cannot create screening, design, or root-cause authority/i);
});

test('VIB-PROJ-MEAS-006 non-empty legacy measurements array cannot bypass the validated package', () => {
  const mutable = JSON.parse(serializeVibrationIntegrityProject(project()));
  mutable.measurements.push({ unvalidated: true });
  assert.throws(() => parseVibrationIntegrityProject(JSON.stringify(mutable)), /legacy measurements/i);
});

test('VIB-PROJ-MEAS-007 older V1 project without measurementEvidence remains loadable', () => {
  const mutable = JSON.parse(serializeVibrationIntegrityProject(project()));
  delete mutable.measurementEvidence;
  const restored = parseVibrationIntegrityProject(JSON.stringify(mutable));
  assert.equal(restored.measurementEvidence, undefined);
});
