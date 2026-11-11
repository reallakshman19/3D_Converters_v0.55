import { buildRegexRoleSuggestions } from './xml-cii-regex-suggestion-candidates.js?v=20260930-issue781-auto-authority-1';
import { computeLineNoKey } from '../../converters/xml-cii2019-core/linelist-mapping.js';
import { buildPipingClassIndex, normalizePipingClass } from '../../converters/xml-cii2019-core/piping-class-resolver.js';

const ROLE_ORDER = ['lineKey', 'pipingClass', 'bore'];

let lineMasterCache = new WeakMap();
let classMasterCache = new WeakMap();
let preflightCache = new WeakMap();
const cacheStats = { lineMasterBuilds: 0, classMasterBuilds: 0, preflightHits: 0, preflightMisses: 0 };

export function regexSuggestionCacheStats() { return { ...cacheStats }; }
export function resetRegexSuggestionCachesForTests() {
  lineMasterCache = new WeakMap();
  classMasterCache = new WeakMap();
  preflightCache = new WeakMap();
  Object.assign(cacheStats, { lineMasterBuilds: 0, classMasterBuilds: 0, preflightHits: 0, preflightMisses: 0 });
}

export function createDefaultRegexSuggestionProfile() {
  return Object.freeze({
    schema: 'regex-suggestion-profile/v1',
    profileIdentity: 'xml-cii-regex-suggestion-default-v3-no-rating',
    operatingMode: 'AUTO_PREVIEW_SAFE',
    thresholds: Object.freeze({ safe: 0.90, review: 0.75, display: 0.50 }),
    validation: Object.freeze({ preserveManualLocks: true, rejectCoverageRegression: true, validateAllSamples: true }),
    formatPolicy: Object.freeze({ maximumFormats: 4, maximumLineKeyTokens: 3 }),
    normalization: Object.freeze({ stripLeadingSlash: true, stripBranchSuffix: true, ignoreCase: true, classSuffixPattern: '(?:M[0-9A-Z]+)$' }),
  });
}

function txt(value) { return String(value ?? '').trim(); }
function norm(value) { return txt(value).toUpperCase().replace(/[^A-Z0-9.]/g, ''); }
function cleanBranch(value) { return txt(value).replace(/^\/+/, '').replace(/\/B\d+.*$/i, ''); }
function sampleName(row) { return txt(row?.branchName || row?.lineReference); }
function activeFormat(config, index) { return config?.formats?.[index] || config || {}; }
function positions(value) { return txt(value).split(/[,+]/).map(Number).filter((n) => Number.isInteger(n) && n > 0); }

