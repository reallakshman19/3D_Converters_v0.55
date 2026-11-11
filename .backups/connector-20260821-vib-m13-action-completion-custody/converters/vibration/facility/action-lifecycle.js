export const VIBRATION_REQUIRED_ACTION_SCHEMA = 'VibrationRequiredAction.v1';
export const VIBRATION_FINDING_SCHEMA = 'VibrationFinding.v1';
export const VIBRATION_FACILITY_ACTION_LIFECYCLE_SCHEMA = 'VibrationFacilityActionLifecycle.v1';

export const VIBRATION_FACILITY_ACTION_LIFECYCLE_AUTHORITY = Object.freeze({
  purpose: 'SOURCE_RESULT_OBLIGATION_AND_FINDING_PROJECTION_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  aggregationAuthority: 'NONE',
  persistenceAuthority: 'NONE',
  determinesApplicability: false,
  determinesCompleteness: false,
  determinesGoverningResult: false,
  blocksExecution: false,
  blocksNavigation: false,
  blocksCalculation: false,
  blocksPersistence: false,
});

const FIT_CONTINUATION_STATUS = 'QUALIFIED_BOUNDED_SCREENING_FURTHER_ASSESSMENT_REQUIRED';

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${field} must be a non-empty string.`);
  return text;
}

function scopeFromRow(row = {}) {
  return Object.freeze({
    line: requiredText(row.line, 'row.line'),
    caseId: requiredText(row.caseId, 'row.caseId'),
    canonicalId: requiredText(row.canonicalId, 'row.canonicalId'),
  });
}

function actionId(scope, actionKey) {
  return JSON.stringify(['fit', scope.line, scope.caseId, scope.canonicalId, actionKey]);
}

function findingId(action) {
  return `${action.actionId}:FINDING`;
}

function conflict(row, code) {
  return Object.freeze({
    code,
    mechanismId: 'fit',
    line: row?.line ?? null,
    caseId: row?.caseId ?? null,
    canonicalId: row?.canonicalId ?? null,
  });
}

function fitAction(row, resultState) {
  const required = row?.continuationRequired === true;
  const statusMatches = row?.screeningCandidateStatus === FIT_CONTINUATION_STATUS;
  if (required !== statusMatches) {
    return {
      action: null,
      conflict: conflict(row, 'FIT_CONTINUATION_STATUS_CONFLICT'),
    };
  }
  if (!required) return { action: null, conflict: null };

  let scope;
  try {
    scope = scopeFromRow(row);
  } catch {
    return {
      action: null,
      conflict: conflict(row, 'FIT_CONTINUATION_SCOPE_INVALID'),
    };
  }
  const action = Object.freeze({
    schema: VIBRATION_REQUIRED_ACTION_SCHEMA,
    actionId: actionId(scope, 'FURTHER_ASSESSMENT'),
    mechanismId: 'fit',
    scope,
    module: 'FIT',
    actionKey: 'FURTHER_ASSESSMENT',
    obligation: 'SHALL',
    reason: FIT_CONTINUATION_STATUS,
    completionState: 'OPEN',
    resultState,
    source: Object.freeze({
      kind: 'FIT_SCREENING_CONTINUATION',
      status: row.screeningCandidateStatus,
      obligationAuthority: 'CARRIED_FROM_SOURCE_RESULT_ONLY',
      sourceScopeId: 'FIT-SCREENING-CANDIDATE-V1',
    }),
  });
  return { action, conflict: null };
}

function findingFromAction(action) {
  if (action.resultState !== 'CURRENT_RESULT'
      || action.obligation !== 'SHALL'
      || action.completionState !== 'OPEN') return null;
  return Object.freeze({
    schema: VIBRATION_FINDING_SCHEMA,
    findingId: findingId(action),
    actionId: action.actionId,
    mechanismId: action.mechanismId,
    scope: action.scope,
    state: 'OPEN_REQUIRED_ACTION',
    reason: action.reason,
    completionState: action.completionState,
  });
}

function lifecycle({ actions, conflicts, resultState }) {
  const currentActions = actions.filter((action) => action.resultState === 'CURRENT_RESULT');
  const retainedStaleActions = actions.filter((action) => action.resultState === 'STALE_RESULT');
  const findings = currentActions.map(findingFromAction).filter(Boolean);
  return Object.freeze({
    schema: VIBRATION_FACILITY_ACTION_LIFECYCLE_SCHEMA,
    authority: VIBRATION_FACILITY_ACTION_LIFECYCLE_AUTHORITY,
    resultState,
    currentActions: Object.freeze(currentActions),
    retainedStaleActions: Object.freeze(retainedStaleActions),
    findings: Object.freeze(findings),
    sourceConflicts: Object.freeze(conflicts),
    summary: Object.freeze({
      currentActionCount: currentActions.length,
      retainedStaleActionCount: retainedStaleActions.length,
      openFindingCount: findings.length,
      sourceConflictCount: conflicts.length,
    }),
  });
}

export function buildVibrationFacilityRowActionLifecycle(row = {}, { resultState = 'UNRUN' } = {}) {
  const { action, conflict: sourceConflict } = fitAction(row, resultState);
  return lifecycle({
    actions: action ? [action] : [],
    conflicts: sourceConflict ? [sourceConflict] : [],
    resultState,
  });
}

export function buildVibrationFacilityActionLifecycle({ registerRows = [], resultState = 'UNRUN' } = {}) {
  if (!Array.isArray(registerRows)) throw new TypeError('registerRows must be an array.');
  const actions = [];
  const conflicts = [];
  for (const row of registerRows) {
    const rowLifecycle = buildVibrationFacilityRowActionLifecycle(row, { resultState });
    actions.push(...rowLifecycle.currentActions, ...rowLifecycle.retainedStaleActions);
    conflicts.push(...rowLifecycle.sourceConflicts);
  }
  const ids = new Set();
  for (const action of actions) {
    if (ids.has(action.actionId)) throw new Error(`Duplicate vibration required action: ${action.actionId}`);
    ids.add(action.actionId);
  }
  return lifecycle({ actions, conflicts, resultState });
}
