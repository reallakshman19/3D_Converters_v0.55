import { perfAddMs, perfCount, perfNow } from './xml-cii-adapted-perf.js';
import { xmlCiiWeightMasterRowsFingerprint } from '../../../converters/xml-cii2019-core/rigid-weight-authority.js';

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
    mappingRows: { ...(context.mappingRows || {}) },
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

function committedConfig(config, def, fieldMap, normalizedRows, datasetRef) {
  const next = { ...(config || {}) };
  const section = { ...(next[def.configKey] || {}), fieldMap: { ...(fieldMap || {}) } };
  if (datasetRef) delete section[def.rowsProperty];
  else section[def.rowsProperty] = normalizedRows;
  next[def.configKey] = section;
  if (datasetRef && Array.isArray(next?.[def.configKey]?.[def.rowsProperty])) {
    throw new Error(`Dataset-backed ${def.configKey} config cannot contain ${def.rowsProperty}.`);
  }
  return next;
}

function datasetDescriptor(metadata, fieldMap, rows = [], key = '') {
  if (!metadata?.datasetId) return null;
  const persistence = String(metadata.persistenceMode || '').toLowerCase() === 'session'
    ? 'session'
    : 'indexeddb';
  return Object.freeze({
    datasetId: String(metadata.datasetId),
    rowCount: Number(metadata.rowCount || 0),
    masterKey: String(metadata.masterKey || ''),
    fileName: String(metadata.fileName || ''),
    sheetName: String(metadata.sheetName || ''),
    fieldMap: { ...(fieldMap || metadata.fieldMap || {}) },
    ...((key === 'pipingClass' || key === 'materialMap' || key === 'weight') && Number(metadata.datasetRevision) > 0 ? {
      datasetRevision: Number(metadata.datasetRevision),
    } : {}),
    ...(key === 'weight' ? {
      masterFingerprint: String(metadata.masterFingerprint || xmlCiiWeightMasterRowsFingerprint(rows)),
    } : {}),
    persistence,
  });
}

export function compactDatasetBackedConfig(config, context = {}) {
  const next = { ...(config || {}) };
  for (const [key, def] of Object.entries(MASTER_DEF_MAP)) {
    const datasetRef = context?.datasetRefs?.[key];
    if (!datasetRef?.datasetId) continue;
    const section = { ...(next[def.configKey] || {}) };
    delete section[def.rowsProperty];
    if (!section.fieldMap && datasetRef.fieldMap) section.fieldMap = { ...datasetRef.fieldMap };
    if (key === 'weight') {
      const revision = Number(context?.appliedMappingRevision?.weight ?? section.masterRevision ?? 0);
      const fingerprint = String(datasetRef.masterFingerprint || section.masterFingerprint || '');
      if (Number.isFinite(revision) && revision > 0) section.masterRevision = revision;
      if (fingerprint) section.masterFingerprint = fingerprint;
    }
    next[def.configKey] = section;
  }
  return next;
}

function rowCountFor(next, key, def) {
  const datasetCount = Number(next.datasetRefs?.[key]?.rowCount);
  return Number.isFinite(datasetCount) && datasetCount >= 0 ? datasetCount : (next?.[def.contextRowsKey] || []).length;
}

export function commitAppliedMaster({ context, config, key, fieldMap, rawRows, normalizedRows, sourceMetadata = null, datasetMetadata = null, previewRows = null }) {
  const def = MASTER_DEF_MAP[key];
  if (!def) throw new Error(`Unknown master key: ${key}`);
  const runtime = ensureMasterRuntime(context);
  const rows = Array.isArray(normalizedRows) ? normalizedRows : [];
  const datasetRef = datasetDescriptor(datasetMetadata, fieldMap, rows, key);
  const nextConfig = committedConfig(config || runtime.config || {}, def, fieldMap, rows, datasetRef);
  const nextRevision = Number(runtime.appliedMappingRevision[key] || 0) + 1;
  if (datasetRef && key === 'weight') {
    nextConfig.weight = {
      ...(nextConfig.weight || {}),
      masterRevision: nextRevision,
      masterFingerprint: datasetRef.masterFingerprint,
    };
    delete nextConfig.weight.masterRows;
  }
  const drafts = { ...runtime.mappingDrafts };
  delete drafts[key];
  const next = {
    ...runtime,
    [def.contextRowsKey]: rows,
    config: nextConfig,
    rawRows: { ...runtime.rawRows, [key]: Array.isArray(rawRows) ? rawRows : [] },
    mappingRows: { ...runtime.mappingRows, [key]: Array.isArray(rawRows) ? rawRows.slice(0, 150) : [] },
    datasetRefs: { ...(runtime.datasetRefs || {}), ...(datasetRef ? { [key]: datasetRef } : {}) },
    appliedMappingRevision: { ...runtime.appliedMappingRevision, [key]: nextRevision },
    mappingDrafts: drafts,
  };
  if (sourceMetadata) next.sourceMetadata = { ...(runtime.sourceMetadata || {}), [key]: sourceMetadata };
  next.rowCounts = Object.fromEntries(Object.entries(MASTER_DEF_MAP).map(([masterKey, masterDef]) => [masterKey, rowCountFor(next, masterKey, masterDef)]));
  next.previewRows = { ...(runtime.previewRows || {}), [key]: Array.isArray(previewRows) ? previewRows.slice(0, 150) : rows.slice(0, 150) };
  return { context: next, config: nextConfig, revision: nextRevision, datasetRef };
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
  const datasetRef = context?.datasetRefs?.[key] || null;
  const durableDatasetRef = datasetRef?.datasetId && datasetRef.persistence === 'indexeddb'
    ? datasetRef
    : null;
  const duplicateBytes = datasetRef ? 0 : byteLength(normalized) + byteLength(rawRows) + byteLength(workbook);
  const compact = !!datasetRef || duplicateBytes >= COMPACT_PERSISTENCE_THRESHOLD_BYTES;
  const sourceCustody = {
    source: meta.source || null,
    fieldMap: { ...(context?.config?.[def.configKey]?.fieldMap || {}) },
    appliedRevision: Number(context?.appliedMappingRevision?.[key] || 0),
    ...(datasetRef ? {
      rowCount: datasetRef.rowCount,
      ...((key === 'pipingClass' || key === 'materialMap' || key === 'weight') && Number(datasetRef.datasetRevision) > 0 ? {
        datasetRevision: Number(datasetRef.datasetRevision),
      } : {}),
      persistenceMode: durableDatasetRef ? 'indexeddb' : 'session',
      ...(durableDatasetRef ? { datasetId: durableDatasetRef.datasetId } : {}),
      ...(datasetRef.masterFingerprint ? { masterFingerprint: datasetRef.masterFingerprint } : {}),
    } : {}),
  };
  if (compact && !datasetRef) {
    sourceCustody.rowCount = normalized.length;
    sourceCustody.persistenceMode = 'compact';
  }
  const failures = [];
  let writes = 0;

  if (compact) {
    writes += persistEntry(`xml-cii-master-raw-${key}`, null, failures).writes;
    writes += persistEntry(`xml-cii-master-workbook-${key}`, null, failures).writes;
  }
  const normalizedResult = datasetRef
    ? persistEntry(`xml-cii-master-${key}`, null, failures)
    : persistEntry(`xml-cii-master-${key}`, normalized, failures);
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
    normalizedPersisted: durableDatasetRef ? true : (datasetRef ? false : !normalizedResult.error),
    indexedDbBacked: !!durableDatasetRef,
    sessionOnly: !!datasetRef && !durableDatasetRef,
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
