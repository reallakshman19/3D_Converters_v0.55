export const VIBRATION_VISUAL_INSPECTION_RECORD_SCHEMA = 'VibrationVisualInspectionRecord.v1';
export const VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA = 'VibrationVisualInspectionEvidencePackage.v1';

export const VIBRATION_VISUAL_SUBJECT_TYPES = Object.freeze([
  'PIPE_OR_COMPONENT',
  'SUPPORT_OR_RESTRAINT',
  'SMALL_BORE_CONNECTION',
  'TUBING',
  'INTRUSIVE_ELEMENT',
  'OTHER',
]);

export const VIBRATION_VISUAL_OBSERVATION_CODES = Object.freeze([
  'SUPPORT_OR_RESTRAINT_CONDITION',
  'FASTENER_LOOSENESS',
  'FRETTING_OR_WEAR',
  'WELD_OR_ATTACHMENT_SURFACE_CONDITION',
  'SMALL_BORE_RELATIVE_MOTION',
  'TUBING_RELATIVE_MOTION',
  'RUBBING_OR_CONTACT',
  'INSULATION_OR_CLADDING_DAMAGE',
  'LEAKAGE_OR_STAINING',
  'OTHER',
]);

export const VIBRATION_VISUAL_OBSERVATION_STATES = Object.freeze([
  'OBSERVED', 'NOT_OBSERVED', 'NOT_INSPECTED', 'UNRESOLVED',
]);

export const VIBRATION_VISUAL_RECORD_AUTHORITY = Object.freeze({
  authority: 'FIELD_VISUAL_OBSERVATION_EVIDENCE_ONLY',
  eiChecklistCoverage: 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE',
  determinesApplicability: false,
  determinesAssessmentCompleteness: false,
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

export const VIBRATION_VISUAL_PACKAGE_AUTHORITY = Object.freeze({
  containerAuthority: 'VISUAL_OBSERVATION_EVIDENCE_CONTAINER_ONLY',
  eiChecklistCoverage: 'NOT_CLAIMED_NON_EXHAUSTIVE_CAPTURE',
  screeningAuthorized: false,
  designAuthority: false,
  rootCauseAuthority: false,
  codeCompliance: false,
  safetyAuthority: false,
});

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function visualError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationVisualInspectionError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw visualError('VIBRATION_VISUAL_TEXT_REQUIRED', `${field} must be non-empty text.`, { field });
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value == null || value === '') return null;
  return requiredText(value, field);
}

function enumValue(value, allowed, field) {
  const normalized = requiredText(value, field);
  if (!allowed.includes(normalized)) {
    throw visualError('VIBRATION_VISUAL_ENUM_INVALID', `${field} is not supported.`, { field, value: normalized });
  }
  return normalized;
}

function timestamp(value, field) {
  const normalized = requiredText(value, field);
  if (!Number.isFinite(Date.parse(normalized))) {
    throw visualError('VIBRATION_VISUAL_TIME_INVALID', `${field} must be an ISO-compatible timestamp.`, { field });
  }
  return normalized;
}

function scopeValue(value = {}) {
  return {
    lineId: requiredText(value.lineId, 'scope.lineId'),
    caseId: requiredText(value.caseId, 'scope.caseId'),
    operatingCaseSnapshotId: requiredText(value.operatingCaseSnapshotId, 'scope.operatingCaseSnapshotId'),
    operatingCaseSnapshotHash: canonicalHash(value.operatingCaseSnapshotHash, 'scope.operatingCaseSnapshotHash'),
  };
}

function canonicalHash(value, field) {
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
    throw visualError('VIBRATION_VISUAL_HASH_REQUIRED', `${field} must be a canonical sha256 hash.`, { field });
  }
  return value;
}

function assertAuthority(value, expected, field) {
  if (value == null) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw visualError('VIBRATION_VISUAL_AUTHORITY_INVALID', `${field} must be an authority object.`, { field });
  }
  if (Object.keys(value).length !== Object.keys(expected).length) {
    throw visualError('VIBRATION_VISUAL_AUTHORITY_INVALID', `${field} cannot add authority fields.`, { field });
  }
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (value[key] !== expectedValue) {
      throw visualError('VIBRATION_VISUAL_AUTHORITY_INVALID', `${field} cannot promote engineering authority.`, { field, key });
    }
  }
}

function artifactRef(value = {}, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw visualError('VIBRATION_VISUAL_OBJECT_REQUIRED', 'evidenceRefs[] must be an object.', { index });
  }
  if (value.immutable !== true) {
    throw visualError('VIBRATION_VISUAL_ARTIFACT_MUTABLE', 'Visual evidence artifact references must be immutable.', { index });
  }
  return {
    artifactId: requiredText(value.artifactId, `evidenceRefs[${index}].artifactId`),
    sha256: canonicalHash(value.sha256, `evidenceRefs[${index}].sha256`),
    mediaType: requiredText(value.mediaType, `evidenceRefs[${index}].mediaType`),
    description: optionalText(value.description, `evidenceRefs[${index}].description`),
    immutable: true,
  };
}

