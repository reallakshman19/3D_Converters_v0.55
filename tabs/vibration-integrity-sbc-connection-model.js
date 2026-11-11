import { SBC_TYPE_IDS } from '../converters/vibration/sbc/vertical-manifest.js';
import { getSbcInputSemanticTrace } from '../converters/vibration/sbc/input-semantics.js';
import { getSbcTypeClassificationContract } from '../converters/vibration/sbc/type-classification-contract.js';
import {
  getSbcTypeInputContract,
  validateSbcTypeInputStructure,
} from '../converters/vibration/sbc/type-input-contracts.js';

export const SBC_CONNECTION_AUTHORING_STORE_SCHEMA = 'VibrationSbcConnectionAuthoringStore.v1';
export const SBC_CONNECTION_AUTHORING_RECORD_SCHEMA = 'VibrationSbcConnectionAuthoringRecord.v1';

export const SBC_CONNECTION_AUTHORING_AUTHORITY = Object.freeze({
  evidenceClass: 'USER_AUTHORED_PROJECT_SBC_CONNECTION',
  controlledSourceAuthority: false,
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalExecutionAllowed: false,
  purpose: 'STRUCTURAL_AND_PROJECT_EVIDENCE_AUTHORING_ONLY',
});

const FIELD_META = Object.freeze({
  connectionId: Object.freeze({ label: 'Connection ID', kind: 'TEXT' }),
  'operatingScenario.scenarioId': Object.freeze({ label: 'Operating scenario ID', kind: 'TEXT' }),
  'mainLineAssessment.assessmentId': Object.freeze({ label: 'Qualified main-line assessment ID', kind: 'TEXT' }),
  'mainLineAssessment.sourceContract': Object.freeze({
    label: 'Main-line source contract',
    kind: 'ENUM',
    options: Object.freeze(['QUALIFIED_EI_MAIN_LINE_ASSESSMENT', 'FIT_LOF_ONLY']),
  }),
  'topology.topologyKind': Object.freeze({ label: 'Topology kind', kind: 'TOPOLOGY_ENUM' }),
  'topology.parentConnectionCount': Object.freeze({ label: 'Parent connection count', kind: 'POSITIVE_INTEGER' }),
  'topology.parentLineIds': Object.freeze({ label: 'Parent line IDs', kind: 'TEXT_LIST' }),
  'geometry.minimumNominalDiameter': Object.freeze({ label: 'Minimum nominal diameter', kind: 'POSITIVE_NUMBER' }),
  'attachments.fittings': Object.freeze({ label: 'Fittings / configuration evidence', kind: 'TEXT_LIST' }),
  'attachments.valves': Object.freeze({ label: 'Valve evidence', kind: 'TEXT_LIST' }),
  locationContext: Object.freeze({ label: 'Location / support context', kind: 'TEXT' }),
  'geometry.overallBranchLength': Object.freeze({ label: 'Overall branch length', kind: 'POSITIVE_NUMBER' }),
  'topology.returnsToSameMainLine': Object.freeze({ label: 'Returns to same main line', kind: 'BOOLEAN' }),
  'geometry.branchLegs': Object.freeze({ label: 'Branch leg lengths', kind: 'POSITIVE_NUMBER_LIST' }),
  'topology.hasSubsequentSpans': Object.freeze({ label: 'Has subsequent spans', kind: 'BOOLEAN' }),
  'geometry.firstSpan': Object.freeze({ label: 'First span', kind: 'POSITIVE_NUMBER' }),
  'geometry.subsequentSpans': Object.freeze({ label: 'Subsequent spans', kind: 'POSITIVE_NUMBER_LIST' }),
  'supportTopology.firstSpanSupport': Object.freeze({ label: 'First span support', kind: 'TEXT' }),
  'topology.bridgesDistinctMainLines': Object.freeze({ label: 'Bridges distinct main lines', kind: 'BOOLEAN' }),
  'geometry.endLegs': Object.freeze({ label: 'End-leg lengths', kind: 'POSITIVE_NUMBER_LIST' }),
  'geometry.bridgeSpan': Object.freeze({ label: 'Bridge span', kind: 'POSITIVE_NUMBER' }),
});

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function typeId(value) {
  const normalized = text(value).toUpperCase();
  return SBC_TYPE_IDS.includes(normalized) ? normalized : '';
}

function scopeId(value) {
  const normalized = text(value);
  if (!normalized) throw new Error('SBC_CONNECTION_SCOPE_REQUIRED');
  return normalized;
}

function topologyKinds() {
  return Object.freeze(SBC_TYPE_IDS.map((id) => getSbcTypeClassificationContract(id)?.topologyKind).filter(Boolean));
}

function metaFor(path) {
  const base = FIELD_META[path] ?? Object.freeze({ label: path, kind: 'TEXT' });
  return base.kind === 'TOPOLOGY_ENUM'
    ? Object.freeze({ ...base, kind: 'ENUM', options: topologyKinds() })
    : base;
}

