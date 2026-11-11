import { xmlCiiWeightMasterRowsFingerprint } from '../../../converters/xml-cii2019-core/rigid-weight-authority.js';
import { createIndexedDbDatasetStore } from './master-dataset-store.js';

const MASTER_DEFS = Object.freeze({
  lineList: Object.freeze({ rowsKey: 'lineRows', configKey: 'linelist', rowsProperty: 'masterRows' }),
  pipingClass: Object.freeze({ rowsKey: 'pipingClassRows', configKey: 'pipingClass', rowsProperty: 'masterRows' }),
  materialMap: Object.freeze({ rowsKey: 'materialMapRows', configKey: 'material', rowsProperty: 'mapRows' }),
  weight: Object.freeze({ rowsKey: 'weightMasterRows', configKey: 'weight', rowsProperty: 'masterRows' }),
});

const STARTUP_PREVIEW_ROWS = 150;

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
    ...((masterKey === 'pipingClass' || masterKey === 'materialMap' || masterKey === 'weight') && Number(custody.datasetRevision) > 0 ? {
      datasetRevision: Number(custody.datasetRevision),
    } : {}),
    masterFingerprint: String(custody.masterFingerprint || ''),
  };
}

function compactConfigSection(config, def, fieldMap) {
  const next = { ...(config || {}) };
  const section = { ...(next[def.configKey] || {}), fieldMap: { ...(fieldMap || {}) } };
  delete section[def.rowsProperty];
  next[def.configKey] = section;
  return next;
}

function classifiedRestoreError(code, restoreStage, message, cause = null) {
  const error = new Error(message);
  error.restoreDomain = 'restore-storage';
  error.restoreCode = code;
  error.restoreStage = restoreStage;
  if (cause) error.cause = cause;
  return error;
}

async function readRestoreValue(reader, masterKey, restoreStage) {
  try {
    return await reader();
  } catch (cause) {
    throw classifiedRestoreError(
      'STORAGE_READ_FAILED',
      restoreStage,
      `Persisted ${masterKey} storage read failed during ${restoreStage}: ${cause?.message || String(cause)}`,
      cause,
    );
  }
}

async function loadDataset(store, masterKey, custody) {
  const metadata = await readRestoreValue(
    () => store.getMetadata(custody.datasetId),
    masterKey,
    'metadata-read',
  );
  if (!metadata) {
    throw classifiedRestoreError(
      'MISSING_DATASET',
      'metadata-validate',
      `Persisted ${masterKey} dataset is unavailable.`,
    );
  }
  const metadataCount = metadata.rowCount == null ? Number(custody.rowCount || 0) : Number(metadata.rowCount || 0);
  if (metadataCount !== Number(custody.rowCount || 0)) {
    throw classifiedRestoreError(
      'ROW_COUNT_MISMATCH',
      'metadata-validate',
      `Persisted ${masterKey} row count mismatch: expected ${custody.rowCount}, received ${metadataCount}.`,
    );
  }
  if (masterKey === 'pipingClass' || masterKey === 'materialMap' || masterKey === 'weight') {
    const custodyRevision = Number(custody.datasetRevision || 0);
    const metadataRevision = Number(metadata.datasetRevision || 0);
    if (custodyRevision > 0 && metadataRevision > 0 && custodyRevision !== metadataRevision) {
      throw classifiedRestoreError(
        'REVISION_MISMATCH',
        'metadata-validate',
        `Persisted ${masterKey} dataset revision mismatch: expected ${custodyRevision}, received ${metadataRevision}.`,
      );
    }
  }

  let fullRows = null;
  let previewRows;
  if (typeof store.getRowsRange === 'function') {
    previewRows = await readRestoreValue(
      () => store.getRowsRange(custody.datasetId, 0, STARTUP_PREVIEW_ROWS),
      masterKey,
      'preview-read',
    );
  } else {
    fullRows = await readRestoreValue(
      () => store.getRows(custody.datasetId),
      masterKey,
      'rows-read',
    );
    previewRows = Array.isArray(fullRows) ? fullRows.slice(0, STARTUP_PREVIEW_ROWS) : null;
  }
  if (!Array.isArray(previewRows)) {
    throw classifiedRestoreError(
      'PREVIEW_ROWS_UNAVAILABLE',
      'preview-read',
      `Persisted ${masterKey} preview is unavailable.`,
    );
  }

  const needsLegacyWeightFingerprint = masterKey === 'weight'
    && !custody.masterFingerprint
    && !metadata.masterFingerprint;
  if (needsLegacyWeightFingerprint && !Array.isArray(fullRows)) {
    try {
      fullRows = await store.getRows(custody.datasetId);
    } catch (cause) {
      throw classifiedRestoreError(
        'FINGERPRINT_MIGRATION_FAILED',
        'fingerprint-migration',
        `Persisted Weight fingerprint migration requires ${metadataCount} rows.`,
        cause,
      );
    }
  }
  if (needsLegacyWeightFingerprint && (!Array.isArray(fullRows) || fullRows.length !== metadataCount)) {
    throw classifiedRestoreError(
      'FINGERPRINT_MIGRATION_FAILED',
      'fingerprint-migration',
      `Persisted Weight fingerprint migration requires ${metadataCount} rows.`,
    );
  }

  return {
    masterKey,
    custody,
    metadata,
    previewRows,
    fingerprintRows: needsLegacyWeightFingerprint ? fullRows : null,
  };
}

