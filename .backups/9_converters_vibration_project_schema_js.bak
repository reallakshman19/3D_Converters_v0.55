import {
  assertVibrationActionCompletionLedger,
  createVibrationActionCompletionLedger,
} from '../facility/action-completion-ledger.js';
import {
  assertVibrationActionVerificationLedger,
  createVibrationActionVerificationLedger,
} from '../facility/action-verification-ledger.js';
import { assertVibrationMeasurementEvidencePackage } from '../measurement/contracts.js';
import {
  assertVibrationMitigationLedger,
  createVibrationMitigationLedger,
} from '../mitigation/ledger.js';
import {
  assertVibrationRcaLedger,
  createVibrationRcaLedger,
} from '../rca/ledger.js';
import { assertVibrationOperatingScenario } from '../dataset/operating-scenario.js';
import {
  VIBRATION_VISUAL_PACKAGE_AUTHORITY,
  VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA,
  createVibrationVisualInspectionEvidencePackage,
} from '../visual-inspection/contracts.js';

export const VIBRATION_INTEGRITY_PROJECT_SCHEMA = 'VibrationIntegrityProject.v1';
export const VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2 = 'VibrationIntegrityProject.v2';
export const VIBRATION_INTEGRITY_PROJECT_AUTHORITY = 'PERSISTENCE_CONTAINER_ONLY';

export const VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY = Object.freeze({
  containerAuthority: VIBRATION_INTEGRITY_PROJECT_AUTHORITY,
  persistencePurpose: 'PROJECT_EVIDENCE_AND_LIFECYCLE_CUSTODY_ONLY',
  importedResultsAreCurrentEngineeringAuthority: false,
  historicalCalculationEvidenceIsCurrentEngineeringAuthority: false,
  measurementEvidenceIsCurrentEngineeringAuthority: false,
  visualInspectionEvidenceIsCurrentEngineeringAuthority: false,
  lifecycleEvidenceIsCurrentEngineeringAuthority: false,
  screeningAuthorized: false,
  designAuthority: false,
  rootCauseAuthority: false,
  calculationEligibilityAuthority: false,
});

const V1_TOP_LEVEL_KEYS = Object.freeze([
  'schema', 'project', 'sourceImports', 'subjects', 'mechanismImports',
  'unknownCompatibilityModules', 'currentResults', 'measurements',
  'measurementEvidence', 'actions', 'authority',
]);

const V2_TOP_LEVEL_KEYS = Object.freeze([
  'schema', 'project', 'sourceImports', 'subjects', 'mechanismImports',
  'unknownCompatibilityModules', 'currentResults', 'measurements',
  'measurementEvidence', 'actions', 'engineeringInputs',
  'operatingScenarioReferences', 'visualInspectionEvidence',
  'historicalCalculationEvidence', 'activity', 'extensions', 'authority',
]);

const V2_ENGINEERING_INPUT_KEYS = Object.freeze([
  'identificationEvidence', 'userEngineeringData', 'assumptions',
]);
const V2_ACTIVITY_KEYS = Object.freeze([
  'actionCompletion', 'actionVerification', 'rca', 'mitigation',
]);
const PROJECT_SCOPED_LEDGER_KEYS = Object.freeze(['projectId', 'ledger']);

function projectError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationIntegrityProjectError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function requiredObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw projectError('VIBRATION_PROJECT_OBJECT_REQUIRED', `${field} must be an object.`, { field });
  }
  return value;
}

function requiredArray(value, field) {
  if (!Array.isArray(value)) {
    throw projectError('VIBRATION_PROJECT_ARRAY_REQUIRED', `${field} must be an array.`, { field });
  }
  return value;
}

function requiredText(value, field) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    throw projectError('VIBRATION_PROJECT_TEXT_REQUIRED', `${field} must be non-empty text.`, { field });
  }
  return normalized;
}

function exactKeys(value, expectedKeys, code, field) {
  requiredObject(value, field);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw projectError(code, `${field} contains missing or unsupported fields.`, { field, actual, expected });
  }
}

