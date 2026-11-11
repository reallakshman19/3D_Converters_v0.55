import { materializeMasterDatasetRows } from './xml-cii-adapted-master-dataset-runtime.js?v=20260929-pr780-bounded-ui-1';
import {
  buildRegexSuggestionPreflight,
  classifyRegexExtractionRows,
  createDefaultRegexSuggestionProfile,
} from '../xml-cii-regex-smart-suggestions.js?v=20260930-issue781-auto-authority-1';

const REGEX_MASTER_DEFS = Object.freeze({
  lineList: Object.freeze({ rowsKey: 'lineRows' }),
  pipingClass: Object.freeze({ rowsKey: 'pipingClassRows' }),
});

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function compactFieldMap(ref, context, masterKey) {
  const configKey = masterKey === 'lineList' ? 'linelist' : 'pipingClass';
  return object(ref?.fieldMap || context?.config?.[configKey]?.fieldMap || context?.[`${masterKey}FieldMap`]);
}

function masterBasis(context, masterKey, hydratedCount = null) {
  const def = REGEX_MASTER_DEFS[masterKey];
  const ref = object(context?.datasetRefs?.[masterKey]);
  const resident = rows(context?.[def.rowsKey]);
  const expected = Math.max(0, Number(ref.rowCount ?? context?.rowCounts?.[masterKey]) || 0);
  return {
    masterKey,
    datasetId: String(ref.datasetId || ''),
    rowCount: expected,
    mappingRevision: Number(context?.appliedMappingRevision?.[masterKey] || 0),
    fieldMap: compactFieldMap(ref, context, masterKey),
    residentRows: resident.length,
    hydratedRows: hydratedCount === null ? resident.length : Math.max(0, Number(hydratedCount) || 0),
  };
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function regexSmartEvidenceRequestBasis(state = {}) {
  const context = object(state.masterContext);
  return stable({
    lineList: masterBasis(context, 'lineList'),
    pipingClass: masterBasis(context, 'pipingClass'),
  });
}

export function regexSmartReceiptRequestBasis(state = {}) {
  const result = object(state.regexTesterResult);
  const samples = rows(result.branchSamples).map((row) => String(row?.branchName || row?.lineReference || ''));
  return stable({
    evidence: JSON.parse(regexSmartEvidenceRequestBasis(state)),
    extractionConfig: object(state.regexTesterConfig),
    profile: object(state.regexSuggestionProfile),
    samples,
    coverage: {
      matched: rows(result.matchedRows).length,
      rejected: rows(result.rejectedRows).length,
    },
  });
}

function exactResidentRows(context, masterKey, expected) {
  const resident = rows(context?.[REGEX_MASTER_DEFS[masterKey].rowsKey]);
  if (!resident.length) return null;
  if (expected > 0 && resident.length !== expected) return null;
  return resident;
}

async function evidenceRows(context, masterKey, materializeRows) {
  const ref = object(context?.datasetRefs?.[masterKey]);
  const expected = Math.max(0, Number(ref.rowCount ?? context?.rowCounts?.[masterKey]) || 0);
  const resident = exactResidentRows(context, masterKey, expected);
  if (resident) return resident;
  if (!ref.datasetId) return rows(context?.[REGEX_MASTER_DEFS[masterKey].rowsKey]);
  const materialized = await materializeRows(masterKey, ref);
  if (!Array.isArray(materialized) || materialized.length !== expected) {
    throw new Error(`Regex master evidence materialization mismatch for ${masterKey}: expected ${expected}, received ${Array.isArray(materialized) ? materialized.length : 0}.`);
  }
  return materialized;
}

export async function materializeRegexSmartMasterContext(state = {}, options = {}) {
  const context = object(state.masterContext);
  const materializeRows = options.materializeRows || materializeMasterDatasetRows;
  const lineRows = await evidenceRows(context, 'lineList', materializeRows);
  const pipingClassRows = await evidenceRows(context, 'pipingClass', materializeRows);
  const transient = {
    ...context,
    lineRows,
    pipingClassRows,
  };
  const evidenceBasis = stable({
    lineList: masterBasis(context, 'lineList', lineRows.length),
    pipingClass: masterBasis(context, 'pipingClass', pipingClassRows.length),
  });
  return Object.freeze({
    masterContext: transient,
    evidenceBasis,
    requestBasis: regexSmartEvidenceRequestBasis(state),
    lineRowCount: lineRows.length,
    pipingClassRowCount: pipingClassRows.length,
  });
}

export function buildRegexSmartEvidenceReceipt(state = {}, masterContext = state.masterContext) {
  return buildRegexSuggestionPreflight({
    branchSamples: rows(state?.regexTesterResult?.branchSamples),
    extractionConfig: state.regexTesterConfig,
    masterContext,
    currentResult: object(state.regexTesterResult),
    profile: state.regexSuggestionProfile || createDefaultRegexSuggestionProfile(),
  });
}

export function classifyRegexSmartTesterResult(result = {}, masterContext = {}) {
  return {
    ...object(result),
    matchedRows: classifyRegexExtractionRows(rows(result?.matchedRows), masterContext),
    rejectedRows: classifyRegexExtractionRows(rows(result?.rejectedRows), masterContext),
  };
}

export async function resolveRegexSmartEvidence(state = {}, options = {}) {
  const hydrated = await materializeRegexSmartMasterContext(state, options);
  const classifiedResult = classifyRegexSmartTesterResult(state.regexTesterResult, hydrated.masterContext);
  const receipt = buildRegexSmartEvidenceReceipt({ ...state, regexTesterResult: classifiedResult }, hydrated.masterContext);
  return Object.freeze({
    ...hydrated,
    receipt,
    regexTesterResult: classifiedResult,
    receiptRequestBasis: regexSmartReceiptRequestBasis(state),
  });
}

export function regexSmartHasDatasetEvidence(state = {}) {
  const refs = object(state?.masterContext?.datasetRefs);
  return Boolean(refs?.lineList?.datasetId || refs?.pipingClass?.datasetId);
}

export function regexSmartReceiptIsCurrent(state = {}) {
  const receipt = state.regexSmartPreflight;
  if (!receipt) return false;
  if (state.regexSmartPreflightRequestBasis !== regexSmartReceiptRequestBasis(state)) return false;
  if (!regexSmartHasDatasetEvidence(state)) return true;
  return receipt?.masterEvidence?.mode === 'MASTER_BACKED' || receipt?.masterEvidence?.mode === 'PARTIAL_MASTER_EVIDENCE';
}

export const REGEX_SMART_MASTER_KEYS = Object.freeze(Object.keys(REGEX_MASTER_DEFS));
