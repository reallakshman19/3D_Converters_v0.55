import { perfAddMs, perfCount, perfNow } from './xml-cii-adapted-perf.js';

export const MASTER_DEF_MAP = Object.freeze({
  lineList: Object.freeze({ configKey: 'linelist', rowsProperty: 'masterRows', contextRowsKey: 'lineRows' }),
  pipingClass: Object.freeze({ configKey: 'pipingClass', rowsProperty: 'masterRows', contextRowsKey: 'pipingClassRows' }),
  materialMap: Object.freeze({ configKey: 'material', rowsProperty: 'mapRows', contextRowsKey: 'materialMapRows' }),
  weight: Object.freeze({ configKey: 'weight', rowsProperty: 'masterRows', contextRowsKey: 'weightMasterRows' }),
});

const EMPTY_RAW = Object.freeze({ lineList: [], pipingClass: [], materialMap: [], weight: [] });
const COMPACT_PERSISTENCE_THRESHOLD_BYTES = 1_500_000;

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
  perfCount('masterMappingDraftChanges');
  return {
    ...runtime,
    mappingDrafts: {
      ...runtime.mappingDrafts,
      [key]: {
        fieldMap: nextMap,
        dirty: !sameMap(applied, nextMap),
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
  const nextRevision = Number(runtime.appliedMappingRevision[key] || 0) + 1;
  const drafts = { ...runtime.mappingDrafts };
  delete drafts[key];
  const next = {
    ...runtime,
    [def.contextRowsKey]: normalizedRows,
    config: nextConfig,
    rawRows: { ...runtime.rawRows, [key]: Array.isArray(rawRows) ? rawRows : [] },
    appliedMappingRevision: { ...runtime.appliedMappingRevision, [key]: nextRevision },
    mappingDrafts: drafts,
  };
  if (sourceMetadata) next.sourceMetadata = { ...(runtime.sourceMetadata || {}), [key]: sourceMetadata };
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

function serialized(value) {
  return value == null ? null : JSON.stringify(value);
}

function byteLength(value) {
  const json = serialized(value);
  if (json == null) return 0;
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).byteLength;
  return json.length * 2;
}

function quotaLike(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  return /QuotaExceededError/i.test(name) || /quota|storage.*full|setItem.*storage/i.test(message);
}

function storageSetIfChanged(key, value) {
  if (typeof localStorage === 'undefined') return { writes: 0, error: null, attempted: false };
  try {
    const next = serialized(value);
    const current = localStorage.getItem(key);
    if (next === current) return { writes: 0, error: null, attempted: true };
    if (next == null) localStorage.removeItem(key);
    else localStorage.setItem(key, next);
    return { writes: 1, error: null, attempted: true };
  } catch (error) {
    return { writes: 0, error, attempted: true };
  }
}

function persistEntry(key, value, failures) {
  const result = storageSetIfChanged(key, value);
  if (result.error) failures.push({ key, error: result.error });
  return result;
}

function persistenceFailure(entry) {
  return {
    key: entry.key,
    name: String(entry.error?.name || 'Error'),
    message: String(entry.error?.message || entry.error || 'Unknown storage error'),
  };
}

export function persistChangedMasterDetailed(key, context) {
  if (typeof localStorage === 'undefined') {
    return { writes: 0, failures: [], compact: false, quotaLimited: false, normalizedPersisted: false };
  }
  const t0 = perfNow();
  const def = MASTER_DEF_MAP[key];
  if (!def) return { writes: 0, failures: [], compact: false, quotaLimited: false, normalizedPersisted: false };
  const normalized = context?.[def.contextRowsKey] || [];
  const rawRows = context?.rawRows?.[key] || [];
  const workbook = context?.workbookData?.[key] || {};
  const meta = context?.sourceMetadata?.[key] || {};
  const duplicateBytes = byteLength(normalized) + byteLength(rawRows) + byteLength(workbook);
  const compact = duplicateBytes >= COMPACT_PERSISTENCE_THRESHOLD_BYTES;
  const sourceCustody = {
    source: meta.source || null,
    fieldMap: { ...(context?.config?.[def.configKey]?.fieldMap || {}) },
    appliedRevision: Number(context?.appliedMappingRevision?.[key] || 0),
  };
  if (compact) {
    sourceCustody.rowCount = normalized.length;
    sourceCustody.persistenceMode = 'compact';
  }
  const failures = [];
  let writes = 0;

  if (compact) {
    writes += persistEntry(`xml-cii-master-raw-${key}`, null, failures).writes;
    writes += persistEntry(`xml-cii-master-workbook-${key}`, null, failures).writes;
  }
  const normalizedResult = persistEntry(`xml-cii-master-${key}`, normalized, failures);
  writes += normalizedResult.writes;
  if (!compact) writes += persistEntry(`xml-cii-master-raw-${key}`, rawRows, failures).writes;
  writes += persistEntry(`xml-cii-master-source-${key}`, sourceCustody, failures).writes;
  writes += persistEntry(`xml-cii-master-sheetnames-${key}`, context?.sheetNames?.[key] || [], failures).writes;
  writes += persistEntry(`xml-cii-master-activesheet-${key}`, context?.activeSheet?.[key] || '', failures).writes;
  if (!compact) writes += persistEntry(`xml-cii-master-workbook-${key}`, workbook, failures).writes;

  const quotaLimited = failures.some((entry) => quotaLike(entry.error));
  if (failures.length && typeof console !== 'undefined') {
    console.warn(`[xml-cii] ${key} master remains loaded in memory; browser persistence is limited.`, {
      compact,
      quotaLimited,
      failures: failures.map(persistenceFailure),
    });
  }
  perfCount('masterPersistCommitCount');
  perfCount('masterStorageWriteCount', writes);
  if (failures.length) perfCount('masterStorageWriteFailureCount', failures.length);
  if (compact) perfCount('masterCompactPersistenceCount');
  perfAddMs('masterPersistMs', perfNow() - t0);
  return {
    writes,
    failures: failures.map(persistenceFailure),
    compact,
    quotaLimited,
    normalizedPersisted: !normalizedResult.error,
    estimatedDuplicateBytes: duplicateBytes,
  };
}

export function persistChangedMaster(key, context) {
  return persistChangedMasterDetailed(key, context).writes;
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
  ]) {
    try { localStorage.removeItem(suffix); } catch {}
  }
}
