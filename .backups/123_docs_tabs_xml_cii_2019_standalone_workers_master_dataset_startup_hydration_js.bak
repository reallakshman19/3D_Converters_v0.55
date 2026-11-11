import { buildPipingClassIndex } from '../../../converters/xml-cii2019-core/piping-class-resolver.js';
import { createIndexedDbDatasetStore } from './master-dataset-store.js';

const MASTER_DEFS = Object.freeze({
  lineList: Object.freeze({ rowsKey: 'lineRows', configKey: 'linelist', rowsProperty: 'masterRows' }),
  pipingClass: Object.freeze({ rowsKey: 'pipingClassRows', configKey: 'pipingClass', rowsProperty: 'masterRows' }),
  materialMap: Object.freeze({ rowsKey: 'materialMapRows', configKey: 'material', rowsProperty: 'mapRows' }),
  weight: Object.freeze({ rowsKey: 'weightMasterRows', configKey: 'weight', rowsProperty: 'masterRows' }),
});

function storedJson(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function supportConfigFrom(state) {
  try {
    const parsed = JSON.parse(state?.supportConfigJson || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function datasetCustody(masterKey) {
  const custody = storedJson(`xml-cii-master-source-${masterKey}`);
  if (!custody || custody.persistenceMode !== 'indexeddb' || !custody.datasetId) return null;
  return {
    datasetId: String(custody.datasetId),
    rowCount: Number(custody.rowCount || 0),
    source: String(custody.source || ''),
    fieldMap: custody.fieldMap && typeof custody.fieldMap === 'object' ? { ...custody.fieldMap } : {},
    appliedRevision: Number(custody.appliedRevision || 0),
  };
}

function compactConfigSection(config, def, fieldMap) {
  const next = { ...(config || {}) };
  const section = { ...(next[def.configKey] || {}), fieldMap: { ...(fieldMap || {}) } };
  delete section[def.rowsProperty];
  next[def.configKey] = section;
  return next;
}

async function loadDataset(store, masterKey, custody) {
  const metadata = await store.getMetadata(custody.datasetId);
  const rows = await store.getRows(custody.datasetId);
  if (!metadata || !Array.isArray(rows)) throw new Error(`Persisted ${masterKey} dataset is unavailable.`);
  if (Number(custody.rowCount) !== rows.length) {
    throw new Error(`Persisted ${masterKey} row count mismatch: expected ${custody.rowCount}, received ${rows.length}.`);
  }
  return { masterKey, custody, metadata, rows };
}

function applyLoadedDatasets(state, loaded) {
  const persistedConfig = supportConfigFrom(state);
  const base = state.masterContext || { config: persistedConfig };
  let config = { ...persistedConfig, ...(base.config || {}) };
  const context = {
    ...base,
    rawRows: { ...(base.rawRows || {}) },
    datasetRefs: { ...(base.datasetRefs || {}) },
    rowCounts: { ...(base.rowCounts || {}) },
    previewRows: { ...(base.previewRows || {}) },
    sourceMetadata: { ...(base.sourceMetadata || {}) },
    appliedMappingRevision: { ...(base.appliedMappingRevision || {}) },
  };
  for (const item of loaded) {
    const def = MASTER_DEFS[item.masterKey];
    context[def.rowsKey] = item.rows;
    context.rawRows[item.masterKey] = [];
    context.datasetRefs[item.masterKey] = Object.freeze({
      datasetId: item.custody.datasetId,
      rowCount: item.rows.length,
      masterKey: item.masterKey,
      fileName: item.metadata.fileName || item.custody.source,
      sheetName: item.metadata.sheetName || '',
      fieldMap: { ...item.custody.fieldMap },
      persistence: 'indexeddb',
    });
    context.rowCounts[item.masterKey] = item.rows.length;
    context.previewRows[item.masterKey] = item.rows.slice(0, 150);
    context.sourceMetadata[item.masterKey] = {
      key: item.masterKey,
      source: item.custody.source || item.metadata.fileName || 'IndexedDB',
      sourceType: 'indexeddb',
      status: 'loaded',
      rowCount: item.rows.length,
    };
    context.appliedMappingRevision[item.masterKey] = item.custody.appliedRevision;
    config = compactConfigSection(config, def, item.custody.fieldMap);
  }
  context.config = config;
  if (loaded.some((item) => item.masterKey === 'pipingClass')) {
    context.pipingClassIndex = buildPipingClassIndex(context.pipingClassRows || [], config.pipingClass || {});
  }
  return {
    ...state,
    masterContext: context,
    supportConfigJson: JSON.stringify(config, null, 2),
    importMastersWriteBackStatus: `Restored ${loaded.length} large master dataset${loaded.length === 1 ? '' : 's'} from IndexedDB.`,
  };
}

export async function hydratePersistedMasterDatasets(stateRef, options = {}) {
  if (!stateRef?.current) return false;
  const entries = Object.keys(MASTER_DEFS)
    .map((masterKey) => [masterKey, datasetCustody(masterKey)])
    .filter(([, custody]) => custody);
  if (!entries.length) return false;
  const store = options.store || createIndexedDbDatasetStore(options);
  const loaded = await Promise.all(entries.map(([masterKey, custody]) => loadDataset(store, masterKey, custody)));
  stateRef.current = applyLoadedDatasets(stateRef.current, loaded);
  return true;
}
