import {
  updateWorkflowState, updateMasterLastLoadedPath, getSavedMappingsForMaster, findSmartMatchingMapping,
} from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import { appliedFieldMap, ensureMasterRuntime, persistChangedMasterDetailed } from './xml-cii-adapted-master-runtime.js';
import { masterConfigForState, masterPersistenceStatus } from './xml-cii-adapted-master-mapping-events.js?v=20261001-weight-output-2';
import { perfCount, requestMeasuredFullRender } from './xml-cii-adapted-perf.js';
import { commitDatasetReadyMaster } from './xml-cii-adapted-master-dataset-commit.js?v=20261001-weight-output-2';
import { masterDatasetCoordinator as coordinator } from './xml-cii-adapted-master-dataset-runtime.js?v=20261006-c05-5-5-persistence-retry-1';
import { MASTER_DATASET_EVENT } from '../workers/master-dataset-protocol.js';

const generations = new Map();
const importSources = new Map();

function nextGeneration(key) {
  const next = Number(generations.get(key) || 0) + 1;
  generations.set(key, next);
  return next;
}

function isCurrent(key, generation) {
  return generations.get(key) === generation;
}

function resolvePathToUrl(pathStr) {
  const normalized = pathStr.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return new URL(normalized, location.href).href;
}

function translateError(error) {
  const message = error?.message || String(error || 'Unknown error');
  if (/XLSX|worksheet|workbook|spreadsheet/i.test(message)) return `Spreadsheet import failed: ${message}`;
  if (/Fetch failed|Failed to fetch/i.test(message)) return `Could not read file: ${message}`;
  return message;
}

function nextPersistenceFailures(state, key, failure = null) {
  const next = { ...(state?.masterPersistenceFailures || {}) };
  if (failure) next[key] = Object.freeze({ ...failure });
  else delete next[key];
  return next;
}

function persistenceFailureRecord(key, datasetId, phase, persistence = {}) {
  const failure = persistence?.failure || persistence?.failures?.[0] || null;
  if (!failure && phase !== 'restart-custody') return null;
  return {
    key,
    datasetId: String(datasetId || ''),
    phase,
    name: String(failure?.name || 'StorageError'),
    message: String(failure?.message || 'Browser restart custody could not be saved.'),
    quotaLimited: !!persistence?.quotaLimited,
  };
}

export function masterImportPersistenceStatus(baseMessage, workerPersistence = null, custodyPersistence = null) {
  if (workerPersistence?.persisted === false) {
    const cause = workerPersistence.quotaLimited ? 'browser storage quota' : 'IndexedDB storage error';
    const detail = String(workerPersistence.failure?.message || '').trim();
    return `${baseMessage} Parse/import succeeded. Active session is usable, but durable IndexedDB persistence failed due to ${cause}${detail ? ` (${detail})` : ''}. Reload will not restore this session-only dataset as durable. Use Retry durable save before reload.`;
  }
  if (custodyPersistence?.failures?.length) {
    const cause = custodyPersistence.quotaLimited ? 'browser storage quota' : 'browser storage error';
    return `${baseMessage} Parse/import succeeded, but restart custody could not be saved due to ${cause}. Active session remains usable. Use Retry durable save before reload.`;
  }
  return masterPersistenceStatus(baseMessage, custodyPersistence || {
    failures: [], indexedDbBacked: false, compact: false, quotaLimited: false, normalizedPersisted: false,
  });
}

function currentMasterRef(stateRef, key) {
  return ensureMasterRuntime(stateRef.current.masterContext || {}).datasetRefs?.[key] || null;
}

function workerSettings(stateRef, key, fileName) {
  const config = masterConfigForState(stateRef);
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  const saved = getSavedMappingsForMaster(key);
  const matchedKey = findSmartMatchingMapping(fileName, Object.keys(saved));
  return {
    config,
    currentMap: appliedFieldMap(context, config, key),
    fieldMapOverride: matchedKey ? saved[matchedKey] : null,
    matchedKey,
  };
}

