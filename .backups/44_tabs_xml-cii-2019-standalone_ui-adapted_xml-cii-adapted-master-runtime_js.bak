import { perfAddMs, perfCount, perfNow } from './xml-cii-adapted-perf.js';

export const MASTER_DEF_MAP = Object.freeze({
  lineList: Object.freeze({ configKey: 'linelist', rowsProperty: 'masterRows', contextRowsKey: 'lineRows' }),
  pipingClass: Object.freeze({ configKey: 'pipingClass', rowsProperty: 'masterRows', contextRowsKey: 'pipingClassRows' }),
  materialMap: Object.freeze({ configKey: 'material', rowsProperty: 'mapRows', contextRowsKey: 'materialMapRows' }),
  weight: Object.freeze({ configKey: 'weight', rowsProperty: 'masterRows', contextRowsKey: 'weightMasterRows' }),
});

const EMPTY_RAW = Object.freeze({ lineList: [], pipingClass: [], materialMap: [], weight: [] });

export function readSupportConfigOnce(state) {
  perfCount('configParseCount');
  try { return JSON.parse(state?.supportConfigJson || '{}') || {}; } catch { return {}; }
}

export function ensureMasterRuntime(context = {}) {
  const applied = { ...(context.appliedMappingRevision || {}) };
  const drafts = { ...(context.mappingDrafts || {}) };
  for (const [key, def] of Object.entries(MASTER_DEF_MAP)) {
    if (!Number.isInteger(applied[key]) || applied[key] < 0) {
      const committedRows = context?.[def.contextRowsKey];
      applied[key] = Array.isArray(committedRows) && committedRows.length ? 1 : 0;
    }
  }
  return {
    ...context,
    rawRows: { ...EMPTY_RAW, ...(context.rawRows || {}) },
    appliedMappingRevision: applied,
    mappingDrafts: drafts,
  };
}

export function appliedFieldMap(context, config, key) {
  const def = MASTER_DEF_MAP[key];
  if (!def) return {};
  return { ...(config?.[def.configKey]?.fieldMap || context?.config?.[def.configKey]?.fieldMap || {}) };
}

export function effectiveDraftFieldMap(context, config, key) {
  const draft = context?.mappingDrafts?.[key];
  return draft?.fieldMap ? { ...draft.fieldMap } : appliedFieldMap(context, config, key);
}

function sameMap(a, b) {
  const ak = Object.keys(a || {}).sort();
  const bk = Object.keys(b || {}).sort();
  if (ak.length !== bk.length) return false;
  return ak.every((key, index) => key === bk[index] && String(a?.[key] ?? '') === String(b?.[key] ?? ''));
}

export function stageMasterMappingDraft(context, config, key, fieldMap) {
  const runtime = ensureMasterRuntime(context);
  const applied = appliedFieldMap(runtime, config, key);
  const nextMap = { ...(fieldMap || {}) };
  const dirty = !sameMap(applied, nextMap);
  perfCount('masterMappingDraftChanges');
  return {
    ...runtime,
    mappingDrafts: {
      ...runtime.mappingDrafts,
      [key]: {
        fieldMap: nextMap,
        dirty,
        basisAppliedRevision: runtime.appliedMappingRevision[key],
      },
    },
  };
}

export function discardMasterMappingDraft(context, key) {
  const runtime = ensureMasterRuntime(context);
  const drafts = { ...runtime.mappingDrafts };
  delete drafts[key];
  return { ...runtime, mappingDrafts: drafts };
}

export function masterMappingStatus(context, config, key) {
  const runtime = ensureMasterRuntime(context);
  const draft = runtime.mappingDrafts?.[key];
  const revision = runtime.appliedMappingRevision[key];
  return {
    revision,
    dirty: !!draft?.dirty,
    basisAppliedRevision: draft?.basisAppliedRevision ?? revision,
    fieldMap: effectiveDraftFieldMap(runtime, config, key),
  };
}

