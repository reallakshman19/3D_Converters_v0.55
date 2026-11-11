import { executeVibrationWithScenarioGuard } from '../mechanisms/scenario-execution.js';
import {
  MECHANICAL_T23_DIRECT_BASELINE_ROWS,
  MECHANICAL_T23_SHARED_SUPPORT_RULE,
  evaluateMechanicalT23DirectBaseline,
} from './t23-method.js';

const LABELS = Object.freeze({
  RECIP_PD_COMPRESSOR_OR_PUMP: 'Reciprocating / PD compressor or pump',
  DIESEL_OR_GAS_ENGINE_DRIVE: 'Diesel / gas engine drive',
  SCREW_COMPRESSOR_OR_PUMP: 'Screw compressor / pump',
  CENTRIFUGAL_PUMP: 'Centrifugal pump',
  ELECTRIC_MOTOR_OR_ALTERNATOR_GE_15KW: 'Electric motor / alternator ≥ 15 kW',
  ELECTRIC_MOTOR_OR_ALTERNATOR_LT_15KW: 'Electric motor / alternator < 15 kW',
  CENTRIFUGAL_COMPRESSOR: 'Centrifugal compressor',
  GAS_TURBINE: 'Gas turbine',
  FAN_OR_BLOWER: 'Fan / blower',
  PIPEWORK_SHARING_SUPPORTS_WITH_LINE_LOF_GE_0_50: 'Shared supports with adjacent line LOF ≥ 0.50',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function requiredText(value, code) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(code);
  return text;
}

function encoded(value) {
  return encodeURIComponent(String(value));
}

export function mechanicalFacilityScopeId(row = {}) {
  const line = requiredText(row.line, 'MECHANICAL_FACILITY_LINE_REQUIRED');
  const canonicalId = requiredText(row.canonicalId, 'MECHANICAL_FACILITY_CANONICAL_ID_REQUIRED');
  const caseId = row.caseId === null || row.caseId === undefined ? '-' : requiredText(
    row.caseId, 'MECHANICAL_FACILITY_CASE_ID_INVALID',
  );
  return `MECHANICAL-FACILITY/${encoded(line)}/${encoded(caseId)}/${encoded(canonicalId)}`;
}

export function mechanicalFacilityScope(row = {}) {
  return deepFreeze({
    schema: 'MechanicalFacilityScope.v1',
    scopeId: mechanicalFacilityScopeId(row),
    line: requiredText(row.line, 'MECHANICAL_FACILITY_LINE_REQUIRED'),
    caseId: row.caseId ?? null,
    canonicalId: requiredText(row.canonicalId, 'MECHANICAL_FACILITY_CANONICAL_ID_REQUIRED'),
  });
}

export const MECHANICAL_T23_SOURCE_OPTIONS = deepFreeze([
  ...MECHANICAL_T23_DIRECT_BASELINE_ROWS.map((row) => ({
    sourceKey: row.sourceKey,
    label: LABELS[row.sourceKey] ?? row.sourceKey,
    baselineLof: row.baselineLof,
    qualificationGate: row.qualificationGate,
    directBaselineAvailable: true,
    screeningAuthorized: true,
  })),
  {
    sourceKey: MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey,
    label: LABELS[MECHANICAL_T23_SHARED_SUPPORT_RULE.sourceKey],
    baselineLof: null,
    qualificationGate: 'ADJACENT_LINE_LOF_REQUIRED',
    directBaselineAvailable: false,
    screeningAuthorized: false,
    reason: 'Requires explicit adjacent-line LOF; not part of qualified direct T2.3 baseline screening.',
  },
]);

function normalizeSourceKeys(sourceKeys) {
  if (!Array.isArray(sourceKeys)) throw new TypeError('MECHANICAL_T23_SOURCE_KEYS_INVALID');
  const keys = [...new Set(sourceKeys.map((value) => requiredText(
    value, 'MECHANICAL_T23_SOURCE_KEY_INVALID',
  )))];
  if (!keys.length) throw new TypeError('MECHANICAL_T23_SOURCE_SELECTION_REQUIRED');
  return keys;
}

function assertScenarioScope(scope, operatingScenario) {
  if (scope.caseId === null || scope.caseId === undefined) {
    throw new Error('MECHANICAL_FACILITY_OPERATING_CASE_REQUIRED');
  }
  if (operatingScenario?.line !== scope.line || operatingScenario?.caseId !== scope.caseId) {
    throw new Error('MECHANICAL_FACILITY_SCENARIO_SCOPE_MISMATCH');
  }
}

export async function evaluateMechanicalFacilityCandidate(row, sourceKeys) {
  const scope = mechanicalFacilityScope(row);
  const evaluated = evaluateMechanicalT23DirectBaseline(normalizeSourceKeys(sourceKeys));
  return deepFreeze({
    schema: 'MechanicalFacilityScreeningResult.v1',
    status: 'CALCULATED_SCREENING',
    scope,
    sourceKeys: evaluated.sourceKeys,
    governingLof: evaluated.governingLof,
    governingSourceKey: evaluated.governingSourceKey,
    rows: evaluated.rows,
    provenance: evaluated.provenance,
    methodId: evaluated.methodId,
    methodRevision: evaluated.methodRevision,
    authority: evaluated.authority,
  });
}

export async function evaluateMechanicalFacilityCandidateWithScenario({
  row,
  sourceKeys,
  scenarioBinding,
  operatingScenario,
} = {}) {
  const scope = mechanicalFacilityScope(row);
  assertScenarioScope(scope, operatingScenario);
  return executeVibrationWithScenarioGuard({
    scenarioBinding,
    operatingScenario,
    execute: async ({ executionBasis }) => {
      const result = await evaluateMechanicalFacilityCandidate(row, sourceKeys);
      return deepFreeze({
        ...result,
        scenarioExecutionBasis: executionBasis,
      });
    },
  });
}

export function inspectMechanicalFacilityCandidate(row, candidate = null) {
  const scope = mechanicalFacilityScope(row);
  if (!candidate) return deepFreeze({ ok: false, status: 'NOT_EVALUATED', scope, candidate: null });
  if (candidate.schema !== 'MechanicalFacilityScreeningResult.v1') {
    return deepFreeze({ ok: false, status: 'INVALID_SCREENING_RESULT_SCHEMA', scope, candidate: null });
  }
  if (candidate.scope?.scopeId !== scope.scopeId) {
    return deepFreeze({ ok: false, status: 'FACILITY_SCOPE_MISMATCH', scope, candidate: null });
  }
  if (!Number.isFinite(Number(candidate.governingLof))) {
    return deepFreeze({ ok: false, status: 'INVALID_SCREENING_LOF', scope, candidate: null });
  }
  if (candidate.authority?.screeningAuthority !== 'AUTHORIZED'
      || candidate.authority?.authorityScope !== 'DIRECT_TABLE_T2_3_BASELINE_ONLY'
      || candidate.authority?.designAuthority !== false) {
    return deepFreeze({ ok: false, status: 'SCREENING_AUTHORITY_INVALID', scope, candidate: null });
  }
  return deepFreeze({ ok: true, status: 'CURRENT_SCREENING', scope, candidate });
}