function evidenceRefs(values = []) {
  if (!Array.isArray(values)) throw visualError('VIBRATION_VISUAL_ARRAY_REQUIRED', 'evidenceRefs must be an array.');
  const refs = values.map(artifactRef);
  const ids = refs.map((item) => item.artifactId);
  if (new Set(ids).size !== ids.length) throw visualError('VIBRATION_VISUAL_DUPLICATE_ID', 'evidenceRefs artifactId values must be unique.');
  return refs;
}

function observation(value = {}, index) {
  const state = enumValue(value.state, VIBRATION_VISUAL_OBSERVATION_STATES, `observations[${index}].state`);
  const note = optionalText(value.note, `observations[${index}].note`);
  if (['OBSERVED', 'UNRESOLVED'].includes(state) && !note) {
    throw visualError('VIBRATION_VISUAL_NOTE_REQUIRED', 'Observed or unresolved conditions require an explanatory note.', { index, state });
  }
  return {
    observationId: requiredText(value.observationId, `observations[${index}].observationId`),
    code: enumValue(value.code, VIBRATION_VISUAL_OBSERVATION_CODES, `observations[${index}].code`),
    state,
    note,
  };
}

function observations(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw visualError('VIBRATION_VISUAL_ARRAY_REQUIRED', 'observations must be a non-empty array.');
  }
  const rows = values.map(observation);
  const ids = rows.map((item) => item.observationId);
  if (new Set(ids).size !== ids.length) throw visualError('VIBRATION_VISUAL_DUPLICATE_ID', 'observationId values must be unique.');
  return rows;
}

export function createVibrationVisualInspectionRecord(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_VISUAL_INSPECTION_RECORD_SCHEMA) {
    throw visualError('VIBRATION_VISUAL_SCHEMA_MISMATCH', `record.schema must be ${VIBRATION_VISUAL_INSPECTION_RECORD_SCHEMA}.`);
  }
  assertAuthority(input.authority, VIBRATION_VISUAL_RECORD_AUTHORITY, 'record.authority');
  return deepFreeze({
    schema: VIBRATION_VISUAL_INSPECTION_RECORD_SCHEMA,
    inspectionId: requiredText(input.inspectionId, 'inspectionId'),
    scope: scopeValue(input.scope),
    inspectedAt: timestamp(input.inspectedAt, 'inspectedAt'),
    inspector: {
      inspectorId: requiredText(input.inspector?.inspectorId, 'inspector.inspectorId'),
      organization: optionalText(input.inspector?.organization, 'inspector.organization'),
      qualificationRef: optionalText(input.inspector?.qualificationRef, 'inspector.qualificationRef'),
    },
    subject: {
      subjectType: enumValue(input.subject?.subjectType, VIBRATION_VISUAL_SUBJECT_TYPES, 'subject.subjectType'),
      subjectId: requiredText(input.subject?.subjectId, 'subject.subjectId'),
    },
    observations: observations(input.observations),
    evidenceRefs: evidenceRefs(input.evidenceRefs ?? []),
    source: {
      source: requiredText(input.source?.source, 'source.source'),
      sourceRevision: requiredText(input.source?.sourceRevision, 'source.sourceRevision'),
      recordId: requiredText(input.source?.recordId, 'source.recordId'),
    },
    authority: VIBRATION_VISUAL_RECORD_AUTHORITY,
  });
}

export function createVibrationVisualInspectionEvidencePackage(input = {}) {
  if (input.schema != null && input.schema !== VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA) {
    throw visualError('VIBRATION_VISUAL_SCHEMA_MISMATCH', `package.schema must be ${VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA}.`);
  }
  if (!Array.isArray(input.records)) throw visualError('VIBRATION_VISUAL_ARRAY_REQUIRED', 'package.records must be an array.');
  assertAuthority(input.authority, VIBRATION_VISUAL_PACKAGE_AUTHORITY, 'package.authority');
  const records = input.records.map(createVibrationVisualInspectionRecord);
  const ids = records.map((item) => item.inspectionId);
  if (new Set(ids).size !== ids.length) throw visualError('VIBRATION_VISUAL_DUPLICATE_ID', 'inspectionId values must be unique.');
  return deepFreeze({
    schema: VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA,
    records,
    authority: VIBRATION_VISUAL_PACKAGE_AUTHORITY,
  });
}

export function createVibrationVisualInspectionError(code, message, details = {}) {
  return visualError(code, message, details);
}