function uniqueIds(rows, field, code) {
  const values = rows.map((row) => String(row?.[field] ?? '')).filter(Boolean);
  if (values.length !== rows.length || new Set(values).size !== values.length) {
    throw projectError(code, `${field} values must be present and unique.`, { field });
  }
  return new Set(values);
}

function assertV1Authority(project) {
  const authority = requiredObject(project.authority, 'project.authority');
  const safe = authority.containerAuthority === VIBRATION_INTEGRITY_PROJECT_AUTHORITY
    && authority.importedResultsAreCurrentEngineeringAuthority === false
    && authority.screeningAuthorized === false
    && authority.designAuthority === false
    && authority.rootCauseAuthority !== true
    && authority.measurementEvidenceIsCurrentEngineeringAuthority !== true;
  if (!safe) {
    throw projectError(
      'VIBRATION_PROJECT_AUTHORITY_INVALID',
      'Project persistence metadata cannot grant engineering, screening, or design authority; measurement evidence and root-cause authority are also non-authorizing.',
    );
  }
}

function assertV2Authority(project) {
  exactKeys(
    project.authority,
    Object.keys(VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY),
    'VIBRATION_PROJECT_V2_AUTHORITY_INVALID',
    'project.authority',
  );
  for (const [key, expected] of Object.entries(VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY)) {
    if (project.authority[key] !== expected) {
      throw projectError(
        'VIBRATION_PROJECT_V2_AUTHORITY_INVALID',
        `V2 project persistence authority mismatch at ${key}.`,
        { key },
      );
    }
  }
}

function assertMeasurementEvidence(project, lineIds) {
  const legacyMeasurements = requiredArray(project.measurements ?? [], 'project.measurements');
  if (legacyMeasurements.length) {
    throw projectError(
      'VIBRATION_PROJECT_LEGACY_MEASUREMENTS_UNQUALIFIED',
      'Non-empty legacy measurements are not accepted; use validated project.measurementEvidence.',
    );
  }
  if (project.measurementEvidence == null) return;
  assertVibrationMeasurementEvidencePackage(project.measurementEvidence);
  for (const session of project.measurementEvidence.sessions) {
    if (!lineIds.has(String(session.scope.lineId ?? ''))) {
      throw projectError(
        'VIBRATION_PROJECT_MEASUREMENT_DANGLING_LINE',
        'Measurement session references an unknown project line.',
        { sessionId: session.sessionId ?? null, lineId: session.scope?.lineId ?? null },
      );
    }
  }
}

function assertCommonProjectCollections(project) {
  requiredObject(project.project, 'project.project');
  const subjects = requiredObject(project.subjects, 'project.subjects');
  const lines = requiredArray(subjects.lines, 'project.subjects.lines');
  const mechanisms = requiredArray(project.mechanismImports, 'project.mechanismImports');
  const currentResults = requiredArray(project.currentResults, 'project.currentResults');
  if (currentResults.length) {
    throw projectError(
      'VIBRATION_PROJECT_CURRENT_RESULT_CONTRACT_UNQUALIFIED',
      'Project persistence does not accept current-result authority records; rerun registered calculations after load.',
    );
  }
  const lineIds = uniqueIds(lines, 'lineId', 'VIBRATION_PROJECT_LINE_ID_INVALID');
  uniqueIds(mechanisms, 'recordId', 'VIBRATION_PROJECT_MECHANISM_RECORD_ID_INVALID');
  for (const record of mechanisms) {
    if (!lineIds.has(String(record.lineId ?? ''))) {
      throw projectError(
        'VIBRATION_PROJECT_DANGLING_LINE_REFERENCE',
        'Mechanism import references an unknown line.',
        { recordId: record.recordId ?? null, lineId: record.lineId ?? null },
      );
    }
  }
  assertMeasurementEvidence(project, lineIds);
  return { lineIds };
}

