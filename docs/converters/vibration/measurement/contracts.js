export const VIBRATION_MEASUREMENT_SESSION_SCHEMA = 'VibrationMeasurementSession.v1';
export const VIBRATION_SIGNAL_PRODUCT_SCHEMA = 'VibrationSignalProduct.v1';
export const VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA = 'VibrationMeasurementEvidencePackage.v1';

export const VIBRATION_SIGNAL_PRODUCT_TYPES = Object.freeze([
  'OVERALL', 'RMS', 'PEAK', 'PEAK_TO_PEAK', 'FFT', 'PSD', 'ORDER_SPECTRUM',
  'PHASE', 'COHERENCE', 'ODS', 'MODAL_RESULT',
]);

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function measurementError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationMeasurementEvidenceError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw measurementError('VIBRATION_MEASUREMENT_OBJECT_REQUIRED', `${field} must be an object.`, { field });
  }
  return value;
}

function array(value, field, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    throw measurementError('VIBRATION_MEASUREMENT_ARRAY_REQUIRED', `${field} must be ${nonEmpty ? 'a non-empty' : 'an'} array.`, { field });
  }
  return value;
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw measurementError('VIBRATION_MEASUREMENT_TEXT_REQUIRED', `${field} must be non-empty text.`, { field });
  }
  return value.trim();
}

function positive(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw measurementError('VIBRATION_MEASUREMENT_NUMBER_INVALID', `${field} must be a finite number greater than zero.`, { field, value });
  }
  return value;
}

function hash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw measurementError('VIBRATION_MEASUREMENT_HASH_REQUIRED', `${field} must be a canonical sha256:<64 lowercase hex> hash.`, { field });
  }
  return value;
}

function uniqueText(rows, field, scope) {
  const values = rows.map((row) => text(row?.[field], `${scope}.${field}`));
  if (new Set(values).size !== values.length) {
    throw measurementError('VIBRATION_MEASUREMENT_DUPLICATE_ID', `${scope}.${field} values must be unique.`, { field, scope });
  }
  return values;
}

function provenance(value, field) {
  const row = object(value, field);
  text(row.source, `${field}.source`);
  text(row.sourceRevision, `${field}.sourceRevision`);
  return row;
}

function assertEvidenceAuthority(value, expectedAuthority, field) {
  const authority = object(value, field);
  const valid = authority.authority === expectedAuthority
    && authority.screeningAuthority === 'NOT_AUTHORIZED'
    && authority.designAuthority === false
    && authority.rootCauseAuthority === false;
  if (!valid) {
    throw measurementError(
      'VIBRATION_MEASUREMENT_AUTHORITY_INVALID',
      `${field} cannot create screening, design, or root-cause authority.`,
      { field, expectedAuthority },
    );
  }
}

function assertPackageAuthority(value) {
  const authority = object(value, 'package.authority');
  const valid = authority.containerAuthority === 'MEASUREMENT_EVIDENCE_CONTAINER_ONLY'
    && authority.screeningAuthorized === false
    && authority.designAuthority === false
    && authority.rootCauseAuthority === false;
  if (!valid) {
    throw measurementError(
      'VIBRATION_MEASUREMENT_AUTHORITY_INVALID',
      'Measurement evidence package cannot create screening, design, or root-cause authority.',
    );
  }
}

function assertSensor(value, field) {
  const sensor = object(value, field);
  for (const key of ['sensorId', 'sensorType', 'model', 'serialNumber']) text(sensor[key], `${field}.${key}`);
}

function assertLocation(value, field) {
  const location = object(value, field);
  text(location.subjectType, `${field}.subjectType`);
  text(location.subjectId, `${field}.subjectId`);
}

function assertOrientation(value, field) {
  const orientation = object(value, field);
  text(orientation.referenceFrame, `${field}.referenceFrame`);
  text(orientation.direction, `${field}.direction`);
}

