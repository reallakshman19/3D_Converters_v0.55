import { createHash } from 'node:crypto';
import {
  VIBRATION_INTEGRITY_DATASET_AUTHORITY,
  VIBRATION_INTEGRITY_DATASET_SCHEMA,
  VIBRATION_OPERATING_CASE_QUANTITIES,
  deepFreezeVibrationDataset,
} from './schema.js';

export const VIBRATION_OPERATING_SCENARIO_SCHEMA = 'OperatingScenario.v1';
export const VIBRATION_OPERATING_SCENARIO_DECLARATION = 'COHERENT_OPERATING_STATE';

export const VIBRATION_OPERATING_SCENARIO_AUTHORITY = Object.freeze({
  purpose: 'OPERATING_SCENARIO_IDENTITY_AND_PROVENANCE_ONLY',
  engineeringAuthority: 'NONE',
  screeningAuthority: 'NOT_AUTHORIZED',
  designAuthority: false,
  numericalAuthority: 'NONE',
  processActualizationAuthority: 'NONE',
  coherenceAuthority: 'CALLER_DECLARATION_ONLY',
  determinesApplicability: false,
  determinesCompleteness: false,
  crossScenarioMixingAllowed: false,
  independentMaximaSynthesisAllowed: false,
  designLimitSubstitutionAllowed: false,
});

const SELECTOR_FIELDS = new Set(['line', 'caseId', 'coherenceDeclaration']);

function scenarioError(code, message, details = {}) {
  const error = new Error(message);
  error.name = 'VibrationOperatingScenarioError';
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw scenarioError('VIBRATION_SCENARIO_TEXT_REQUIRED', `${field} is required.`, { field });
  }
  return value.trim();
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

function datasetProvenance(dataset) {
  const exchange = dataset.exchangeAuthority ?? {};
  const datasetId = requireText(exchange.datasetId, 'dataset.exchangeAuthority.datasetId');
  const missingFields = [];
  if (!exchange.datasetVersion) missingFields.push('datasetVersion');
  if (!exchange.sourceHash) missingFields.push('sourceHash');
  return {
    datasetId,
    datasetVersion: exchange.datasetVersion ?? null,
    sourceHash: exchange.sourceHash ?? null,
    canonicalHash: exchange.canonicalHash ?? null,
    projectionHash: exchange.projectionHash ?? null,
    sourceFileName: dataset.sourceFileName ?? null,
    status: missingFields.length ? 'INCOMPLETE' : 'COMPLETE',
    missingFields,
  };
}

function assertDataset(dataset) {
  if (!dataset || typeof dataset !== 'object' || Array.isArray(dataset)) {
    throw scenarioError('VIBRATION_SCENARIO_DATASET_REQUIRED', 'A vibration dataset is required.');
  }
  if (dataset.schema !== VIBRATION_INTEGRITY_DATASET_SCHEMA
    || dataset.authority !== VIBRATION_INTEGRITY_DATASET_AUTHORITY
    || !Array.isArray(dataset.operatingCases)) {
    throw scenarioError(
      'VIBRATION_SCENARIO_DATASET_INVALID',
      `Operating scenarios require governed ${VIBRATION_INTEGRITY_DATASET_SCHEMA} input.`,
    );
  }
  datasetProvenance(dataset);
  return dataset;
}

function normalizeSelector(selector) {
  if (!selector || typeof selector !== 'object' || Array.isArray(selector)) {
    throw scenarioError('VIBRATION_SCENARIO_SELECTOR_REQUIRED', 'Scenario selector must be an object.');
  }
  const unknown = Object.keys(selector).filter((key) => !SELECTOR_FIELDS.has(key));
  if (unknown.length) {
    throw scenarioError(
      'VIBRATION_SCENARIO_SELECTOR_FIELD_UNKNOWN',
      `Scenario selector contains unsupported fields: ${unknown.join(', ')}.`,
      { unknown },
    );
  }
  const coherenceDeclaration = requireText(selector.coherenceDeclaration, 'coherenceDeclaration');
  if (coherenceDeclaration !== VIBRATION_OPERATING_SCENARIO_DECLARATION) {
    throw scenarioError(
      'VIBRATION_SCENARIO_COHERENCE_DECLARATION_REQUIRED',
      `Scenario creation requires ${VIBRATION_OPERATING_SCENARIO_DECLARATION}.`,
    );
  }
  return {
    line: requireText(selector.line, 'line'),
    caseId: requireText(selector.caseId, 'caseId'),
    coherenceDeclaration,
  };
}

function selectCase(dataset, selector) {
  const matches = dataset.operatingCases.filter((row) => (
    row.line === selector.line && row.caseId === selector.caseId
  ));
  if (matches.length === 0) {
    throw scenarioError(
      'VIBRATION_SCENARIO_CASE_NOT_FOUND',
      `Operating case ${selector.caseId} was not found on line ${selector.line}.`,
      { line: selector.line, caseId: selector.caseId },
    );
  }
  if (matches.length !== 1) {
    throw scenarioError(
      'VIBRATION_SCENARIO_CASE_AMBIGUOUS',
      'Operating scenario selection requires exactly one line/case record.',
      { line: selector.line, caseId: selector.caseId, count: matches.length },
    );
  }
  return matches[0];
}

function cloneQuantity(quantity) {
  if (!quantity) return undefined;
  const result = { value: quantity.value, unit: quantity.unit };
  if (quantity.reference !== undefined) result.reference = quantity.reference;
  return result;
}