export function commitAppliedMaster({ context, config, key, fieldMap, rawRows, normalizedRows, sourceMetadata = null }) {
  const def = MASTER_DEF_MAP[key];
  if (!def) throw new Error(`Unknown master key: ${key}`);
  const runtime = ensureMasterRuntime(context);
  const nextConfig = { ...(config || runtime.config || {}) };
  nextConfig[def.configKey] = {
    ...(nextConfig[def.configKey] || {}),
    fieldMap: { ...(fieldMap || {}) },
    [def.rowsProperty]: normalizedRows,
  };
  const nextRows = { [def.contextRowsKey]: normalizedRows };
  const nextRevision = Number(runtime.appliedMappingRevision[key] || 0) + 1;
  const drafts = { ...runtime.mappingDrafts };
  delete drafts[key];
  const next = {
    ...runtime,
    ...nextRows,
    config: nextConfig,
    rawRows: { ...runtime.rawRows, [key]: Array.isArray(rawRows) ? rawRows : [] },
    appliedMappingRevision: { ...runtime.appliedMappingRevision, [key]: nextRevision },
    mappingDrafts: drafts,
  };
  if (sourceMetadata) {
    next.sourceMetadata = { ...(runtime.sourceMetadata || {}), [key]: sourceMetadata };
  }
  next.rowCounts = {
    lineList: (next.lineRows || []).length,
    pipingClass: (next.pipingClassRows || []).length,
    materialMap: (next.materialMapRows || []).length,
    weight: (next.weightMasterRows || []).length,
  };
  next.previewRows = {
    lineList: (next.lineRows || []).slice(0, 150),
    pipingClass: (next.pipingClassRows || []).slice(0, 150),
    materialMap: (next.materialMapRows || []).slice(0, 150),
    weight: (next.weightMasterRows || []).slice(0, 150),
  };
  return { context: next, config: nextConfig, revision: nextRevision };
}

function storageSetIfChanged(key, value) {
  if (typeof localStorage === 'undefined') return 0;
  const next = value == null ? null : JSON.stringify(value);
  const current = localStorage.getItem(key);
  if (next === current) return 0;
  if (next == null) localStorage.removeItem(key);
  else localStorage.setItem(key, next);
  return 1;
}

export function persistChangedMaster(key, context) {
  if (typeof localStorage === 'undefined') return 0;
  const t0 = perfNow();
  const def = MASTER_DEF_MAP[key];
  if (!def) return 0;
  const normalized = context?.[def.contextRowsKey] || [];
  const rawRows = context?.rawRows?.[key] || [];
  const meta = context?.sourceMetadata?.[key] || {};
  const sourceCustody = {
    source: meta.source || null,
    fieldMap: { ...(context?.config?.[def.configKey]?.fieldMap || {}) },
    appliedRevision: Number(context?.appliedMappingRevision?.[key] || 0),
  };
  let writes = 0;
  // Backward-compatible Batch-A custody: only the changed master's authoritative
  // rows and compact source/mapping metadata are touched. Cheap derived indexes
  // are never persisted.
  writes += storageSetIfChanged(`xml-cii-master-${key}`, normalized);
  writes += storageSetIfChanged(`xml-cii-master-raw-${key}`, rawRows);
  writes += storageSetIfChanged(`xml-cii-master-source-${key}`, sourceCustody);
  writes += storageSetIfChanged(`xml-cii-master-sheetnames-${key}`, context?.sheetNames?.[key] || []);
  writes += storageSetIfChanged(`xml-cii-master-activesheet-${key}`, context?.activeSheet?.[key] || '');
  writes += storageSetIfChanged(`xml-cii-master-workbook-${key}`, context?.workbookData?.[key] || {});
  perfCount('masterPersistCommitCount');
  perfCount('masterStorageWriteCount', writes);
  perfAddMs('masterPersistMs', perfNow() - t0);
  return writes;
}

export function clearPersistedMaster(key) {
  if (typeof localStorage === 'undefined') return;
  for (const suffix of [
    `xml-cii-master-${key}`,
    `xml-cii-master-raw-${key}`,
    `xml-cii-master-source-${key}`,
    `xml-cii-master-sheetnames-${key}`,
    `xml-cii-master-activesheet-${key}`,
    `xml-cii-master-workbook-${key}`,
  ]) localStorage.removeItem(suffix);
}