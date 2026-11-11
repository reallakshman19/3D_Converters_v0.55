import { deriveLineKeyFromBranchName } from '../../../converters/xml-cii2019-core/regex-line-key.js';
import {
  buildXmlCiiServiceProcessFallback,
  deriveXmlCiiServiceFromBranchName,
} from '../../../converters/xml-cii2019-core/service-process-fallback.js';
import {
  _isLikelyMaterialToken,
  _lineListRowKey,
  _looksLikeNpsToken,
  _rowText,
  _xmlCiiLineKeyRegexValue,
  _xmlCiiNormalizeLineKey,
} from './xml-cii-adapted-preview-dryrun-core.js?v=20261001-weight-output-2';
import {
  bigrams,
  digitRuns,
  lineKeyAliases,
  selectPreviewLineLookupCandidates,
  sparseRowsByOriginalIndex,
} from './xml-cii-adapted-preview-line-index-core.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function localName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function childText(parent, name) {
  for (const child of [...(parent?.childNodes || [])]) {
    if (child?.nodeType === 1 && localName(child) === name) return text(child.textContent);
  }
  return '';
}

function isolateLineKeyToken(branchName, config) {
  const delimiter = config?.rating?.tokenDelimiter || config?.linelist?.tokenDelimiter || '-';
  const cleaned = text(branchName).replace(/^\/+/, '').replace(/\/B\d+$/i, '');
  const candidates = cleaned
    .split(delimiter)
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !_looksLikeNpsToken(token)
      && !_isLikelyMaterialToken(token)
      && /\d{4,}/.test(token));
  candidates.sort((left, right) => right.length - left.length);
  return candidates[0] || '';
}

function lineMetadata(rows, config) {
  const columnRegex = config?.linelist?.linelistColumnRegex || '';
  const columnGroup = config?.linelist?.linelistColumnGroup || 1;
  return rows.map((row, index) => {
    if (!row) return null;
    const rowKey = _lineListRowKey(row, config);
    const rowSeq = _rowText(row, [
      config?.linelist?.fieldMap?.lineSeqNo,
      'lineSeqNo', 'Line number', 'Line Number', 'Line No',
    ].filter(Boolean));
    const cleanKey = _xmlCiiNormalizeLineKey(
      _xmlCiiLineKeyRegexValue(rowKey, columnRegex, columnGroup),
    );
    return {
      index,
      row,
      rowKey,
      rowSeq,
      cleanKey,
      aliases: lineKeyAliases(cleanKey),
      rowDigits: digitRuns(`${rowSeq} ${rowKey}`),
      rowKeyBigrams: bigrams(rowKey),
      rowSeqBigrams: bigrams(rowSeq),
    };
  }).filter(Boolean);
}

function branchMetadata(sourceDocument, config) {
  return [...(sourceDocument?.getElementsByTagName?.('Branch') || [])].map((branch) => {
    const branchName = childText(branch, 'Branchname');
    const lineKey = deriveLineKeyFromBranchName(branchName, config);
    return {
      branchName,
      lineKey,
      isolatedKey: isolateLineKeyToken(branchName, config),
    };
  });
}

function serviceRowsForUnmatchedBranch(branchName, config, cache) {
  const service = deriveXmlCiiServiceFromBranchName(branchName, config);
  if (!service) return [];
  if (cache.has(service)) return cache.get(service);
  const fallback = buildXmlCiiServiceProcessFallback({
    branchName,
    lineRow: { service },
    requestedPipingClass: '',
    config,
    fields: [],
  });
  const rows = (fallback?.rows || []).map((row) => row?._raw || row).filter(Boolean);
  cache.set(service, rows);
  return rows;
}

export function preparePreviewLineListCoreConfig(sourceDocument, config = {}) {
  const rows = Array.isArray(config?.linelist?.masterRows) ? config.linelist.masterRows : [];
  if (!sourceDocument || !rows.length) {
    return { config, indexed: false, sourceRows: rows.length, lookupRows: rows.length };
  }
  const branches = branchMetadata(sourceDocument, config);
  if (!branches.length) {
    return { config, indexed: false, sourceRows: rows.length, lookupRows: rows.length };
  }

  const entries = lineMetadata(rows, config);
  const selection = selectPreviewLineLookupCandidates(entries, branches);
  const selected = new Set(selection.selectedIndices);
  const indexByRow = new Map();
  rows.forEach((row, index) => { if (row) indexByRow.set(row, index); });
  const serviceRowsCache = new Map();
  for (const decision of selection.decisions) {
    if (decision.finalMatchIndex !== null) continue;
    for (const row of serviceRowsForUnmatchedBranch(decision.branchName, config, serviceRowsCache)) {
      const index = indexByRow.get(row);
      if (index !== undefined) selected.add(index);
    }
  }

  const selectedIndices = [...selected].sort((left, right) => left - right);
  const lookupRows = sparseRowsByOriginalIndex(rows, selectedIndices);
  const coreConfig = {
    ...config,
    linelist: {
      ...(config.linelist || {}),
      masterRows: lookupRows,
    },
  };
  return {
    config: coreConfig,
    indexed: true,
    sourceRows: rows.length,
    lookupRows: selectedIndices.length,
    selectedIndices,
    decisions: selection.decisions,
  };
}
