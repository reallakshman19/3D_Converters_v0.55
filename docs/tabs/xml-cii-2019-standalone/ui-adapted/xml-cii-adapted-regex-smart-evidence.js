import {
  getMasterDatasetRowsByIndexes,
  searchMasterDatasetRows,
} from './xml-cii-adapted-master-dataset-runtime.js?v=20261007-c05-6-2-consumer-authority-1';
import {
  buildRegexBoundedEvidencePlan,
  resolveRegexBoundedDatasetEvidence,
} from '../xml-cii-regex-bounded-evidence.js';
import {
  buildRegexSuggestionPreflight,
  classifyRegexExtractionRows,
  createDefaultRegexSuggestionProfile,
} from '../xml-cii-regex-smart-suggestions.js?v=20261001-weight-rating-1';

const REGEX_MASTER_DEFS = Object.freeze({
  lineList: Object.freeze({ rowsKey: 'lineRows', queriesKey: 'lineListQueries' }),
  pipingClass: Object.freeze({ rowsKey: 'pipingClassRows', queriesKey: 'pipingClassQueries' }),
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

function residentEvidence(context, masterKey) {
  return Object.freeze({
    masterKey,
    rows: Object.freeze([...rows(context?.[REGEX_MASTER_DEFS[masterKey].rowsKey])]),
    queryCount: 0,
    matchedQueryCount: 0,
    rowIndexCount: 0,
    truncatedQueryCount: 0,
    totalIndexOverflow: false,
    resident: true,
  });
}

async function boundedEvidence(context, masterKey, plan, options) {
  const def = REGEX_MASTER_DEFS[masterKey];
  const ref = object(context?.datasetRefs?.[masterKey]);
  if (!ref.datasetId) return residentEvidence(context, masterKey);
  return resolveRegexBoundedDatasetEvidence({
    masterKey,
    datasetRef: ref,
    queries: plan[def.queriesKey],
    search: options.search || searchMasterDatasetRows,
    getRowsByIndexes: options.getRowsByIndexes || getMasterDatasetRowsByIndexes,
    maxIndexesPerQuery: options.maxIndexesPerQuery,
    maxTotalIndexes: options.maxTotalIndexes,
  });
}

function evidenceSummary(plan, lineEvidence, classEvidence, hasDatasetEvidence) {
  if (!hasDatasetEvidence) return null;
  const complete = !plan.queryOverflow.lineList
    && !plan.queryOverflow.pipingClass
    && !lineEvidence.totalIndexOverflow
    && !classEvidence.totalIndexOverflow;
  return Object.freeze({
    mode: 'BOUNDED_MASTER_EVIDENCE',
    complete,
    analysis: Object.freeze({
      sourceSampleCount: plan.analysis.sourceSampleCount,
      structuralBucketCount: plan.analysis.structuralBucketCount,
      selectedBucketCount: plan.analysis.selectedBucketCount,
      selectedSampleCount: plan.analysis.selectedSampleCount,
      selectedSignatures: plan.analysis.selectedSignatures,
    }),
    queryOverflow: plan.queryOverflow,
    lineList: Object.freeze({
      queryCount: lineEvidence.queryCount,
      matchedQueryCount: lineEvidence.matchedQueryCount || 0,
      rowIndexCount: lineEvidence.rowIndexCount,
      truncatedQueryCount: lineEvidence.truncatedQueryCount,
    }),
    pipingClass: Object.freeze({
      queryCount: classEvidence.queryCount,
      matchedQueryCount: classEvidence.matchedQueryCount || 0,
      rowIndexCount: classEvidence.rowIndexCount,
      truncatedQueryCount: classEvidence.truncatedQueryCount,
    }),
  });
}

export async function materializeRegexSmartMasterContext(state = {}, options = {}) {
  const context = object(state.masterContext);
  const profile = state.regexSuggestionProfile || createDefaultRegexSuggestionProfile();
  const plan = buildRegexBoundedEvidencePlan({
    branchSamples: rows(state?.regexTesterResult?.branchSamples),
    extractionConfig: state.regexTesterConfig,
    profile,
    queryLimit: options.queryLimit,
  });
  const lineEvidence = await boundedEvidence(context, 'lineList', plan, options);
  const classEvidence = await boundedEvidence(context, 'pipingClass', plan, options);
  const refs = object(context.datasetRefs);
  const bounded = evidenceSummary(plan, lineEvidence, classEvidence, Boolean(refs?.lineList?.datasetId || refs?.pipingClass?.datasetId));
  const transient = {
    ...context,
    lineRows: [...lineEvidence.rows],
    pipingClassRows: [...classEvidence.rows],
    ...(bounded ? { regexBoundedEvidence: bounded } : {}),
  };
  const evidenceBasis = stable({
    lineList: masterBasis(context, 'lineList', lineEvidence.rows.length),
    pipingClass: masterBasis(context, 'pipingClass', classEvidence.rows.length),
    bounded,
  });
  return Object.freeze({
    masterContext: transient,
    evidenceBasis,
    requestBasis: regexSmartEvidenceRequestBasis(state),
    lineRowCount: lineEvidence.rows.length,
    pipingClassRowCount: classEvidence.rows.length,
    analysisSampleCount: plan.analysis.selectedSampleCount,
    selectedBucketCount: plan.analysis.selectedBucketCount,
    boundedEvidence: bounded,
  });
}

function analysisPlan(state = {}) {
  return buildRegexBoundedEvidencePlan({
    branchSamples: rows(state?.regexTesterResult?.branchSamples),
    extractionConfig: state.regexTesterConfig,
    profile: state.regexSuggestionProfile || createDefaultRegexSuggestionProfile(),
  });
}

export function buildRegexSmartEvidenceReceipt(state = {}, masterContext = state.masterContext) {
  const plan = analysisPlan(state);
  return buildRegexSuggestionPreflight({
    branchSamples: rows(state?.regexTesterResult?.branchSamples),
    analysisSamples: plan.analysis.samples,
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
  return ['MASTER_BACKED', 'PARTIAL_MASTER_EVIDENCE', 'BOUNDED_MASTER_EVIDENCE'].includes(receipt?.masterEvidence?.mode);
}

export const REGEX_SMART_MASTER_KEYS = Object.freeze(Object.keys(REGEX_MASTER_DEFS));
