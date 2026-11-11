export const VERIFICATION_RAW_HASH = `sha256:${'1'.repeat(64)}`;
export const VERIFICATION_FFT_ARTIFACT_HASH = `sha256:${'a'.repeat(64)}`;
export const VERIFICATION_OVERALL_ARTIFACT_HASH = `sha256:${'b'.repeat(64)}`;
export const VERIFICATION_SNAPSHOT_HASH = `sha256:${'c'.repeat(64)}`;

export function verificationScope(overrides = {}) {
  return {
    lineId: 'L-1',
    caseId: 'NORMAL',
    operatingCaseSnapshotId: 'OCS-1',
    operatingCaseSnapshotHash: VERIFICATION_SNAPSHOT_HASH,
    ...overrides,
  };
}

function evidenceAuthority(authority) {
  return {
    authority,
    screeningAuthority: 'NOT_AUTHORIZED',
    designAuthority: false,
    rootCauseAuthority: false,
  };
}

function channel() {
  return {
    channelId: 'CH-1',
    quantity: 'ACCELERATION',
    unit: 'm/s2',
    sensor: {
      sensorId: 'SENSOR-1',
      sensorType: 'ACCELEROMETER',
      model: 'MODEL-X',
      serialNumber: 'SN-1',
    },
    location: { subjectType: 'LINE_ELEMENT', subjectId: 'CAN-1' },
    orientation: { referenceFrame: 'PIPE_LOCAL', direction: 'VERTICAL' },
    calibration: {
      calibrationId: 'CAL-1',
      certificateId: 'CERT-1',
      source: 'CAL-LAB',
      sourceRevision: '2026-07',
      validAtAcquisition: true,
    },
    sampling: { sampleRateHz: 2048, durationS: 10 },
    rawData: {
      artifactId: 'raw-CH-1.csv',
      sha256: VERIFICATION_RAW_HASH,
      format: 'CSV',
      immutable: true,
    },
  };
}

export function measurementSession({ sessionId = 'MS-1', scope = verificationScope() } = {}) {
  return {
    schema: 'VibrationMeasurementSession.v1',
    sessionId,
    scope,
    acquisition: {
      startedAt: '2026-08-19T08:00:00Z',
      instrumentConfiguration: {
        configurationId: 'DAQ-CFG-1',
        acquisitionSystemId: 'DAQ-1',
        source: 'FIELD-SURVEY-PACK',
        sourceRevision: 'REV-A',
      },
    },
    channels: [channel()],
    source: {
      source: 'FIELD-SURVEY-PACK',
      sourceRevision: 'REV-A',
      recordId: sessionId,
    },
    authority: evidenceAuthority('FIELD_MEASUREMENT_EVIDENCE_ONLY'),
  };
}

export function signalProduct({ productId, productType, artifactHash, sessionId = 'MS-1' }) {
  return {
    schema: 'VibrationSignalProduct.v1',
    productId,
    sessionId,
    channelIds: ['CH-1'],
    productType,
    inputRawDataHashes: [VERIFICATION_RAW_HASH],
    processing: {
      processingRecipeId: `${productType}-RECIPE`,
      version: '1',
      source: 'SIGNAL-PROCESSING-PACK',
      sourceRevision: 'REV-A',
    },
    artifact: { artifactId: `${productId}.json`, sha256: artifactHash, format: 'JSON' },
    authority: evidenceAuthority('DERIVED_SIGNAL_EVIDENCE_ONLY'),
  };
}

export function verificationEvidencePackage({ scope = verificationScope(), includeFft = true } = {}) {
  const products = [signalProduct({
    productId: 'SP-1', productType: 'OVERALL', artifactHash: VERIFICATION_OVERALL_ARTIFACT_HASH,
  })];
  if (includeFft) {
    products.push(signalProduct({
      productId: 'SP-2', productType: 'FFT', artifactHash: VERIFICATION_FFT_ARTIFACT_HASH,
    }));
  }
  return {
    schema: 'VibrationMeasurementEvidencePackage.v1',
    sessions: [measurementSession({ scope })],
    products,
    authority: {
      containerAuthority: 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY',
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
    },
  };
}

export function verificationProject(measurementEvidence) {
  return {
    schema: 'VibrationIntegrityProject.v1',
    project: { projectId: 'P-1' },
    subjects: { lines: [{ lineId: 'L-1' }] },
    mechanismImports: [],
    currentResults: [],
    measurements: [],
    measurementEvidence,
    authority: {
      containerAuthority: 'PERSISTENCE_CONTAINER_ONLY',
      importedResultsAreCurrentEngineeringAuthority: false,
      screeningAuthorized: false,
      designAuthority: false,
      rootCauseAuthority: false,
      measurementEvidenceIsCurrentEngineeringAuthority: false,
    },
  };
}