function assertVibrationIntegrityProjectV1(project) {
  if (project.schema !== VIBRATION_INTEGRITY_PROJECT_SCHEMA) {
    throw projectError(
      'VIBRATION_PROJECT_SCHEMA_MISMATCH',
      `Project must use ${VIBRATION_INTEGRITY_PROJECT_SCHEMA}.`,
      { actual: project.schema ?? null },
    );
  }
  assertCommonProjectCollections(project);
  assertV1Authority(project);
  return project;
}

function assertProjectScopedLedger(wrapper, field, projectId, assertLedger, recordsCarryProjectId) {
  exactKeys(wrapper, PROJECT_SCOPED_LEDGER_KEYS, 'VIBRATION_PROJECT_V2_ACTIVITY_SCOPE_INVALID', field);
  if (requiredText(wrapper.projectId, `${field}.projectId`) !== projectId) {
    throw projectError(
      'VIBRATION_PROJECT_V2_ACTIVITY_PROJECT_MISMATCH',
      `${field} is bound to a different project.`,
      { field, projectId, actualProjectId: wrapper.projectId ?? null },
    );
  }
  const ledger = assertLedger(wrapper.ledger);
  if (recordsCarryProjectId) {
    for (const record of ledger.records) {
      if (String(record.projectId ?? '') !== projectId) {
        throw projectError(
          'VIBRATION_PROJECT_V2_ACTIVITY_RECORD_PROJECT_MISMATCH',
          `${field} contains a record from a different project.`,
          { field, recordId: record.recordId ?? null, recordProjectId: record.projectId ?? null },
        );
      }
    }
  }
  return ledger;
}

function assertV2Activity(activity, projectId) {
  exactKeys(activity, V2_ACTIVITY_KEYS, 'VIBRATION_PROJECT_V2_ACTIVITY_SHAPE_INVALID', 'project.activity');
  assertProjectScopedLedger(
    activity.actionCompletion,
    'project.activity.actionCompletion',
    projectId,
    assertVibrationActionCompletionLedger,
    false,
  );
  assertProjectScopedLedger(
    activity.actionVerification,
    'project.activity.actionVerification',
    projectId,
    assertVibrationActionVerificationLedger,
    true,
  );
  assertProjectScopedLedger(
    activity.rca,
    'project.activity.rca',
    projectId,
    assertVibrationRcaLedger,
    true,
  );
  assertProjectScopedLedger(
    activity.mitigation,
    'project.activity.mitigation',
    projectId,
    assertVibrationMitigationLedger,
    true,
  );
}

function assertV2EngineeringInputs(engineeringInputs) {
  exactKeys(
    engineeringInputs,
    V2_ENGINEERING_INPUT_KEYS,
    'VIBRATION_PROJECT_V2_ENGINEERING_INPUT_SHAPE_INVALID',
    'project.engineeringInputs',
  );
  for (const key of V2_ENGINEERING_INPUT_KEYS) {
    const rows = requiredArray(engineeringInputs[key], `project.engineeringInputs.${key}`);
    if (rows.length) {
      throw projectError(
        'VIBRATION_PROJECT_V2_ENGINEERING_INPUT_CONTRACT_UNQUALIFIED',
        `V2 reserves engineeringInputs.${key} but this lifecycle-persistence slice does not accept non-empty records yet.`,
        { key },
      );
    }
  }
}

function assertV2VisualInspection(project, lineIds) {
  const pkg = createVibrationVisualInspectionEvidencePackage(project.visualInspectionEvidence);
  if (pkg.schema !== VIBRATION_VISUAL_INSPECTION_PACKAGE_SCHEMA) {
    throw projectError('VIBRATION_PROJECT_V2_VISUAL_SCHEMA_INVALID', 'Visual inspection evidence package schema is invalid.');
  }
  for (const record of pkg.records) {
    if (!lineIds.has(String(record.scope.lineId ?? ''))) {
      throw projectError(
        'VIBRATION_PROJECT_V2_VISUAL_DANGLING_LINE',
        'Visual inspection evidence references an unknown project line.',
        { inspectionId: record.inspectionId ?? null, lineId: record.scope?.lineId ?? null },
      );
    }
  }
}