function quantitySnapshot(row) {
  const quantities = {};
  for (const field of VIBRATION_OPERATING_CASE_QUANTITIES) {
    const quantity = cloneQuantity(row[field]);
    if (quantity !== undefined) quantities[field] = quantity;
  }
  return quantities;
}

function caseProvenance(row) {
  const missingFields = [];
  if (!row.sourceRevision) missingFields.push('sourceRevision');
  if (!row.recordId) missingFields.push('recordId');
  return {
    source: row.source,
    sourceRevision: row.sourceRevision ?? null,
    recordId: row.recordId ?? null,
    status: missingFields.length ? 'INCOMPLETE' : 'COMPLETE',
    missingFields,
  };
}

function combinedProvenance(dataset, row) {
  const datasetRecord = datasetProvenance(dataset);
  const operatingCase = caseProvenance(row);
  const missingFields = [
    ...datasetRecord.missingFields.map((field) => `dataset.${field}`),
    ...operatingCase.missingFields.map((field) => `operatingCase.${field}`),
  ];
  return {
    status: missingFields.length ? 'INCOMPLETE' : 'COMPLETE',
    missingFields,
    dataset: datasetRecord,
    operatingCase,
  };
}

function identity(datasetId, line, caseId) {
  const identityHash = sha256({ datasetId, line, caseId });
  return {
    scenarioId: `OS-${identityHash.slice('sha256:'.length, 'sha256:'.length + 24)}`,
    identityHash,
  };
}

function snapshotCore(scenario) {
  return {
    datasetId: scenario.datasetId,
    line: scenario.line,
    caseId: scenario.caseId,
    label: scenario.label,
    phase: scenario.phase,
    quantities: scenario.quantities,
    provenance: scenario.provenance,
    coherence: scenario.coherence,
    basisState: scenario.basisState,
  };
}

function buildScenario(dataset, row, selector) {
  const provenance = combinedProvenance(dataset, row);
  const scenarioIdentity = identity(provenance.dataset.datasetId, row.line, row.caseId);
  const scenario = {
    schema: VIBRATION_OPERATING_SCENARIO_SCHEMA,
    ...scenarioIdentity,
    datasetId: provenance.dataset.datasetId,
    line: row.line,
    caseId: row.caseId,
    label: row.label ?? null,
    phase: row.phase ?? null,
    quantities: quantitySnapshot(row),
    provenance,
    coherence: {
      declaration: selector.coherenceDeclaration,
      basis: 'SINGLE_DATASET_OPERATING_CASE_ROW',
      crossScenarioMixingAllowed: false,
      independentMaximaSynthesisAllowed: false,
      designLimitSubstitutionAllowed: false,
    },
    basisState: {
      processBasis: 'NOT_REPRESENTED_BY_DATASET_V1',
      processActualization: 'NOT_PERFORMED',
      pressureReference: row.pressure
        ? (row.pressure.reference ? 'AS_PROVIDED' : 'UNRESOLVED')
        : 'NOT_PRESENT',
    },
    authority: VIBRATION_OPERATING_SCENARIO_AUTHORITY,
  };
  scenario.snapshotHash = sha256(snapshotCore(scenario));
  return deepFreezeVibrationDataset(scenario);
}

export function buildVibrationOperatingScenario(datasetInput, selectorInput) {
  const dataset = assertDataset(datasetInput);
  const selector = normalizeSelector(selectorInput);
  return buildScenario(dataset, selectCase(dataset, selector), selector);
}

export function assertVibrationOperatingScenario(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schema !== VIBRATION_OPERATING_SCENARIO_SCHEMA) {
    throw scenarioError('VIBRATION_SCENARIO_SCHEMA_INVALID', `Expected ${VIBRATION_OPERATING_SCENARIO_SCHEMA}.`);
  }
  const expectedIdentity = identity(
    requireText(value.datasetId, 'datasetId'),
    requireText(value.line, 'line'),
    requireText(value.caseId, 'caseId'),
  );
  if (value.scenarioId !== expectedIdentity.scenarioId || value.identityHash !== expectedIdentity.identityHash) {
    throw scenarioError('VIBRATION_SCENARIO_IDENTITY_INVALID', 'Scenario identity does not match dataset/line/case identity.');
  }
  if (value.coherence?.declaration !== VIBRATION_OPERATING_SCENARIO_DECLARATION
    || value.coherence?.basis !== 'SINGLE_DATASET_OPERATING_CASE_ROW'
    || value.coherence?.crossScenarioMixingAllowed !== false
    || value.coherence?.independentMaximaSynthesisAllowed !== false
    || value.coherence?.designLimitSubstitutionAllowed !== false) {
    throw scenarioError('VIBRATION_SCENARIO_COHERENCE_INVALID', 'Scenario coherence contract is invalid.');
  }
  const authority = value.authority;
  if (authority?.purpose !== 'OPERATING_SCENARIO_IDENTITY_AND_PROVENANCE_ONLY'
    || authority.engineeringAuthority !== 'NONE'
    || authority.screeningAuthority !== 'NOT_AUTHORIZED'
    || authority.designAuthority !== false
    || authority.numericalAuthority !== 'NONE'
    || authority.processActualizationAuthority !== 'NONE'
    || authority.coherenceAuthority !== 'CALLER_DECLARATION_ONLY') {
    throw scenarioError('VIBRATION_SCENARIO_AUTHORITY_INVALID', 'Scenario authority boundary is invalid.');
  }
  if (value.snapshotHash !== sha256(snapshotCore(value))) {
    throw scenarioError('VIBRATION_SCENARIO_SNAPSHOT_HASH_INVALID', 'Scenario snapshot hash does not match its content.');
  }
  return value;
}