function tokenClass(token) {
  const value = txt(token);
  if (/^\d+(?:\.\d+)?\s*(?:"|IN|NPS)$/i.test(value)) return 'NPS';
  if (/^DN\s*\d+(?:\.\d+)?$/i.test(value)) return 'DN';
  if (/^\d+(?:\.\d+)?$/.test(value)) return 'DIGITS';
  if (/^[A-Z]+$/i.test(value)) return 'ALPHA';
  if (/^[A-Z]*\d+[A-Z0-9]*$/i.test(value)) return 'ALNUM';
  return 'MIXED';
}

function tokenize(samples, delimiter) {
  return samples.map((sample) => {
    const source = sampleName(sample);
    const values = cleanBranch(source).split(delimiter || '-').map(txt).filter(Boolean);
    return { sample, source, values, signature: values.map(tokenClass).join('|') };
  });
}

function clusterRows(rows) {
  const bySignature = new Map();
  for (const row of rows) {
    const list = bySignature.get(row.signature) || [];
    list.push(row);
    bySignature.set(row.signature, list);
  }
  return [...bySignature.entries()]
    .map(([signature, items], order) => ({ signature, rows: items, count: items.length, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order);
}

function cachedLineMasterEvidence(rows, fieldMap = {}) {
  if (!Array.isArray(rows)) return new Set();
  const mapKey = stableStringify(fieldMap || {});
  const cached = lineMasterCache.get(rows);
  if (cached?.key === mapKey) return cached.set;
  const set = new Set();
  for (const row of rows) {
    const value = computeLineNoKey(row || {}, fieldMap || {});
    if (txt(value)) set.add(norm(value));
  }
  lineMasterCache.set(rows, { key: mapKey, set });
  cacheStats.lineMasterBuilds += 1;
  return set;
}

function cachedClassMasterEvidence(rows, fieldMap = {}) {
  if (!Array.isArray(rows)) return { classes: new Set(), boresByClass: new Map() };
  const mapKey = stableStringify(fieldMap || {});
  const cached = classMasterCache.get(rows);
  if (cached?.key === mapKey) return cached.evidence;
  const index = buildPipingClassIndex(rows, fieldMap || {});
  const classes = new Set((index.knownClasses || []).map((value) => norm(value)).filter(Boolean));
  const boresByClass = new Map();
  for (const row of index.rows || []) {
    const rawClass = row?.pipingClass ?? row?.['Piping Class'] ?? row?.PIPING_CLASS ?? row?.Class ?? row?.SPEC ?? row?.Spec ?? '';
    const classKey = normalizePipingClass(rawClass);
    const bore = Number(row?.convertedBore ?? row?.boreMm ?? row?.DN ?? row?.dn);
    if (!classKey || !Number.isFinite(bore) || bore <= 0) continue;
    if (!boresByClass.has(classKey)) boresByClass.set(classKey, new Set());
    boresByClass.get(classKey).add(Number(bore));
  }
  const evidence = { classes, boresByClass };
  classMasterCache.set(rows, { key: mapKey, evidence });
  cacheStats.classMasterBuilds += 1;
  return evidence;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function configFingerprint(input) {
  const value = stableStringify(input);
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function evidenceDescriptor(masterContext = {}) {
  const lineRows = Array.isArray(masterContext.lineRows) ? masterContext.lineRows : [];
  const pipingClassRows = Array.isArray(masterContext.pipingClassRows) ? masterContext.pipingClassRows : [];
  const refs = masterContext.datasetRefs || {};
  const lineExpected = Math.max(0, Number(refs?.lineList?.rowCount ?? masterContext?.rowCounts?.lineList) || 0);
  const classExpected = Math.max(0, Number(refs?.pipingClass?.rowCount ?? masterContext?.rowCounts?.pipingClass) || 0);
  const mode = lineRows.length && pipingClassRows.length
    ? 'MASTER_BACKED'
    : lineRows.length || pipingClassRows.length
      ? 'PARTIAL_MASTER_EVIDENCE'
      : 'HEURISTIC_ONLY';
  return {
    mode,
    lineRowsLoaded: lineRows.length,
    pipingClassRowsLoaded: pipingClassRows.length,
    lineRowsExpected: lineExpected,
    pipingClassRowsExpected: classExpected,
    lineDatasetId: txt(refs?.lineList?.datasetId),
    pipingClassDatasetId: txt(refs?.pipingClass?.datasetId),
  };
}

function masterFieldMaps(masterContext = {}) {
  return {
    lineFieldMap: masterContext?.config?.linelist?.fieldMap || masterContext?.lineListFieldMap || masterContext?.datasetRefs?.lineList?.fieldMap || {},
    classFieldMap: masterContext?.config?.pipingClass?.fieldMap || masterContext?.pipingClassFieldMap || masterContext?.datasetRefs?.pipingClass?.fieldMap || {},
  };
}

function boreMatchesClass(boreValue, pipingClass, classEvidence) {
  const bore = Number(boreValue);
  if (!Number.isFinite(bore) || bore <= 0) return { applicable: false, matched: true };
  const classKey = normalizePipingClass(pipingClass);
  const known = classEvidence.boresByClass.get(classKey);
  if (!known?.size) return { applicable: false, matched: true };
  const matched = [...known].some((value) => Math.abs(Number(value) - bore) <= 1e-6);
  return { applicable: true, matched };
}

export function classifyRegexExtractionRows(rows = [], masterContext = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const { lineFieldMap, classFieldMap } = masterFieldMaps(masterContext);
  const lineMasters = cachedLineMasterEvidence(masterContext.lineRows || [], lineFieldMap);
  const classEvidence = cachedClassMasterEvidence(masterContext.pipingClassRows || [], classFieldMap);
  const evidence = evidenceDescriptor(masterContext);
  const hasAnyMasterEvidence = lineMasters.size > 0 || classEvidence.classes.size > 0;
  const hasCompleteMasterEvidence = lineMasters.size > 0 && classEvidence.classes.size > 0;

  return sourceRows.map((row) => {
    const lineKey = txt(row?.lineKey);
    const pipingClass = txt(row?.pipingClass);
    if (!lineKey || !pipingClass) {
      return { ...row, status: 'REJECTED', semanticValidation: { evidenceMode: evidence.mode, lineKnown: false, classKnown: false, boreApplicable: false, boreKnown: false } };
    }
    if (!hasAnyMasterEvidence) {
      return { ...row, status: 'EXTRACTED', semanticValidation: { evidenceMode: evidence.mode, lineKnown: null, classKnown: null, boreApplicable: false, boreKnown: null } };
    }

    const lineKnown = lineMasters.size ? lineMasters.has(norm(lineKey)) : null;
    const classKnown = classEvidence.classes.size ? classEvidence.classes.has(norm(pipingClass)) : null;
    const bore = boreMatchesClass(row?.bore, pipingClass, classEvidence);
    const fullyValidated = hasCompleteMasterEvidence && lineKnown === true && classKnown === true && bore.matched;
    return {
      ...row,
      status: fullyValidated ? 'MASTER_VALIDATED' : 'REVIEW_REQUIRED',
      semanticValidation: {
        evidenceMode: evidence.mode,
        lineKnown,
        classKnown,
        boreApplicable: bore.applicable,
        boreKnown: bore.applicable ? bore.matched : null,
      },
    };
  });
}

function summarize(suggestions, sampleCount, formatCount, currentResult) {
  const safeCount = suggestions.filter((item) => item.safe && !item.conflict).length;
  const reviewCount = suggestions.filter((item) => item.review || item.authorityLevel === 'HEURISTIC_ONLY').length;
  const conflictCount = suggestions.filter((item) => item.conflict).length;
  const rejected = Array.isArray(currentResult?.rejectedRows) ? currentResult.rejectedRows.length : 0;
  const matched = Array.isArray(currentResult?.matchedRows) ? currentResult.matchedRows.length : Math.max(0, sampleCount - rejected);
  const coverage = sampleCount ? matched / sampleCount : 0;
  return { sampleCount, formatCount, safeCount, reviewCount, conflictCount, rejectedCount: rejected, coverage };
}

export function buildRegexSuggestionPreflight(input = {}) {
  const profile = input.profile || createDefaultRegexSuggestionProfile();
  const config = input.extractionConfig || {};
  const samples = Array.isArray(input.branchSamples) ? input.branchSamples : [];
  const masterContext = input.masterContext || {};
  const masterEvidence = evidenceDescriptor(masterContext);
  const cacheKey = configFingerprint({
    config,
    profile,
    appliedMappingRevision: masterContext.appliedMappingRevision || null,
    rowCounts: masterContext.rowCounts || null,
    masterEvidence,
    currentCoverage: {
      matched: input.currentResult?.matchedRows?.length || 0,
      rejected: input.currentResult?.rejectedRows?.length || 0,
    },
  });
  if (samples && typeof samples === 'object') {
    const cached = preflightCache.get(samples);
    if (cached?.has(cacheKey)) {
      cacheStats.preflightHits += 1;
      return cached.get(cacheKey);
    }
  }
  cacheStats.preflightMisses += 1;
  const formatIndex = Number(config.activeFormatIndex || input.activeFormatIndex || 0);
  const format = activeFormat(config, formatIndex);
  const rows = tokenize(samples, format.tokenDelimiter || '-');
  const clusters = clusterRows(rows);
  const selected = clusters[formatIndex] || clusters[0] || { rows: [], count: 0, signature: '' };
  const { lineFieldMap, classFieldMap } = masterFieldMaps(masterContext);
  const classEvidence = cachedClassMasterEvidence(masterContext.pipingClassRows || [], classFieldMap);
  const suggestions = buildRegexRoleSuggestions({
    rows: selected.rows,
    lineMasters: cachedLineMasterEvidence(masterContext.lineRows || [], lineFieldMap),
    classMasters: classEvidence.classes,
    classBoresByClass: classEvidence.boresByClass,
    profile,
  });
  const metrics = summarize(suggestions, rows.length, clusters.length, input.currentResult);
  const blockers = [];
  if (!rows.length) blockers.push({ code: 'SOURCE_SAMPLE_SET_EMPTY', message: 'No branch samples are available.' });
  if (clusters.length > profile.formatPolicy.maximumFormats) blockers.push({ code: 'FORMAT_COUNT_EXCEEDS_PROFILE', message: `${clusters.length} formats exceed the configured maximum.` });
  const status = blockers.length
    ? 'BLOCKED'
    : metrics.conflictCount
      ? 'REVIEW_REQUIRED'
      : metrics.safeCount
        ? (metrics.reviewCount ? 'REVIEW_REQUIRED' : 'READY_TO_APPLY')
        : 'REVIEW_REQUIRED';
  const receipt = Object.freeze({
    schema: 'regex-suggestion-preflight/v1',
    status,
    formatIndex,
    selectedSignature: selected.signature,
    fingerprint: configFingerprint({ samples: rows.map((row) => row.source), config, counts: masterContext?.rowCounts, masterEvidence, profile }),
    masterEvidence: Object.freeze({ ...masterEvidence }),
    suggestions: Object.freeze(suggestions.map(Object.freeze)),
    clusters: Object.freeze(clusters.map((row) => Object.freeze({ signature: row.signature, count: row.count }))),
    metrics: Object.freeze(metrics),
    blockers: Object.freeze(blockers),
    canPreview: rows.length > 0,
    canApply: status === 'READY_TO_APPLY',
  });
  if (samples && typeof samples === 'object') {
    const bucket = preflightCache.get(samples) || new Map();
    bucket.set(cacheKey, receipt);
    if (bucket.size > 8) bucket.delete(bucket.keys().next().value);
    preflightCache.set(samples, bucket);
  }
  return receipt;
}

export function applyHighestSafeSuggestions(extractionConfig = {}, receipt, options = {}) {
  return applyRegexSuggestions(extractionConfig, receipt, {
    ...options,
    safeOnly: true,
    manualLocks: { ...(options.manualLocks || {}) },
  });
}

export function applyRegexSuggestions(extractionConfig = {}, receipt, options = {}) {
  const next = structuredCloneSafe(extractionConfig);
  const index = Number(next.activeFormatIndex || receipt?.formatIndex || 0);
  next.formats = Array.isArray(next.formats) ? next.formats : [{}, {}];
  next.formats[index] = { ...(next.formats[index] || {}) };
  const locks = options.manualLocks || {};
  for (const item of receipt?.suggestions || []) {
    if (!ROLE_ORDER.includes(item.role) || item.conflict || locks[item.role]) continue;
    if (options.safeOnly && !item.safe) continue;
    next.formats[index][item.role] = {
      ...(next.formats[index][item.role] || {}),
      tokenPosition: item.tokenPositions.join(','),
      regex: '',
      group: 1,
    };
  }
  return next;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value || {}));
}

export function currentRolePositions(config, index) {
  const format = activeFormat(config, index);
  return Object.fromEntries(ROLE_ORDER.map((role) => [role, positions(format?.[role]?.tokenPosition)]));
}
