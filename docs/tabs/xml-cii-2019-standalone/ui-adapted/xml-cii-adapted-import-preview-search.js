import { normalizeLineListRow } from '../../../converters/xml-cii2019-core/linelist-mapping.js';
import { MASTER_FIELDS } from './xml-cii-adapted-fields-config.js';

const PREVIEW_SEARCH_PREPARATION = new WeakMap();

function text(value, fallback = '') {
  const out = String(value ?? '').trim();
  return out || fallback;
}

function resolvedSupportConfig(state) {
  const committed = state?.masterContext?.config;
  if (committed && typeof committed === 'object' && !Array.isArray(committed)) return committed;
  try {
    return JSON.parse(state?.supportConfigJson || '{}') || {};
  } catch {
    return {};
  }
}

function mappedFieldMap(masterKey, state) {
  const config = resolvedSupportConfig(state);
  const configKey = MASTER_FIELDS[masterKey]?.configKey;
  return config?.[configKey]?.fieldMap || {};
}

function readMappedValue(row, keys) {
  for (const key of keys) {
    const value = key ? row?.[key] : '';
    if (text(value)) return text(value);
  }
  return '';
}

function normalizePreviewSearchRow(row, masterKey, fieldMap, index) {
  if (masterKey !== 'lineList') return row;
  const normalized = row?.lineNoKey || row?.lineNo || row?.lineKey || row?.lineSeqNo
    ? row : normalizeLineListRow(row, fieldMap, index);
  const raw = normalized?._raw || row;
  return {
    ...normalized,
    lineKey1: text(normalized?.lineKey1) || readMappedValue(raw, [fieldMap.lineKey1, 'lineKey1', 'Service', 'SERVICE']),
    lineKey2: text(normalized?.lineKey2) || readMappedValue(raw, [fieldMap.lineKey2, 'lineKey2', 'Line number', 'Line Number']),
    lineSeqNo: text(normalized?.lineSeqNo) || readMappedValue(raw, [fieldMap.lineSeqNo, 'lineSeqNo', 'Line number', 'Line Number']),
  };
}

function arrayIndex(property) {
  if (typeof property !== 'string' || !/^(?:0|[1-9]\d*)$/.test(property)) return null;
  const index = Number(property);
  return Number.isSafeInteger(index) ? index : null;
}

export function createLazyPreviewSearchRows(sourceRows, masterKey, fieldMap = {}) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  if (masterKey !== 'lineList' || !rows.length) return rows;

  const cache = new Map();
  const stats = { lazy: true, sourceRows: rows.length, normalizedRows: 0 };
  const view = new Proxy(rows, {
    get(target, property, receiver) {
      const index = arrayIndex(property);
      if (index !== null && index < target.length) {
        if (!cache.has(index)) {
          cache.set(index, normalizePreviewSearchRow(target[index], masterKey, fieldMap, index));
          stats.normalizedRows += 1;
        }
        return cache.get(index);
      }
      return Reflect.get(target, property, receiver);
    },
  });
  PREVIEW_SEARCH_PREPARATION.set(view, stats);
  return view;
}

export function previewSearchPreparationStats(rows) {
  const stats = PREVIEW_SEARCH_PREPARATION.get(rows);
  return stats ? { ...stats } : {
    lazy: false,
    sourceRows: Array.isArray(rows) ? rows.length : 0,
    normalizedRows: 0,
  };
}

export function buildPreviewSearchRows(master, state) {
  const rows = Array.isArray(master?.rows) ? master.rows : [];
  const rawRows = Array.isArray(state?.masterContext?.rawRows?.[master?.key])
    ? state.masterContext.rawRows[master.key] : [];
  const sourceRows = rows.length ? rows : rawRows;
  if (master?.key !== 'lineList' || !sourceRows.length) return sourceRows;
  return createLazyPreviewSearchRows(sourceRows, master.key, mappedFieldMap(master.key, state));
}

export function previewSearchText(row) {
  const values = Object.entries(row || {})
    .filter(([key]) => !key.startsWith('_'))
    .map(([, value]) => text(value));
  const composites = [
    `${text(row?.lineKey1)}${text(row?.lineSeqNo)}`,
    `${text(row?.lineKey1)}${text(row?.lineNoKey)}`,
    `${text(row?.lineKey1)}${text(row?.lineKey2)}`,
    text(row?.lineNoKey),
    text(row?.lineNo),
    text(row?.lineKey),
  ];
  return [...values, ...composites].join(' ').toLowerCase();
}
