import { selectRegexAnalysisBuckets } from './xml-cii-regex-analysis-buckets.js';

const DEFAULT_QUERY_LIMIT = 96;
const DEFAULT_INDEXES_PER_QUERY = 128;
const DEFAULT_TOTAL_INDEXES = 1200;

function text(value) {
  return String(value ?? '').trim();
}

function sampleName(sample) {
  return text(sample?.branchName || sample?.lineReference);
}

function cleanBranch(value) {
  return text(value).replace(/^\/+/, '').replace(/\/B\d+.*$/i, '');
}

function activeFormat(config = {}) {
  const index = Number(config?.activeFormatIndex || 0);
  return config?.formats?.[index] || config || {};
}

function tokenRows(samples = [], delimiter = '-') {
  return samples.map((sample) => ({
    sample,
    source: sampleName(sample),
    values: cleanBranch(sampleName(sample)).split(delimiter || '-').map(text).filter(Boolean),
  }));
}

function sizeSyntax(value) {
  return /^\s*(?:DN\s*)?\d+(?:\.\d+)?\s*(?:"|IN|INCH|NPS)?\s*$/i.test(text(value))
    && /(?:^DN\s*|"|\bIN(?:CH)?\b|\bNPS\b)/i.test(text(value));
}

function lineKeyProbe(value) {
  const source = text(value);
  const compact = source.replace(/[^A-Z0-9]/gi, '');
  return compact.length >= 5
    && /^[A-Z]+\d{4,}[A-Z0-9]*$/i.test(compact)
    && !sizeSyntax(source);
}

function addBounded(set, value, limitState) {
  const source = text(value);
  if (!source || set.has(source)) return;
  if (set.size >= limitState.limit) {
    limitState.overflow = true;
    return;
  }
  set.add(source);
}

function safeSuffix(pattern) {
  try { return new RegExp(pattern || '(?:M[0-9A-Z]+)$', 'i'); }
  catch { return /(?:M[0-9A-Z]+)$/i; }
}

function lineQueries(rows, maximumTokens, limitState) {
  const out = new Set();
  const widthLimit = Math.max(1, Math.min(3, Number(maximumTokens) || 3));
  for (const row of rows) {
    const atomic = row.values.filter(lineKeyProbe);
    if (atomic.length) {
      for (const value of atomic) addBounded(out, value, limitState);
      continue;
    }
    for (let start = 0; start < row.values.length; start += 1) {
      let joined = '';
      for (let width = 1; width <= widthLimit && start + width <= row.values.length; width += 1) {
        joined += row.values[start + width - 1];
        if (width >= 2 && lineKeyProbe(joined)) addBounded(out, joined, limitState);
      }
    }
  }
  return out;
}

function classQueries(rows, suffixPattern, limitState) {
  const out = new Set();
  const suffix = safeSuffix(suffixPattern);
  for (const row of rows) {
    for (const token of row.values) {
      const compact = text(token).replace(/[^A-Z0-9]/gi, '');
      if (compact.length < 3 || !/\d{3,}/.test(compact) || sizeSyntax(token)) continue;
      addBounded(out, token, limitState);
      const base = text(token).replace(suffix, '');
      if (base && base !== token) addBounded(out, base, limitState);
    }
  }
  return out;
}

export function buildRegexBoundedEvidencePlan(input = {}) {
  const config = input.extractionConfig || {};
  const format = activeFormat(config);
  const selection = selectRegexAnalysisBuckets(
    input.branchSamples || [],
    format.tokenDelimiter || '-',
    2,
  );
  const rows = tokenRows(selection.samples, format.tokenDelimiter || '-');
  const limit = Math.max(8, Number(input.queryLimit) || DEFAULT_QUERY_LIMIT);
  const lineLimit = { limit, overflow: false };
  const classLimit = { limit, overflow: false };
  const maximumTokens = input.profile?.formatPolicy?.maximumLineKeyTokens || 3;
  const suffixPattern = input.profile?.normalization?.classSuffixPattern || '(?:M[0-9A-Z]+)$';
  const lineListQueries = lineQueries(rows, maximumTokens, lineLimit);
  const pipingClassQueries = classQueries(rows, suffixPattern, classLimit);

  return Object.freeze({
    schema: 'regex-bounded-evidence-plan/v1',
    analysis: selection,
    lineListQueries: Object.freeze([...lineListQueries]),
    pipingClassQueries: Object.freeze([...pipingClassQueries]),
    queryOverflow: Object.freeze({
      lineList: lineLimit.overflow,
      pipingClass: classLimit.overflow,
    }),
  });
}

export async function resolveRegexBoundedDatasetEvidence(input = {}) {
  const masterKey = text(input.masterKey);
  const datasetRef = input.datasetRef && typeof input.datasetRef === 'object' ? input.datasetRef : {};
  const datasetId = text(datasetRef.datasetId);
  const queries = [...new Set((Array.isArray(input.queries) ? input.queries : []).map(text).filter(Boolean))];
  if (!datasetId) return Object.freeze({ masterKey, rows: Object.freeze([]), queryCount: queries.length, rowIndexCount: 0, truncatedQueryCount: 0, totalIndexOverflow: false });
  if (typeof input.search !== 'function' || typeof input.getRowsByIndexes !== 'function') {
    throw new Error('Bounded Regex evidence requires search and indexed-row providers.');
  }

  const perQuery = Math.max(1, Math.min(512, Number(input.maxIndexesPerQuery) || DEFAULT_INDEXES_PER_QUERY));
  const totalLimit = Math.max(perQuery, Math.min(2000, Number(input.maxTotalIndexes) || DEFAULT_TOTAL_INDEXES));
  const indexSet = new Set();
  let truncatedQueryCount = 0;
  let matchedQueryCount = 0;
  let totalIndexOverflow = false;

  for (const query of queries) {
    const result = await input.search(masterKey, datasetId, query);
    const indexes = Array.isArray(result?.indexes) ? result.indexes : [];
    if (indexes.length) matchedQueryCount += 1;
    if (indexes.length > perQuery) truncatedQueryCount += 1;
    for (const value of indexes.slice(0, perQuery)) {
      const index = Number(value);
      if (!Number.isInteger(index) || index < 0) continue;
      if (indexSet.size >= totalLimit) {
        totalIndexOverflow = true;
        break;
      }
      indexSet.add(index);
    }
    if (totalIndexOverflow) break;
  }

  const indexes = [...indexSet];
  const result = indexes.length
    ? await input.getRowsByIndexes(masterKey, datasetId, indexes, datasetRef)
    : { rows: [] };
  const rows = Array.isArray(result?.rows) ? result.rows : [];

  return Object.freeze({
    masterKey,
    rows: Object.freeze([...rows]),
    queryCount: queries.length,
    matchedQueryCount,
    rowIndexCount: indexes.length,
    truncatedQueryCount,
    totalIndexOverflow,
  });
}