function assertCalibration(value, field) {
  const calibration = provenance(value, field);
  text(calibration.calibrationId, `${field}.calibrationId`);
  text(calibration.certificateId, `${field}.certificateId`);
  if (calibration.validAtAcquisition !== true) {
    throw measurementError(
      'VIBRATION_MEASUREMENT_CALIBRATION_INVALID',
      `${field}.validAtAcquisition must be explicitly true.`,
      { field },
    );
  }
}

function assertSampling(value, field) {
  const sampling = object(value, field);
  positive(sampling.sampleRateHz, `${field}.sampleRateHz`);
  positive(sampling.durationS, `${field}.durationS`);
}

function assertRawData(value, field) {
  const raw = object(value, field);
  text(raw.artifactId, `${field}.artifactId`);
  hash(raw.sha256, `${field}.sha256`);
  text(raw.format, `${field}.format`);
  if (raw.immutable !== true) {
    throw measurementError(
      'VIBRATION_MEASUREMENT_RAW_DATA_MUTABLE',
      `${field}.immutable must be explicitly true.`,
      { field },
    );
  }
}

function assertChannel(value, index) {
  const field = `session.channels[${index}]`;
  const channel = object(value, field);
  text(channel.channelId, `${field}.channelId`);
  text(channel.quantity, `${field}.quantity`);
  text(channel.unit, `${field}.unit`);
  assertSensor(channel.sensor, `${field}.sensor`);
  assertLocation(channel.location, `${field}.location`);
  assertOrientation(channel.orientation, `${field}.orientation`);
  assertCalibration(channel.calibration, `${field}.calibration`);
  assertSampling(channel.sampling, `${field}.sampling`);
  assertRawData(channel.rawData, `${field}.rawData`);
}

export function assertVibrationMeasurementSession(value) {
  const session = object(value, 'session');
  if (session.schema !== VIBRATION_MEASUREMENT_SESSION_SCHEMA) {
    throw measurementError('VIBRATION_MEASUREMENT_SCHEMA_MISMATCH', `session.schema must be ${VIBRATION_MEASUREMENT_SESSION_SCHEMA}.`);
  }
  text(session.sessionId, 'session.sessionId');
  const scope = object(session.scope, 'session.scope');
  text(scope.lineId, 'session.scope.lineId');
  text(scope.caseId, 'session.scope.caseId');
  text(scope.operatingCaseSnapshotId, 'session.scope.operatingCaseSnapshotId');
  hash(scope.operatingCaseSnapshotHash, 'session.scope.operatingCaseSnapshotHash');

  const acquisition = object(session.acquisition, 'session.acquisition');
  const startedAt = text(acquisition.startedAt, 'session.acquisition.startedAt');
  if (!Number.isFinite(Date.parse(startedAt))) {
    throw measurementError('VIBRATION_MEASUREMENT_TIME_INVALID', 'session.acquisition.startedAt must be an ISO-compatible timestamp.');
  }
  const configuration = provenance(acquisition.instrumentConfiguration, 'session.acquisition.instrumentConfiguration');
  text(configuration.configurationId, 'session.acquisition.instrumentConfiguration.configurationId');
  text(configuration.acquisitionSystemId, 'session.acquisition.instrumentConfiguration.acquisitionSystemId');

  const channels = array(session.channels, 'session.channels', { nonEmpty: true });
  channels.forEach(assertChannel);
  uniqueText(channels, 'channelId', 'session.channels');

  const source = provenance(session.source, 'session.source');
  text(source.recordId, 'session.source.recordId');
  assertEvidenceAuthority(session.authority, 'FIELD_MEASUREMENT_EVIDENCE_ONLY', 'session.authority');
  return session;
}