function setWorkbookState(stateRef, key, sheetNames, activeSheet = '') {
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: {
      ...context,
      sheetNames: { ...(context.sheetNames || {}), [key]: [...sheetNames] },
      activeSheet: { ...(context.activeSheet || {}), [key]: activeSheet },
      workbookData: { ...(context.workbookData || {}), [key]: null },
    },
  });
}

function commitReady(stateRef, key, ready, source, settings) {
  const metadata = ready?.metadata || {};
  const sourceMetadata = {
    key,
    source: source.fileName,
    sourceType: 'worker-import',
    status: metadata.rowCount ? 'loaded' : 'empty',
    rowCount: metadata.rowCount,
  };
  const committed = commitDatasetReadyMaster({
    context: stateRef.current.masterContext || {},
    config: masterConfigForState(stateRef),
    key,
    ready,
    sourceMetadata,
  });
  const mappingText = settings.matchedKey ? ` using saved mapping from ${settings.matchedKey}` : ' with worker auto-mapping';
  const workerPersistence = ready?.persistence || null;
  const failure = workerPersistence?.persisted === false
    ? persistenceFailureRecord(key, metadata.datasetId, 'indexeddb', workerPersistence)
    : (committed.persistence?.failures?.length
      ? persistenceFailureRecord(key, metadata.datasetId, 'restart-custody', committed.persistence)
      : null);
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: committed.context,
    supportConfigJson: JSON.stringify(committed.config, null, 2),
    importMastersLoading: false,
    masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, failure),
    importMastersWriteBackStatus: masterImportPersistenceStatus(
      `Imported ${source.fileName} (${metadata.rowCount} rows)${mappingText}.`,
      workerPersistence,
      committed.persistence,
    ),
  });
  return committed;
}

async function finalizeReady(stateRef, render, key, generation, ready, source, settings) {
  if (!isCurrent(key, generation)) return false;
  commitReady(stateRef, key, ready, source, settings);
  perfCount('masterWorkerImportCount');
  perfCount('masterWorkerMetadataOnlyCommitCount');
  requestMeasuredFullRender(render);
  return true;
}

function selectedWorkbookSheet(response) {
  const sheetNames = Array.isArray(response?.sheetNames) ? response.sheetNames : [];
  const firstSheet = sheetNames[0] || '';
  const suggested = String(response?.suggestedSheet || '');
  return suggested && sheetNames.includes(suggested) ? suggested : firstSheet;
}

async function handleOpenResponse(stateRef, render, key, generation, response, source, settings) {
  if (!isCurrent(key, generation)) return;
  if (response.type === MASTER_DATASET_EVENT.SHEETS) {
    const selectedSheet = selectedWorkbookSheet(response);
    setWorkbookState(stateRef, key, response.sheetNames || [], selectedSheet);
    if (!selectedSheet) throw new Error('Workbook contains no sheets.');
    const ready = await coordinator.selectSheet(key, selectedSheet);
    return finalizeReady(stateRef, render, key, generation, ready, source, settings);
  }
  return finalizeReady(stateRef, render, key, generation, response, source, settings);
}

async function importFile(stateRef, render, key, file) {
  const generation = nextGeneration(key);
  const settings = workerSettings(stateRef, key, file.name);
  importSources.set(key, { fileName: file.name, sourcePath: file.name, settings });
  stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: true });
  const response = await coordinator.openFile(key, file, settings);
  return handleOpenResponse(stateRef, render, key, generation, response, importSources.get(key), settings);
}

async function importBuffer(stateRef, render, key, buffer, fileName, sourcePath) {
  const generation = nextGeneration(key);
  const settings = workerSettings(stateRef, key, fileName);
  const source = { fileName, sourcePath, settings };
  importSources.set(key, source);
  stateRef.current = updateMasterLastLoadedPath(stateRef.current, key, sourcePath);
  const response = await coordinator.openBuffer(key, buffer, fileName, settings);
  return handleOpenResponse(stateRef, render, key, generation, response, source, settings);
}