function assertV2OperatingScenarios(project) {
  const scenarios = requiredArray(project.operatingScenarioReferences, 'project.operatingScenarioReferences');
  const ids = new Set();
  for (const scenario of scenarios) {
    assertVibrationOperatingScenario(scenario);
    if (ids.has(scenario.scenarioId)) {
      throw projectError(
        'VIBRATION_PROJECT_V2_SCENARIO_DUPLICATE',
        'Operating scenario references must have unique scenarioId values.',
        { scenarioId: scenario.scenarioId },
      );
    }
    ids.add(scenario.scenarioId);
  }
}

function assertVibrationIntegrityProjectV2(project) {
  exactKeys(project, V2_TOP_LEVEL_KEYS, 'VIBRATION_PROJECT_V2_SHAPE_INVALID', 'project');
  const { lineIds } = assertCommonProjectCollections(project);
  const projectId = requiredText(project.project?.projectId, 'project.project.projectId');
  requiredObject(project.sourceImports, 'project.sourceImports');
  requiredArray(project.unknownCompatibilityModules, 'project.unknownCompatibilityModules');
  const actions = requiredArray(project.actions, 'project.actions');
  if (actions.length) {
    throw projectError(
      'VIBRATION_PROJECT_V2_LEGACY_ACTION_CONTRACT_UNQUALIFIED',
      'V2 reserves project.actions for compatibility but lifecycle custody must use project.activity.',
    );
  }
  requiredArray(project.historicalCalculationEvidence, 'project.historicalCalculationEvidence');
  if (project.historicalCalculationEvidence.length) {
    throw projectError(
      'VIBRATION_PROJECT_V2_HISTORICAL_CALCULATION_CONTRACT_UNQUALIFIED',
      'V2 reserves historicalCalculationEvidence but does not yet accept non-empty calculation evidence records.',
    );
  }
  assertV2EngineeringInputs(project.engineeringInputs);
  assertV2OperatingScenarios(project);
  assertV2VisualInspection(project, lineIds);
  assertV2Activity(project.activity, projectId);
  requiredObject(project.extensions, 'project.extensions');
  assertV2Authority(project);
  return project;
}

export function assertVibrationIntegrityProject(value) {
  const project = requiredObject(value, 'project');
  if (project.schema === VIBRATION_INTEGRITY_PROJECT_SCHEMA) return assertVibrationIntegrityProjectV1(project);
  if (project.schema === VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2) return assertVibrationIntegrityProjectV2(project);
  throw projectError(
    'VIBRATION_PROJECT_SCHEMA_MISMATCH',
    `Project must use ${VIBRATION_INTEGRITY_PROJECT_SCHEMA} or ${VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2}.`,
    { actual: project.schema ?? null },
  );
}

export function createEmptyVibrationProjectV2Activity(projectIdInput) {
  const projectId = requiredText(projectIdInput, 'projectId');
  return deepFreezeProjectValue({
    actionCompletion: { projectId, ledger: createVibrationActionCompletionLedger() },
    actionVerification: { projectId, ledger: createVibrationActionVerificationLedger() },
    rca: { projectId, ledger: createVibrationRcaLedger() },
    mitigation: { projectId, ledger: createVibrationMitigationLedger() },
  });
}

function emptyVisualInspectionEvidence() {
  return createVibrationVisualInspectionEvidencePackage({
    records: [],
    authority: VIBRATION_VISUAL_PACKAGE_AUTHORITY,
  });
}

