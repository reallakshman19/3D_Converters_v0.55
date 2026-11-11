import {
  createVibrationActionOccurrence,
  evaluateVibrationActionCompletion,
} from './action-completion.js';

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

function actionOccurrence(action, row, runBasis) {
  if (!runBasis) return { occurrence: null, conflict: null };
  if (!row?.scenarioExecutionBasis) {
    return { occurrence: null, conflict: conflict(row, 'ACTION_OCCURRENCE_CUSTODY_MISSING') };
  }
  try {
    return {
      occurrence: createVibrationActionOccurrence({
        action,
        runBasis,
        scenarioExecutionBasis: row.scenarioExecutionBasis,
      }),
      conflict: null,
    };
  } catch {
    return { occurrence: null, conflict: conflict(row, 'ACTION_OCCURRENCE_CUSTODY_INVALID') };
  }
}

function fitAction(row, resultState, runBasis) {
  const required = row?.continuationRequired === true;
  const statusMatches = row?.screeningCandidateStatus === FIT_CONTINUATION_STATUS;
  if (required !== statusMatches) {
    return { action: null, conflicts: [conflict(row, 'FIT_CONTINUATION_STATUS_CONFLICT')] };
  }
  if (!required) return { action: null, conflicts: [] };

  let scope;
  try {
    scope = scopeFromRow(row);
  } catch {
    return { action: null, conflicts: [conflict(row, 'FIT_CONTINUATION_SCOPE_INVALID')] };
  }
  const baseAction = {
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
  };
  const custody = actionOccurrence(baseAction, row, runBasis);
  const action = Object.freeze({
    ...baseAction,
    occurrence: custody.occurrence,
    completionHistory: Object.freeze([]),
    latestCompletion: null,
  });
  return {
    action,
    conflicts: custody.conflict ? [custody.conflict] : [],
  };
}

function applyCompletion(action, completionRecords) {
  if (!action?.occurrence) return { action, foreignRecords: [] };
  const evaluation = evaluateVibrationActionCompletion({
    occurrence: action.occurrence,
    records: completionRecords,
  });
  return {
    action: Object.freeze({
      ...action,
      completionState: evaluation.completionState,
      completionHistory: evaluation.appliedRecords,
      latestCompletion: evaluation.latestRecord,
    }),
    foreignRecords: evaluation.foreignRecords,
  };
}

function unresolvedFindingFromAction(action) {
  if (action.resultState !== 'CURRENT_RESULT' || action.obligation !== 'SHALL') return null;
  if (action.completionState !== 'OPEN' && action.completionState !== 'REOPENED') return null;
  return Object.freeze({
    schema: VIBRATION_FINDING_SCHEMA,
    findingId: findingId(action),
    actionId: action.actionId,
    occurrenceId: action.occurrence?.occurrenceId ?? null,
    mechanismId: action.mechanismId,
    scope: action.scope,
    state: action.completionState === 'REOPENED'
      ? 'REOPENED_REQUIRED_ACTION'
      : 'OPEN_REQUIRED_ACTION',
    reason: action.reason,
    completionState: action.completionState,
  });
}

function resolvedFindingFromAction(action) {
  if (action.resultState !== 'CURRENT_RESULT'
      || action.obligation !== 'SHALL'
      || action.completionState !== 'COMPLETED') return null;
  return Object.freeze({
    schema: VIBRATION_FINDING_SCHEMA,
    findingId: findingId(action),
    actionId: action.actionId,
    occurrenceId: action.occurrence?.occurrenceId ?? null,
    mechanismId: action.mechanismId,
    scope: action.scope,
    state: 'CLOSED_COMPLETED_ACTION',
    reason: action.reason,
    completionState: action.completionState,
  });
}

function lifecycle({ actions, conflicts, resultState, foreignCompletionRecords = [] }) {
  const currentActions = actions.filter((action) => action.resultState === 'CURRENT_RESULT');
  const retainedStaleActions = actions.filter((action) => action.resultState === 'STALE_RESULT');
  const findings = currentActions.map(unresolvedFindingFromAction).filter(Boolean);
  const resolvedFindings = currentActions.map(resolvedFindingFromAction).filter(Boolean);
  const appliedCompletionRecords = currentActions.flatMap((action) => action.completionHistory ?? []);
  return Object.freeze({
    schema: VIBRATION_FACILITY_ACTION_LIFECYCLE_SCHEMA,
    authority: VIBRATION_FACILITY_ACTION_LIFECYCLE_AUTHORITY,
    resultState,
    currentActions: Object.freeze(currentActions),
    retainedStaleActions: Object.freeze(retainedStaleActions),
    findings: Object.freeze(findings),
    resolvedFindings: Object.freeze(resolvedFindings),
    sourceConflicts: Object.freeze(conflicts),
    appliedCompletionRecords: Object.freeze(appliedCompletionRecords),
    foreignCompletionRecords: Object.freeze(foreignCompletionRecords),
    summary: Object.freeze({
      currentActionCount: currentActions.length,
      retainedStaleActionCount: retainedStaleActions.length,
      openFindingCount: findings.length,
      resolvedFindingCount: resolvedFindings.length,
      appliedCompletionRecordCount: appliedCompletionRecords.length,
      foreignCompletionRecordCount: foreignCompletionRecords.length,
      sourceConflictCount: conflicts.length,
    }),
  });
}

export function buildVibrationFacilityRowActionLifecycle(row = {}, {
  resultState = 'UNRUN', runBasis = null, completionRecords = [],
} = {}) {
  const produced = fitAction(row, resultState, runBasis);
  const applied = produced.action
    ? applyCompletion(produced.action, completionRecords)
    : { action: null, foreignRecords: [] };
  return lifecycle({
    actions: applied.action ? [applied.action] : [],
    conflicts: produced.conflicts,
    resultState,
    foreignCompletionRecords: applied.foreignRecords,
  });
}

export function buildVibrationFacilityActionLifecycle({
  registerRows = [], resultState = 'UNRUN', runBasis = null, completionRecords = [],
} = {}) {
  if (!Array.isArray(registerRows)) throw new TypeError('registerRows must be an array.');
  if (!Array.isArray(completionRecords)) throw new TypeError('completionRecords must be an array.');
  const actions = [];
  const conflicts = [];
  const foreignCompletionRecords = [];
  for (const row of registerRows) {
    const rowLifecycle = buildVibrationFacilityRowActionLifecycle(row, {
      resultState, runBasis, completionRecords,
    });
    actions.push(...rowLifecycle.currentActions, ...rowLifecycle.retainedStaleActions);
    conflicts.push(...rowLifecycle.sourceConflicts);
    foreignCompletionRecords.push(...rowLifecycle.foreignCompletionRecords);
  }
  const ids = new Set();
  for (const action of actions) {
    if (ids.has(action.actionId)) throw new Error(`Duplicate vibration required action: ${action.actionId}`);
    ids.add(action.actionId);
  }
  return lifecycle({ actions, conflicts, resultState, foreignCompletionRecords });
}