function reportFailure(stateRef, render, boundary, error) {
  console.error(`[xml-cii] Master worker ${boundary.toLowerCase()} failed:`, error);
  stateRef.current = updateWorkflowState(stateRef.current, {
    importMastersLoading: false,
    importMastersWriteBackStatus: `${boundary} error: ${error?.message || String(error)}`,
  });
  requestMeasuredFullRender(render);
  alert(translateError(error));
}

export async function retryCurrentMasterPersistence(stateRef, key, options = {}) {
  const initialContext = ensureMasterRuntime(stateRef.current.masterContext || {});
  const initialRef = initialContext.datasetRefs?.[key];
  if (!initialRef?.datasetId) {
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      importMastersWriteBackStatus: `No active ${key} dataset is available for persistence retry.`,
    });
    return { ok: false, reason: 'missing-dataset' };
  }

  const basisDatasetId = String(initialRef.datasetId);
  const basisRevision = Number(initialContext.appliedMappingRevision?.[key] || 0);
  const retryPersistence = options.retryPersistence
    || ((masterKey, datasetId) => coordinator.retryPersistence(masterKey, datasetId));
  const persistCustody = options.persistCustody || persistChangedMasterDetailed;

  stateRef.current = updateWorkflowState(stateRef.current, {
    importMastersLoading: true,
    importMastersWriteBackStatus: `Retrying durable persistence for ${key} without reparsing or remapping…`,
  });

  try {
    let workerPersistence = { persisted: true, failure: null, quotaLimited: false };
    if (String(initialRef.persistence || '') === 'session') {
      const result = await retryPersistence(key, basisDatasetId);
      workerPersistence = result?.persistence || { persisted: false, failure: { name: 'Error', message: 'Persistence retry returned no result.' }, quotaLimited: false };

      const currentContext = ensureMasterRuntime(stateRef.current.masterContext || {});
      const currentRef = currentContext.datasetRefs?.[key];
      const currentRevision = Number(currentContext.appliedMappingRevision?.[key] || 0);
      if (String(currentRef?.datasetId || '') !== basisDatasetId || currentRevision !== basisRevision) {
        stateRef.current = updateWorkflowState(stateRef.current, {
          importMastersLoading: false,
          importMastersWriteBackStatus: `Persistence retry result for ${key} was ignored because the active master changed while retry was running.`,
        });
        return { ok: false, reason: 'stale-result' };
      }

      if (workerPersistence.persisted !== true) {
        const failure = persistenceFailureRecord(key, basisDatasetId, 'indexeddb', workerPersistence);
        stateRef.current = updateWorkflowState(stateRef.current, {
          importMastersLoading: false,
          masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, failure),
          importMastersWriteBackStatus: masterImportPersistenceStatus(
            `Persistence retry for ${key} did not become durable.`,
            workerPersistence,
            null,
          ),
        });
        return { ok: false, reason: 'indexeddb-failure', persistence: workerPersistence };
      }

      const promotedRef = Object.freeze({ ...currentRef, persistence: 'indexeddb' });
      stateRef.current = updateWorkflowState(stateRef.current, {
        masterContext: {
          ...currentContext,
          datasetRefs: { ...(currentContext.datasetRefs || {}), [key]: promotedRef },
        },
      });
    }

    const currentContext = ensureMasterRuntime(stateRef.current.masterContext || {});
    const currentRef = currentContext.datasetRefs?.[key];
    if (String(currentRef?.datasetId || '') !== basisDatasetId
        || Number(currentContext.appliedMappingRevision?.[key] || 0) !== basisRevision) {
      stateRef.current = updateWorkflowState(stateRef.current, {
        importMastersLoading: false,
        importMastersWriteBackStatus: `Persistence retry for ${key} was not applied because the active master changed.`,
      });
      return { ok: false, reason: 'stale-result' };
    }

    const custodyPersistence = persistCustody(key, currentContext);
    const custodyFailure = custodyPersistence?.failures?.length
      ? persistenceFailureRecord(key, basisDatasetId, 'restart-custody', custodyPersistence)
      : null;
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, custodyFailure),
      importMastersWriteBackStatus: custodyFailure
        ? masterImportPersistenceStatus(
          `Durable IndexedDB persistence succeeded for ${key}.`,
          workerPersistence,
          custodyPersistence,
        )
        : `Durable persistence retry succeeded for ${key}. Dataset identity and applied mapping revision are unchanged; reload can restore this dataset from IndexedDB.`,
    });
    return {
      ok: !custodyFailure,
      reason: custodyFailure ? 'restart-custody-failure' : 'durable',
      datasetId: basisDatasetId,
      revision: basisRevision,
    };
  } catch (error) {
    const failure = {
      key,
      datasetId: basisDatasetId,
      phase: 'retry',
      name: String(error?.name || 'Error'),
      message: String(error?.message || error || 'Persistence retry failed.'),
      quotaLimited: false,
    };
    stateRef.current = updateWorkflowState(stateRef.current, {
      importMastersLoading: false,
      masterPersistenceFailures: nextPersistenceFailures(stateRef.current, key, failure),
      importMastersWriteBackStatus: `Persistence retry failed for ${key}: ${failure.message} Active session authority remains unchanged; re-import the source if the worker session is no longer available.`,
    });
    return { ok: false, reason: 'retry-error', error };
  }
}

function bindRetryPersistenceEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="retry-master-persistence"]').forEach((button) => {
    button.addEventListener('click', async () => {
      await retryCurrentMasterPersistence(stateRef, button.dataset.masterKey);
      requestMeasuredFullRender(render);
    });
  });
}

function bindFileEvents(container, stateRef, render) {
  container.querySelectorAll('[data-master-file]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await importFile(stateRef, render, input.dataset.masterFile, file); }
      catch (error) { reportFailure(stateRef, render, 'Import', error); }
    });
  });
}

function bindPathEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="fetch-master-path"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const key = button.dataset.masterKey;
      const input = container.querySelector(`[data-master-path-input="${key}"]`);
      const pathValue = input?.value.trim().replace(/^"|"$/g, '') || '';
      if (!pathValue) return alert('Please paste a file path first.');
      try {
        stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: true });
        const url = resolvePathToUrl(pathValue);
        const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_nocache=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        const fileName = pathValue.split(/[\\/]/).pop() || 'master.dat';
        await importBuffer(stateRef, render, key, buffer, fileName, pathValue);
      } catch (error) { reportFailure(stateRef, render, 'Fetch/import', error); }
    });
  });
}

function restoreUnavailableSheetSelection(select, stateRef, render, key) {
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  const activeSheet = String(context.activeSheet?.[key] || '');
  if (activeSheet) select.value = activeSheet;
  const message = `Worksheet switching for ${key} is unavailable after reload because workbook bytes are session-only. Reopen or re-import the source workbook to change sheets.`;
  stateRef.current = updateWorkflowState(stateRef.current, { importMastersWriteBackStatus: message });
  requestMeasuredFullRender(render);
  alert(message);
}

function bindSheetEvents(container, stateRef, render) {
  container.querySelectorAll('[data-master-sheet-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      const key = select.dataset.masterSheetSelect;
      const generation = nextGeneration(key);
      const source = importSources.get(key);
      if (!source) return restoreUnavailableSheetSelection(select, stateRef, render, key);
      try {
        const ready = await coordinator.selectSheet(key, select.value);
        if (!isCurrent(key, generation)) return;
        setWorkbookState(stateRef, key, coordinator.workbookJob(key)?.sheetNames || [], select.value);
        await finalizeReady(stateRef, render, key, generation, ready, source, source.settings);
      } catch (error) { reportFailure(stateRef, render, 'Sheet import', error); }
    });
  });
}

export function bindMasterWorkerImportEvents(container, stateRef, render) {
  bindFileEvents(container, stateRef, render);
  bindPathEvents(container, stateRef, render);
  bindSheetEvents(container, stateRef, render);
  bindRetryPersistenceEvents(container, stateRef, render);
}