export function assertVibrationSignalProduct(value) {
  const product = object(value, 'product');
  if (product.schema !== VIBRATION_SIGNAL_PRODUCT_SCHEMA) {
    throw measurementError('VIBRATION_MEASUREMENT_SCHEMA_MISMATCH', `product.schema must be ${VIBRATION_SIGNAL_PRODUCT_SCHEMA}.`);
  }
  text(product.productId, 'product.productId');
  text(product.sessionId, 'product.sessionId');
  const channelIds = array(product.channelIds, 'product.channelIds', { nonEmpty: true });
  const normalizedChannelIds = channelIds.map((id) => text(id, 'product.channelIds[]'));
  if (new Set(normalizedChannelIds).size !== normalizedChannelIds.length) {
    throw measurementError('VIBRATION_MEASUREMENT_DUPLICATE_ID', 'product.channelIds must be unique.');
  }
  const productType = text(product.productType, 'product.productType');
  if (!VIBRATION_SIGNAL_PRODUCT_TYPES.includes(productType)) {
    throw measurementError('VIBRATION_MEASUREMENT_PRODUCT_TYPE_INVALID', 'product.productType is not supported.', { productType });
  }
  const rawHashes = array(product.inputRawDataHashes, 'product.inputRawDataHashes', { nonEmpty: true });
  const normalizedHashes = rawHashes.map((valueHash) => hash(valueHash, 'product.inputRawDataHashes[]'));
  if (new Set(normalizedHashes).size !== normalizedHashes.length) {
    throw measurementError('VIBRATION_MEASUREMENT_DUPLICATE_ID', 'product.inputRawDataHashes must be unique.');
  }
  const processing = provenance(product.processing, 'product.processing');
  text(processing.processingRecipeId, 'product.processing.processingRecipeId');
  text(processing.version, 'product.processing.version');
  const artifact = object(product.artifact, 'product.artifact');
  text(artifact.artifactId, 'product.artifact.artifactId');
  hash(artifact.sha256, 'product.artifact.sha256');
  text(artifact.format, 'product.artifact.format');
  assertEvidenceAuthority(product.authority, 'DERIVED_SIGNAL_EVIDENCE_ONLY', 'product.authority');
  return product;
}

function sameSet(left, right) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

export function assertVibrationMeasurementEvidencePackage(value) {
  const pkg = object(value, 'package');
  if (pkg.schema !== VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA) {
    throw measurementError('VIBRATION_MEASUREMENT_SCHEMA_MISMATCH', `package.schema must be ${VIBRATION_MEASUREMENT_EVIDENCE_PACKAGE_SCHEMA}.`);
  }
  const sessions = array(pkg.sessions, 'package.sessions');
  const products = array(pkg.products, 'package.products');
  sessions.forEach(assertVibrationMeasurementSession);
  products.forEach(assertVibrationSignalProduct);
  uniqueText(sessions, 'sessionId', 'package.sessions');
  uniqueText(products, 'productId', 'package.products');
  assertPackageAuthority(pkg.authority);

  const sessionIndex = new Map(sessions.map((session) => [session.sessionId, session]));
  for (const product of products) {
    const session = sessionIndex.get(product.sessionId);
    if (!session) {
      throw measurementError('VIBRATION_MEASUREMENT_DANGLING_SESSION', 'Signal product references an unknown measurement session.', { productId: product.productId, sessionId: product.sessionId });
    }
    const channelIndex = new Map(session.channels.map((channel) => [channel.channelId, channel]));
    const referenced = [];
    for (const channelId of product.channelIds) {
      const channel = channelIndex.get(channelId);
      if (!channel) {
        throw measurementError('VIBRATION_MEASUREMENT_DANGLING_CHANNEL', 'Signal product references an unknown channel in its session.', { productId: product.productId, channelId });
      }
      referenced.push(channel.rawData.sha256);
    }
    if (!sameSet(referenced, product.inputRawDataHashes)) {
      throw measurementError('VIBRATION_MEASUREMENT_RAW_HASH_MISMATCH', 'Signal product raw-data hashes must exactly match its referenced channel set.', { productId: product.productId });
    }
  }
  return pkg;
}

export function createVibrationMeasurementError(code, message, details = {}) {
  return measurementError(code, message, details);
}