function requiredEditablePaths(selectedType) {
  const contract = getSbcTypeInputContract(selectedType);
  return Object.freeze((contract?.requiredFields ?? []).filter((path) => path !== 'declaredSbcType'));
}

function blankRecord(scope, selectedType) {
  return Object.freeze({
    schema: SBC_CONNECTION_AUTHORING_RECORD_SCHEMA,
    scopeId: scope,
    declaredType: selectedType,
    revision: 0,
    values: Object.freeze({}),
    evidenceRefs: Object.freeze({}),
    authority: SBC_CONNECTION_AUTHORING_AUTHORITY,
  });
}

function recordFor(store, scope, selectedType) {
  const current = store?.recordsByScope?.[scope];
  if (!current) return blankRecord(scope, selectedType);
  if (current.declaredType === selectedType) return current;
  const allowed = new Set(requiredEditablePaths(selectedType));
  const values = Object.fromEntries(Object.entries(current.values ?? {}).filter(([path]) => allowed.has(path)));
  const evidenceRefs = Object.fromEntries(Object.entries(current.evidenceRefs ?? {}).filter(([path]) => allowed.has(path)));
  return Object.freeze({
    ...current,
    declaredType: selectedType,
    revision: current.revision + 1,
    values: Object.freeze(values),
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}

function nextStore(recordsByScope) {
  return Object.freeze({
    schema: SBC_CONNECTION_AUTHORING_STORE_SCHEMA,
    authority: SBC_CONNECTION_AUTHORING_AUTHORITY,
    recordsByScope: Object.freeze(recordsByScope),
  });
}

export function createSbcConnectionAuthoringStore() {
  return nextStore({});
}

export function createSbcConnectionAuthoringUiState() {
  return Object.freeze({ sbcConnectionAuthoringStore: createSbcConnectionAuthoringStore() });
}

function assertEditableField(selectedType, path) {
  if (!requiredEditablePaths(selectedType).includes(path)) {
    throw new Error(`SBC_CONNECTION_FIELD_NOT_REQUIRED_FOR_${selectedType}:${path}`);
  }
}

function updateRecord(store, scopeValue, typeValue, path, patch) {
  const scope = scopeId(scopeValue);
  const selectedType = typeId(typeValue);
  if (!selectedType) throw new Error('SBC_TYPE_1_TO_4_REQUIRED');
  assertEditableField(selectedType, path);
  const current = recordFor(store, scope, selectedType);
  const next = Object.freeze({
    ...current,
    revision: current.revision + 1,
    ...patch(current),
  });
  return nextStore({ ...(store?.recordsByScope ?? {}), [scope]: next });
}

export function updateSbcConnectionAuthoringValue(store, scope, selectedType, path, value) {
  return updateRecord(store, scope, selectedType, path, (record) => ({
    values: Object.freeze({ ...record.values, [path]: text(value) }),
  }));
}

export function updateSbcConnectionAuthoringEvidenceRef(store, scope, selectedType, path, value) {
  return updateRecord(store, scope, selectedType, path, (record) => ({
    evidenceRefs: Object.freeze({ ...record.evidenceRefs, [path]: text(value) }),
  }));
}

export function retargetSbcConnectionAuthoringRecord(store, scopeValue, typeValue) {
  const scope = text(scopeValue);
  const selectedType = typeId(typeValue);
  if (!scope || !selectedType) return store;
  const current = store?.recordsByScope?.[scope];
  if (!current || current.declaredType === selectedType) return store;
  const next = recordFor(store, scope, selectedType);
  return nextStore({ ...(store.recordsByScope ?? {}), [scope]: next });
}

function parseList(raw) {
  return text(raw).split(',').map((item) => item.trim()).filter(Boolean);
}

function parsePositiveNumber(raw) {
  const value = Number(text(raw));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseField(path, rawValue) {
  const raw = text(rawValue);
  const meta = metaFor(path);
  if (!raw) return Object.freeze({ present: false, valid: false, value: undefined, error: null });
  if (meta.kind === 'TEXT') return Object.freeze({ present: true, valid: true, value: raw, error: null });
  if (meta.kind === 'ENUM') {
    const valid = meta.options.includes(raw);
    return Object.freeze({ present: true, valid, value: valid ? raw : undefined, error: valid ? null : 'ENUM_VALUE_REQUIRED' });
  }
  if (meta.kind === 'BOOLEAN') {
    const normalized = raw.toUpperCase();
    const valid = normalized === 'TRUE' || normalized === 'FALSE';
    return Object.freeze({ present: true, valid, value: valid ? normalized === 'TRUE' : undefined, error: valid ? null : 'EXPLICIT_BOOLEAN_REQUIRED' });
  }
  if (meta.kind === 'POSITIVE_INTEGER') {
    const value = Number(raw);
    const valid = Number.isInteger(value) && value > 0;
    return Object.freeze({ present: true, valid, value: valid ? value : undefined, error: valid ? null : 'POSITIVE_INTEGER_REQUIRED' });
  }
  if (meta.kind === 'POSITIVE_NUMBER') {
    const value = parsePositiveNumber(raw);
    return Object.freeze({ present: true, valid: value !== null, value: value ?? undefined, error: value === null ? 'POSITIVE_NUMBER_REQUIRED' : null });
  }
  if (meta.kind === 'TEXT_LIST') {
    const values = parseList(raw);
    return Object.freeze({ present: true, valid: values.length > 0, value: values, error: values.length ? null : 'NON_EMPTY_LIST_REQUIRED' });
  }
  if (meta.kind === 'POSITIVE_NUMBER_LIST') {
    const items = parseList(raw);
    const values = items.map(parsePositiveNumber);
    const valid = items.length > 0 && values.every((value) => value !== null);
    return Object.freeze({ present: true, valid, value: valid ? values : undefined, error: valid ? null : 'POSITIVE_NUMBER_LIST_REQUIRED' });
  }
  return Object.freeze({ present: true, valid: true, value: raw, error: null });
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!current[part] || typeof current[part] !== 'object') current[part] = {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function fieldProjection(record, path) {
  const meta = metaFor(path);
  const rawValue = text(record.values?.[path]);
  const parsed = parseField(path, rawValue);
  const semantic = getSbcInputSemanticTrace(path);
  const evidenceRef = text(record.evidenceRefs?.[path]);
  let state = 'EMPTY';
  if (parsed.present && !parsed.valid) state = 'INVALID';
  if (parsed.present && parsed.valid && !evidenceRef) state = 'VALUE_READY_EVIDENCE_MISSING';
  if (parsed.present && parsed.valid && evidenceRef) state = 'READY';
  return Object.freeze({
    path,
    label: meta.label,
    kind: meta.kind,
    options: meta.options ?? Object.freeze([]),
    rawValue,
    parsed,
    evidenceRef,
    state,
    nativeUnit: semantic?.nativeUnit ?? null,
    semanticTrace: semantic,
  });
}

function buildStructuralInput(selectedType, fields) {
  const input = { declaredSbcType: selectedType };
  for (const field of fields) {
    if (field.parsed.present && field.parsed.valid) setPath(input, field.path, field.parsed.value);
  }
  return input;
}

export function buildSbcConnectionAuthoringProjection(store, scopeValue, typeValue) {
  const scope = text(scopeValue);
  const selectedType = typeId(typeValue);
  if (!scope || !selectedType) return Object.freeze({
    schema: 'VibrationSbcConnectionAuthoringProjection.v1',
    scopeId: scope,
    selectedType,
    status: 'SCOPE_AND_EXPLICIT_TYPE_REQUIRED',
    fields: Object.freeze([]),
    numericalExecutionAllowed: false,
    authority: SBC_CONNECTION_AUTHORING_AUTHORITY,
  });
  const record = recordFor(store, scope, selectedType);
  const fields = Object.freeze(requiredEditablePaths(selectedType).map((path) => fieldProjection(record, path)));
  const structuralInput = buildStructuralInput(selectedType, fields);
  const structuralValidation = validateSbcTypeInputStructure(selectedType, structuralInput);
  const syntaxErrors = Object.freeze(fields.filter((field) => field.state === 'INVALID').map((field) => `${field.path}:${field.parsed.error}`));
  const missingEvidenceRefs = Object.freeze(fields.filter((field) => field.parsed.present && field.parsed.valid && !field.evidenceRef).map((field) => field.path));
  const projectEvidenceComplete = fields.length > 0 && fields.every((field) => field.state === 'READY');
  let status = 'STRUCTURE_INCOMPLETE';
  if (syntaxErrors.length) status = 'INVALID_PROJECT_INPUT';
  else if (structuralValidation.structureComplete && !projectEvidenceComplete) status = 'STRUCTURE_COMPLETE_PROJECT_EVIDENCE_INCOMPLETE';
  else if (structuralValidation.structureComplete && projectEvidenceComplete) status = 'STRUCTURE_AND_PROJECT_EVIDENCE_COMPLETE_NOT_QUALIFIED';
  const classification = getSbcTypeClassificationContract(selectedType);
  return Object.freeze({
    schema: 'VibrationSbcConnectionAuthoringProjection.v1',
    scopeId: scope,
    selectedType,
    recordRevision: record.revision,
    status,
    structuralInput: Object.freeze(structuralInput),
    structuralValidation,
    syntaxErrors,
    missingEvidenceRefs,
    projectEvidenceComplete,
    fields,
    typeConfirmationTrace: classification?.sourceTrace ?? null,
    qualificationEstablished: false,
    numericalExecutionAllowed: false,
    authority: SBC_CONNECTION_AUTHORING_AUTHORITY,
  });
}
