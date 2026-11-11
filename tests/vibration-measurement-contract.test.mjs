import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
  VIBRATION_MEASUREMENT_SESSION_SCHEMA,
  VIBRATION_SIGNAL_PRODUCT_SCHEMA,
  assertVibrationMeasurementEvidencePackage,
  assertVibrationMeasurementSession,
  assertVibrationSignalProduct,
} from '../converters/vibration/measurement/contracts.js';

const RAW_1 = `sha256:${'1'.repeat(64)}`;
const RAW_2 = `sha256:${'2'.repeat(64)}`;
const PROD_1 = `sha256:${'a'.repeat(64)}`;
const PROD_2 = `sha256:${'b'.repeat(64)}`;
const SNAPSHOT = `sha256:${'c'.repeat(64)}`;

function authority(authority = 'FIELD_MEASUREMENT_EVIDENCE_ONLY') {
  return {
    authority,
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    rootCauseAuthority: false,
  };
}

function channel(id = 'CH-1', rawHash = RAW_1) {
  return {
    channelId: id,
    quantity: 'ACCELERATION',
    unit: 'm/s2',
    sensor: {
      sensorId: `SENSOR-${id}`,
      sensorType: 'ACCELEROMETER',
      model: 'MODEL-X',
      serialNumber: `SN-${id}`,
    },
    location: {
      subjectType: 'LINE_ELEMENT',
      subjectId: 'CAN-1',
    },
    orientation: {
      referenceFrame: 'PIPE_LOCAL',
      direction: id === 'CH-1' ? 'VERTICAL' : 'LATERAL',
    },
    calibration: {
      calibrationId: `CAL-${id}`,
      certificateId: `CERT-${id}`,
      source: 'CAL-LAB',
      sourceRevision: '2026-07',
      validAtAcquisition: true,
    },
    sampling: {
      sampleRateHz: 2048,
      durationS: 10,
    },
    rawData: {
      artifactId: `raw-${id}.csv`,
      sha256: rawHash,
      format: 'CSV',
      immutable: true,
    },
  };
}

function session(channels = [channel()]) {
  return {
    schema: VIBRATION_MEASUREMENT_SESSION_SCHEMA,
    sessionId: 'MS-001',
    scope: {
      lineId: 'L-100',
      caseId: 'NORMAL',
      operatingCaseSnapshotId: 'OCS-001',
      operatingCaseSnapshotHash: SNAPSHOT,
    },
    acquisition: {
      startedAt: '2026-08-18T09:00:00Z',
      instrumentConfiguration: {
        configurationId: 'DAQ-CONFIG-1',
        acquisitionSystemId: 'DAQ-1',
        source: 'FIELD-SURVEY-PACK',
        sourceRevision: 'REV-A',
      },
    },
    channels,
    source: {
      source: 'FIELD-SURVEY-PACK',
      sourceRevision: 'REV-A',
      recordId: 'MS-001',
    },
    authority: authority(),
  };
}

function product({
  productId = 'SP-001',
  productType = 'FFT',
  channelIds = ['CH-1'],
  hashes = [RAW_1],
  artifactHash = PROD_1,
} = {}) {
  return {
    schema: VIBRATION_SIGNAL_PRODUCT_SCHEMA,
    productId,
    sessionId: 'MS-001',
    channelIds,
    productType,
    inputRawDataHashes: hashes,
    processing: {
      processingRecipeId: `${productType}-RECIPE`,
      version: '1',
      source: 'SIGNAL-PROCESSING-PACK',
      sourceRevision: 'REV-A',
    },
    artifact: {
      artifactId: `${productId}.json`,
      sha256: artifactHash,
      format: 'JSON',
    },
    authority: authority('DERIVED_SIGNAL_EVIDENCE_ONLY'),
  };
}

function evidencePackage() {
  return {
    schema: VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA,
    sessions: [session([channel('CH-1', RAW_1), channel('CH-2', RAW_2)])],
    products: [
      product(),
      product({
        productId: 'SP-002',
        productType: 'COHERENCE',
        channelIds: ['CH-1', 'CH-2'],
        hashes: [RAW_1, RAW_2],
        artifactHash: PROD_2,
      }),
    ],
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY',
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
    },
  };
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error?.code === code, code);
}

