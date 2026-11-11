import {
  updateWorkflowState, updateMasterLastLoadedPath, getSavedMappingsForMaster, findSmartMatchingMapping,
} from './xml-cii-adapted-state.js';
import { appliedFieldMap, ensureMasterRuntime } from './xml-cii-adapted-master-runtime.js';
import { masterConfigForState, masterPersistenceStatus } from './xml-cii-adapted-master-mapping-events.js';
import { perfCount, requestMeasuredFullRender } from './xml-cii-adapted-perf.js';
import { commitDatasetReadyMaster } from './xml-cii-adapted-master-dataset-commit.js?v=20260929-pr780-metadata-import-1';
import { masterDatasetCoordinator as coordinator } from './xml-cii-adapted-master-dataset-runtime.js?v=20260929-pr780-bounded-ui-1';
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
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: committed.context,
    supportConfigJson: JSON.stringify(committed.config, null, 2),
    importMastersLoading: false,
    importMastersWriteBackStatus: masterPersistenceStatus(
      `Imported ${source.fileName} (${metadata.rowCount} rows)${mappingText}.`, committed.persistence,
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

async function handleOpenResponse(stateRef, render, key, generation, response, source, settings) {
  if (!isCurrent(key, generation)) return;
  if (response.type === MASTER_DATASET_EVENT.SHEETS) {
    const firstSheet = response.sheetNames?.[0] || '';
    setWorkbookState(stateRef, key, response.sheetNames || [], firstSheet);
    if (!firstSheet) throw new Error('Workbook contains no sheets.');
    const ready = await coordinator.selectSheet(key, firstSheet);
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

function bindSheetEvents(container, stateRef, render) {
  container.querySelectorAll('[data-master-sheet-select]').forEach((select) => {
    select.addEventListener('change', async () => {
      const key = select.dataset.masterSheetSelect;
      const generation = nextGeneration(key);
      const source = importSources.get(key);
      if (!source) return;
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
}