function applyLoadedDatasets(state, loaded) {
  const persistedConfig = supportConfigFrom(state);
  const base = state.masterContext || { config: persistedConfig };
  let config = { ...persistedConfig, ...(base.config || {}) };
  const context = {
    ...base,
    rawRows: { ...(base.rawRows || {}) },
    mappingRows: { ...(base.mappingRows || {}) },
    datasetRefs: { ...(base.datasetRefs || {}) },
    rowCounts: { ...(base.rowCounts || {}) },
    previewRows: { ...(base.previewRows || {}) },
    sourceMetadata: { ...(base.sourceMetadata || {}) },
    appliedMappingRevision: { ...(base.appliedMappingRevision || {}) },
  };
  for (const item of loaded) {
    const def = MASTER_DEFS[item.masterKey];
    const masterFingerprint = item.masterKey === 'weight'
      ? String(item.custody.masterFingerprint || item.metadata.masterFingerprint || xmlCiiWeightMasterRowsFingerprint(item.fingerprintRows || []))
      : '';
    context[def.rowsKey] = [];
    context.rawRows[item.masterKey] = [];
    context.mappingRows[item.masterKey] = Array.isArray(item.metadata.mappingRows) ? item.metadata.mappingRows.slice(0, STARTUP_PREVIEW_ROWS) : [];
    context.datasetRefs[item.masterKey] = Object.freeze({
      datasetId: item.custody.datasetId,
      rowCount: item.custody.rowCount,
      masterKey: item.masterKey,
      fileName: item.metadata.fileName || item.custody.source,
      sheetName: item.metadata.sheetName || '',
      fieldMap: { ...item.custody.fieldMap },
      ...((item.masterKey === 'pipingClass' || item.masterKey === 'materialMap' || item.masterKey === 'weight') && Number(item.custody.datasetRevision || item.metadata.datasetRevision) > 0 ? {
        datasetRevision: Number(item.custody.datasetRevision || item.metadata.datasetRevision),
      } : {}),
      ...(masterFingerprint ? { masterFingerprint } : {}),
      persistence: 'indexeddb',
    });
    context.rowCounts[item.masterKey] = item.custody.rowCount;
    context.previewRows[item.masterKey] = item.previewRows.slice(0, STARTUP_PREVIEW_ROWS);
    context.sourceMetadata[item.masterKey] = {
      key: item.masterKey,
      source: item.custody.source || item.metadata.fileName || 'IndexedDB',
      sourceType: 'indexeddb',
      status: 'loaded',
      rowCount: item.custody.rowCount,
    };
    context.appliedMappingRevision[item.masterKey] = item.custody.appliedRevision;
    config = compactConfigSection(config, def, item.custody.fieldMap);
    if (item.masterKey === 'weight') {
      config.weight = {
        ...(config.weight || {}),
        masterRevision: item.custody.appliedRevision,
        masterFingerprint,
      };
      delete config.weight.masterRows;
    }
    if (item.masterKey === 'pipingClass') context.pipingClassIndex = null;
  }
  context.config = config;
  return {
    ...state,
    masterContext: context,
    supportConfigJson: JSON.stringify(config, null, 2),
    importMastersWriteBackStatus: `Restored ${loaded.length} large master dataset${loaded.length === 1 ? '' : 's'} from IndexedDB as metadata-only custody.`,
  };
}

