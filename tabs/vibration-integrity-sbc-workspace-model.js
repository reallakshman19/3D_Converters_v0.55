import {
  SBC_ASSESSMENT_UNIT_TYPE,
  SBC_MAIN_LINE_INPUT_REQUIREMENT,
  SBC_PUBLIC_CALCULATION_ID,
  SBC_TYPE_IDS,
  SBC_TYPE_IMPLEMENTATION_SLOTS,
  SBC_VERTICAL_LIFECYCLE,
} from '../converters/vibration/sbc/vertical-manifest.js';
import { getSbcTypeClassificationContract } from '../converters/vibration/sbc/type-classification-contract.js';
import { getSbcTypeInputContract } from '../converters/vibration/sbc/type-input-contracts.js';

function normalizedType(value) {
  const typeId = String(value ?? '').trim().toUpperCase();
  return SBC_TYPE_IDS.includes(typeId) ? typeId : '';
}

function typeProjection(typeId, selectedType) {
  const slot = SBC_TYPE_IMPLEMENTATION_SLOTS[typeId];
  const input = getSbcTypeInputContract(typeId);
  const classification = getSbcTypeClassificationContract(typeId);
  return Object.freeze({
    typeId,
    selected: typeId === selectedType,
    lifecycleState: slot.lifecycle.state,
    executionAllowed: slot.executionAllowed === true,
    numericalExecutionAllowed: input?.numericalExecutionAllowed === true,
    automaticClassificationAllowed: classification?.automaticClassificationAllowed === true,
    classificationStatus: classification?.status ?? 'UNKNOWN',
    inputContractStatus: input?.status ?? 'UNKNOWN',
    requiredFields: input?.requiredFields ?? Object.freeze([]),
    notes: input?.notes ?? Object.freeze([]),
    blockedBy: slot.blockedBy,
    publishedBenchmark: slot.benchmarkRequirements.publishedB1.exampleId,
    independentBenchmarkRequired: slot.benchmarkRequirements.independentB2.required === true,
    nextImplementationSeam: slot.nextImplementationSeam,
    isType3: typeId === 'TYPE_3',
    curveQuarantine: typeId === 'TYPE_3'
      ? slot.blockedBy.includes('SBC_T3_CURVES_BLOCKED_SOURCE_DATA_CONFLICT')
      : false,
  });
}

export function createSbcWorkspaceUiState() {
  return Object.freeze({ sbcWorkspaceType: '', sbcWorkspaceScopeId: '' });
}

export function setSbcWorkspaceType(state, value) {
  state.sbcWorkspaceType = normalizedType(value);
  return state.sbcWorkspaceType;
}

export function setSbcWorkspaceScope(state, value) {
  state.sbcWorkspaceScopeId = String(value ?? '').trim();
  return state.sbcWorkspaceScopeId;
}

export function buildSbcWorkspaceProjection(state = {}) {
  const selectedType = normalizedType(state.sbcWorkspaceType);
  const scopeId = String(state.sbcWorkspaceScopeId ?? state.sbcType3ScopeId ?? '').trim();
  return Object.freeze({
    schema: 'VibrationSbcWorkspaceProjection.v1',
    calculationId: SBC_PUBLIC_CALCULATION_ID,
    assessmentUnitType: SBC_ASSESSMENT_UNIT_TYPE,
    lifecycleState: SBC_VERTICAL_LIFECYCLE.state,
    scopeId,
    selectedType,
    explicitTypeConfirmationRequired: selectedType === '',
    automaticClassificationAllowed: false,
    mainLineRequirement: Object.freeze({
      sourceContract: SBC_MAIN_LINE_INPUT_REQUIREMENT.sourceContract,
      fitOnlyAccepted: SBC_MAIN_LINE_INPUT_REQUIREMENT.fitOnlyAccepted,
      assessmentCompletenessRequired: SBC_MAIN_LINE_INPUT_REQUIREMENT.assessmentCompletenessRequired,
    }),
    authority: Object.freeze({
      engineeringAuthority: 'NONE_FOR_FULL_VERTICAL',
      screeningAuthority: 'NOT_AUTHORIZED_FOR_FULL_VERTICAL',
      designAuthority: false,
    }),
    types: Object.freeze(SBC_TYPE_IDS.map((typeId) => typeProjection(typeId, selectedType))),
  });
}
