import { VIBRATION_MECHANISM_IDS, VIBRATION_MECHANISM_REGISTRY } from './registry.js';
import {
  VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA,
  createMechanismLineResult,
  createMechanismNumericResultFromAssessmentItem,
} from './result-contracts.js';

export const VIBRATION_MECHANISM_REDUCER_REGISTRY_SCHEMA = 'VibrationMechanismReducerRegistry.v1';
export const VIBRATION_MECHANISM_REDUCER_REGISTRY_REVISION = 'VIB-MECH-REDUCE-2026-08-18';
export const VIBRATION_MECHANISM_ASSESSMENT_SET_SCHEMA = 'VibrationMechanismAssessmentSet.v1';

const REDUCER_ENTRIES = VIBRATION_MECHANISM_IDS.map((mechanismId) => ({
  mechanismId,
  singleItemRule: 'IDENTITY_SINGLE_ASSESSMENT_UNIT',
  singleItemQualification: 'STRUCTURAL_IDENTITY_ONLY',
  multiItemRule: null,
  multiItemQualification: 'UNQUALIFIED',
}));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sameScope(left, right) {
  return left?.line === right?.line
    && (left?.caseId ?? null) === (right?.caseId ?? null)
    && left?.canonicalId === right?.canonicalId;
}

function reducerFingerprint(entries = REDUCER_ENTRIES) {
  return JSON.stringify([
    VIBRATION_MECHANISM_REDUCER_REGISTRY_SCHEMA,
    VIBRATION_MECHANISM_REDUCER_REGISTRY_REVISION,
    VIBRATION_MECHANISM_REGISTRY.revision,
    entries.map((entry) => [
      entry.mechanismId,
      entry.singleItemRule,
      entry.singleItemQualification,
      entry.multiItemRule,
      entry.multiItemQualification,
    ]),
  ]);
}

const entries = REDUCER_ENTRIES.map((entry) => deepFreeze({ ...entry }));
const reducerByMechanism = new Map(entries.map((entry) => [entry.mechanismId, entry]));

export const VIBRATION_MECHANISM_REDUCER_REGISTRY = deepFreeze({
  schema: VIBRATION_MECHANISM_REDUCER_REGISTRY_SCHEMA,
  revision: VIBRATION_MECHANISM_REDUCER_REGISTRY_REVISION,
  mechanismRegistryRevision: VIBRATION_MECHANISM_REGISTRY.revision,
  mechanismRegistryFingerprint: VIBRATION_MECHANISM_REGISTRY.fingerprint,
  fingerprint: reducerFingerprint(entries),
  entries,
  authority: {
    universalMultiItemReducer: false,
    multiItemReductionQualified: false,
    engineeringAuthority: 'REDUCTION_CUSTODY_ONLY',
    screeningAuthority: 'NOT_PROMOTED',
    designAuthority: false,
  },
});

export function getVibrationMechanismReducerPolicy(mechanismId) {
  return reducerByMechanism.get(String(mechanismId ?? '').trim()) ?? null;
}

function assertAssessmentSet(set) {
  if (set?.schema !== VIBRATION_MECHANISM_ASSESSMENT_SET_SCHEMA) {
    throw new TypeError(`Reducer input must use ${VIBRATION_MECHANISM_ASSESSMENT_SET_SCHEMA}.`);
  }
  const policy = getVibrationMechanismReducerPolicy(set.mechanismId);
  if (!policy) throw new Error(`UNKNOWN_VIBRATION_MECHANISM_REDUCER:${set.mechanismId ?? 'UNKNOWN'}`);
  if (!Array.isArray(set.items)) throw new TypeError('Assessment set items must be an array.');
  for (const item of set.items) {
    if (item?.schema !== VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA) {
      throw new TypeError(`Assessment set items must use ${VIBRATION_MECHANISM_ASSESSMENT_ITEM_SCHEMA}.`);
    }
    if (item.mechanismId !== set.mechanismId || !sameScope(item.scope, set.scope)) {
      throw new Error('MECHANISM_REDUCER_ASSESSMENT_SCOPE_MISMATCH');
    }
  }
  return policy;
}

function numericBlockingReasons(numericResults) {
  return numericResults.flatMap((numeric) => (
    numeric.aggregationEligible
      ? []
      : numeric.reasons.map((reason) => `${reason}:${numeric.assessmentItemId}`)
  ));
}

function incompleteResult(set, numericResults, reduction, reasons) {
  return createMechanismLineResult({
    mechanismId: set.mechanismId,
    scope: set.scope,
    assessmentId: set.setId,
    state: 'INCOMPLETE',
    governingLof: null,
    aggregationEligible: false,
    reduction,
    numericResults,
    reasons,
  });
}

export function reduceVibrationMechanismAssessmentSetToLineResult(set) {
  const policy = assertAssessmentSet(set);
  const numericResults = set.items.map(createMechanismNumericResultFromAssessmentItem);

  if (numericResults.length === 0) {
    return incompleteResult(set, numericResults, {
      ruleId: null,
      qualification: 'NO_ASSESSMENT_UNIT_RESULT',
      inputCardinality: 'ZERO',
    }, ['NO_ASSESSMENT_UNIT_RESULT']);
  }

  const blocking = numericBlockingReasons(numericResults);
  if (numericResults.length === 1) {
    if (blocking.length) {
      return incompleteResult(set, numericResults, {
        ruleId: policy.singleItemRule,
        qualification: policy.singleItemQualification,
        inputCardinality: 'ONE',
      }, blocking);
    }
    return createMechanismLineResult({
      mechanismId: set.mechanismId,
      scope: set.scope,
      assessmentId: set.setId,
      state: 'CURRENT_RESULT',
      governingLof: numericResults[0].lof.value,
      aggregationEligible: true,
      reduction: {
        ruleId: policy.singleItemRule,
        qualification: policy.singleItemQualification,
        inputCardinality: 'ONE',
      },
      numericResults,
      reasons: [],
    });
  }

  const reasons = [
    ...blocking,
    `MULTI_ITEM_REDUCTION_UNQUALIFIED:${set.mechanismId}`,
  ];
  return incompleteResult(set, numericResults, {
    ruleId: policy.multiItemRule,
    qualification: policy.multiItemQualification,
    inputCardinality: 'MANY',
  }, reasons);
}