function restoreFailureRecord(masterKey, custody, error) {
  return Object.freeze({
    masterKey,
    datasetId: String(custody?.datasetId || ''),
    stage: 'startup-hydration',
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Persisted master restore failed.'),
  });
}

function restoreFailureIdentity(masterKey, custody, error) {
  return Object.freeze({
    masterKey,
    datasetId: String(custody?.datasetId || ''),
    domain: String(error?.restoreDomain || 'restore-storage'),
    code: String(error?.restoreCode || 'RESTORE_FAILED'),
    stage: String(error?.restoreStage || 'startup-hydration'),
  });
}

function activeSessionAuthority(state, masterKey) {
  return String(state?.masterContext?.datasetRefs?.[masterKey]?.persistence || '').toLowerCase() === 'session';
}

function withMasterRestoreFailures(state, entries, failures, identities) {
  const nextFailures = state?.masterRestoreFailures && typeof state.masterRestoreFailures === 'object'
    ? { ...state.masterRestoreFailures }
    : {};
  const nextIdentity = state?.masterRestoreFailureIdentity && typeof state.masterRestoreFailureIdentity === 'object'
    ? { ...state.masterRestoreFailureIdentity }
    : {};
  for (const [masterKey] of entries) {
    delete nextFailures[masterKey];
    delete nextIdentity[masterKey];
  }
  for (const failure of failures) nextFailures[failure.masterKey] = failure;
  for (const identity of identities) nextIdentity[identity.masterKey] = identity;
  return {
    ...state,
    masterRestoreFailures: nextFailures,
    masterRestoreFailureIdentity: nextIdentity,
  };
}

export async function hydratePersistedMasterDatasets(stateRef, options = {}) {
  if (!stateRef?.current) return false;
  const entries = Object.keys(MASTER_DEFS)
    .map((masterKey) => [masterKey, datasetCustody(masterKey)])
    .filter(([, custody]) => custody);
  if (!entries.length) return false;
  const store = options.store || createIndexedDbDatasetStore(options);
  const outcomes = await Promise.all(entries.map(async ([masterKey, custody]) => {
    try {
      return { ok: true, item: await loadDataset(store, masterKey, custody) };
    } catch (error) {
      return {
        ok: false,
        failure: restoreFailureRecord(masterKey, custody, error),
        identity: restoreFailureIdentity(masterKey, custody, error),
      };
    }
  }));
  const loaded = outcomes
    .filter((entry) => entry.ok)
    .map((entry) => entry.item)
    .filter((item) => !activeSessionAuthority(stateRef.current, item.masterKey));
  const failures = outcomes.filter((entry) => !entry.ok).map((entry) => entry.failure);
  const identities = outcomes.filter((entry) => !entry.ok).map((entry) => entry.identity);
  const nextState = loaded.length
    ? applyLoadedDatasets(stateRef.current, loaded)
    : stateRef.current;
  stateRef.current = withMasterRestoreFailures(nextState, entries, failures, identities);
  return true;
}
