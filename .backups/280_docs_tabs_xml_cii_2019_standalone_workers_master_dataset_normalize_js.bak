import { MASTER_FIELDS } from '../ui-adapted/xml-cii-adapted-fields-config.js';
import { fuzzyAutoMapFields } from '../ui-adapted/xml-cii-adapted-fuzzy-mapper.js';
import { detectLineListFieldMap, normalizeLineListRow } from '../../../converters/xml-cii2019-core/linelist-mapping.js';
import { refineLineListFieldMap } from '../xml-cii-linelist-header-band.js?v=20260930-issue781-linelist-integration-2';

function text(value) {
  return String(value ?? '').trim();
}

function headersFromRows(rows) {
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? Object.keys(row).filter((key) => key !== '_rowIndex') : [];
}

export function resolveMasterFieldMap(masterKey, rawRows, currentMap = {}, config = {}, fieldMapOverride = null) {
  if (fieldMapOverride && typeof fieldMapOverride === 'object' && !Array.isArray(fieldMapOverride)) {
    return { ...fieldMapOverride };
  }
  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const headers = headersFromRows(rawRows);
  const fuzzy = fuzzyAutoMapFields(headers, fields, rawRows);
  if (masterKey !== 'lineList') return fuzzy;
  const detected = detectLineListFieldMap(rawRows, currentMap || {}, config?.linelist || config || null);
  const merged = { ...fuzzy, ...detected };
  for (const field of fields) if (!(field.name in merged)) merged[field.name] = fuzzy[field.name] || '';
  return refineLineListFieldMap(rawRows, merged, config?.linelist || config || null);
}

export function normalizeMasterRows(rawRows, fieldMap, masterKey) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (masterKey === 'lineList') return rows.map((row, index) => normalizeLineListRow(row, fieldMap, index));
  return rows.map((row, index) => {
    const normalized = { ...row, _rowIndex: row?._rowIndex || index + 1 };
    for (const [fieldName, sourceHeader] of Object.entries(fieldMap || {})) {
      normalized[fieldName] = sourceHeader ? (row?.[sourceHeader] ?? '') : '';
    }
    return normalized;
  });
}

export function buildMasterSearchText(row) {
  const values = Object.entries(row || {})
    .filter(([key]) => !key.startsWith('_'))
    .map(([, value]) => text(value));
  values.push(
    `${text(row?.lineKey1)}${text(row?.lineSeqNo)}`,
    `${text(row?.lineKey1)}${text(row?.lineNoKey)}`,
    `${text(row?.lineKey1)}${text(row?.lineKey2)}`,
    text(row?.lineNoKey), text(row?.lineNo), text(row?.lineKey),
  );
  return values.join(' ').toLowerCase();
}

export function buildSearchCorpus(rows) {
  return (Array.isArray(rows) ? rows : []).map(buildMasterSearchText);
}

export function searchCorpusIndexes(searchCorpus, query) {
  const q = String(query || '').toLowerCase().trim();
  if (!q) return [];
  const matches = [];
  for (let index = 0; index < searchCorpus.length; index += 1) {
    if (searchCorpus[index].includes(q)) matches.push(index);
  }
  return matches;
}

export function prepareNormalizedDataset(masterKey, rawRows, currentMap = {}, config = {}, fieldMapOverride = null) {
  const fieldMap = resolveMasterFieldMap(masterKey, rawRows, currentMap, config, fieldMapOverride);
  const rows = normalizeMasterRows(rawRows, fieldMap, masterKey);
  return { fieldMap, rows, searchCorpus: buildSearchCorpus(rows) };
}