export function migrateVibrationIntegrityProjectToV2(value) {
  const project = assertVibrationIntegrityProject(value);
  if (project.schema === VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2) {
    return deepFreezeProjectValue(cloneProjectValue(project));
  }
  const projectId = requiredText(project.project?.projectId, 'project.project.projectId');
  const known = new Set(V1_TOP_LEVEL_KEYS);
  const legacyV1TopLevel = Object.fromEntries(
    Object.entries(project)
      .filter(([key]) => !known.has(key))
      .map(([key, item]) => [key, cloneProjectValue(item)]),
  );
  const legacyActions = cloneProjectValue(project.actions ?? []);
  const extensions = {};
  if (Object.keys(legacyV1TopLevel).length) extensions.legacyV1TopLevel = legacyV1TopLevel;
  if (legacyActions.length) extensions.legacyV1Actions = legacyActions;
  const migrated = {
    schema: VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2,
    project: cloneProjectValue(project.project),
    sourceImports: cloneProjectValue(project.sourceImports ?? {}),
    subjects: cloneProjectValue(project.subjects),
    mechanismImports: cloneProjectValue(project.mechanismImports),
    unknownCompatibilityModules: cloneProjectValue(project.unknownCompatibilityModules ?? []),
    currentResults: [],
    measurements: [],
    measurementEvidence: cloneProjectValue(project.measurementEvidence),
    actions: [],
    engineeringInputs: {
      identificationEvidence: [],
      userEngineeringData: [],
      assumptions: [],
    },
    operatingScenarioReferences: [],
    visualInspectionEvidence: emptyVisualInspectionEvidence(),
    historicalCalculationEvidence: [],
    activity: createEmptyVibrationProjectV2Activity(projectId),
    extensions,
    authority: VIBRATION_INTEGRITY_PROJECT_V2_AUTHORITY,
  };
  assertVibrationIntegrityProjectV2(migrated);
  return deepFreezeProjectValue(migrated);
}

export function vibrationProjectLifecycleLedgers(value) {
  const project = assertVibrationIntegrityProject(value);
  const projectId = requiredText(project.project?.projectId, 'project.project.projectId');
  const activity = project.schema === VIBRATION_INTEGRITY_PROJECT_SCHEMA_V2
    ? project.activity
    : createEmptyVibrationProjectV2Activity(projectId);
  return deepFreezeProjectValue({
    projectId,
    actionCompletionLedger: cloneProjectValue(activity.actionCompletion.ledger),
    actionVerificationLedger: cloneProjectValue(activity.actionVerification.ledger),
    rcaLedger: cloneProjectValue(activity.rca.ledger),
    mitigationLedger: cloneProjectValue(activity.mitigation.ledger),
  });
}

export function attachVibrationProjectLifecycleLedgers(value, ledgers = {}) {
  const project = migrateVibrationIntegrityProjectToV2(value);
  const projectId = requiredText(project.project?.projectId, 'project.project.projectId');
  const completion = assertVibrationActionCompletionLedger(
    ledgers.actionCompletionLedger ?? project.activity.actionCompletion.ledger,
  );
  const verification = assertVibrationActionVerificationLedger(
    ledgers.actionVerificationLedger ?? project.activity.actionVerification.ledger,
  );
  const rca = assertVibrationRcaLedger(ledgers.rcaLedger ?? project.activity.rca.ledger);
  const mitigation = assertVibrationMitigationLedger(
    ledgers.mitigationLedger ?? project.activity.mitigation.ledger,
  );
  const next = cloneProjectValue(project);
  next.activity = {
    actionCompletion: { projectId, ledger: cloneProjectValue(completion) },
    actionVerification: { projectId, ledger: cloneProjectValue(verification) },
    rca: { projectId, ledger: cloneProjectValue(rca) },
    mitigation: { projectId, ledger: cloneProjectValue(mitigation) },
  };
  assertVibrationIntegrityProjectV2(next);
  return deepFreezeProjectValue(next);
}

export function cloneProjectValue(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function deepFreezeProjectValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreezeProjectValue(child);
  return Object.freeze(value);
}

export function createVibrationProjectError(code, message, details = {}) {
  return projectError(code, message, details);
}