test('VIB-MEAS-001 valid session retains exact scenario, calibration and immutable raw custody', () => {
  const value = assertVibrationMeasurementSession(session());
  assert.equal(value.scope.caseId, 'NORMAL');
  assert.equal(value.channels[0].calibration.validAtAcquisition, true);
  assert.equal(value.channels[0].rawData.sha256, RAW_1);
});

test('VIB-MEAS-002 operating-case snapshot hash is mandatory', () => {
  const value = session();
  delete value.scope.operatingCaseSnapshotHash;
  expectCode(() => assertVibrationMeasurementSession(value), 'VIBRATION_MEASUREMENT_HASH_REQUIRED');
});

test('VIB-MEAS-003 calibration must be valid at acquisition', () => {
  const value = session();
  value.channels[0].calibration.validAtAcquisition = false;
  expectCode(() => assertVibrationMeasurementSession(value), 'VIBRATION_MEASUREMENT_CALIBRATION_INVALID');
});

test('VIB-MEAS-004 raw acquisition reference must be immutable and hash pinned', () => {
  const mutable = session();
  mutable.channels[0].rawData.immutable = false;
  expectCode(() => assertVibrationMeasurementSession(mutable), 'VIBRATION_MEASUREMENT_RAW_DATA_MUTABLE');

  const unhashed = session();
  unhashed.channels[0].rawData.sha256 = '';
  expectCode(() => assertVibrationMeasurementSession(unhashed), 'VIBRATION_MEASUREMENT_HASH_REQUIRED');
});

test('VIB-MEAS-005 derived product requires processing recipe identity and version', () => {
  const value = product();
  delete value.processing.version;
  expectCode(() => assertVibrationSignalProduct(value), 'VIBRATION_MEASUREMENT_TEXT_REQUIRED');
});

test('VIB-MEAS-006 valid package supports single-channel FFT and two-channel coherence evidence', () => {
  const value = assertVibrationMeasurementEvidencePackage(evidencePackage());
  assert.equal(value.products.length, 2);
  assert.equal(value.products[1].productType, 'COHERENCE');
});

test('VIB-MEAS-007 product cannot reference a channel outside its session', () => {
  const value = evidencePackage();
  value.products[0].channelIds = ['CH-X'];
  expectCode(() => assertVibrationMeasurementEvidencePackage(value), 'VIBRATION_MEASUREMENT_DANGLING_CHANNEL');
});

test('VIB-MEAS-008 product raw hash set must exactly equal referenced channel raw hashes', () => {
  const value = evidencePackage();
  value.products[1].inputRawDataHashes = [RAW_1];
  expectCode(() => assertVibrationMeasurementEvidencePackage(value), 'VIBRATION_MEASUREMENT_RAW_HASH_MISMATCH');
});

test('VIB-MEAS-009 measurement evidence cannot promote screening, design or root-cause authority', () => {
  const promotedSession = session();
  promotedSession.authority.screeningAuthority = 'AUTHORIZED';
  expectCode(() => assertVibrationMeasurementSession(promotedSession), 'VIBRATION_MEASUREMENT_AUTHORITY_INVALID');

  const promotedPackage = evidencePackage();
  promotedPackage.authority.rootCauseAuthority = true;
  expectCode(() => assertVibrationMeasurementEvidencePackage(promotedPackage), 'VIBRATION_MEASUREMENT_AUTHORITY_INVALID');
});

test('VIB-MEAS-010 duplicate channel, session and product identities fail closed', () => {
  expectCode(
    () => assertVibrationMeasurementSession(session([channel('CH-1', RAW_1), channel('CH-1', RAW_2)])),
    'VIBRATION_MEASUREMENT_DUPLICATE_ID',
  );

  const duplicateSession = evidencePackage();
  duplicateSession.sessions.push(structuredClone(duplicateSession.sessions[0]));
  expectCode(() => assertVibrationMeasurementEvidencePackage(duplicateSession), 'VIBRATION_MEASUREMENT_DUPLICATE_ID');

  const duplicateProduct = evidencePackage();
  duplicateProduct.products.push(structuredClone(duplicateProduct.products[0]));
  expectCode(() => assertVibrationMeasurementEvidencePackage(duplicateProduct), 'VIBRATION_MEASUREMENT_DUPLICATE_ID');
});
