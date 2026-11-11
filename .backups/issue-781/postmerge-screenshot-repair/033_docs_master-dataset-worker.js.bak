import { MASTER_DATASET_EVENT, serializeWorkerError } from './master-dataset-protocol.js?v=20260930-issue781-weight-no-staged-rewrite-1';
import { createIndexedDbDatasetStore } from './master-dataset-store.js';
import { createMasterDatasetService } from './master-dataset-service.js?v=20260930-issue781-weight-no-staged-rewrite-1';
import { buildSearchCorpus, prepareNormalizedDataset, searchCorpusIndexes } from './master-dataset-normalize.js?v=20260930-issue781-weight-no-staged-rewrite-1';

const SHEETJS_ESM_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let xlsxPromise = null;

export async function getWorkerXlsxModule() {
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = (async () => {
    const attempts = [
      () => import('xlsx'),
      () => import(SHEETJS_ESM_URL),
    ];
    const failures = [];
    for (const load of attempts) {
      try {
        const module = await load();
        const xlsx = typeof module?.read === 'function' ? module : module?.default;
        if (xlsx && typeof xlsx.read === 'function' && xlsx.utils?.sheet_to_json) return xlsx;
      } catch (error) {
        failures.push(error?.message || String(error));
      }
    }
    throw new Error(`XLSX parser failed to load in worker. ${failures.join(' | ')}`);
  })();
  return xlsxPromise;
}

export function createDefaultMasterDatasetService(options = {}) {
  return createMasterDatasetService({
    getXlsx: getWorkerXlsxModule,
    store: createIndexedDbDatasetStore(),
    prepareDataset: prepareNormalizedDataset,
    buildSearchCorpus,
    searchCorpusIndexes,
    emitEvent: options.emitEvent,
  });
}

export function installMasterDatasetWorker(scope = globalThis) {
  const service = createDefaultMasterDatasetService({
    emitEvent: (message) => scope.postMessage(message),
  });
  scope.addEventListener('message', async (event) => {
    const requestId = event?.data?.requestId || '';
    try {
      const result = await service.handle(event.data);
      scope.postMessage(result);
    } catch (error) {
      scope.postMessage({ type: MASTER_DATASET_EVENT.ERROR, requestId, error: serializeWorkerError(error) });
    }
  });
  return service;
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) {
  installMasterDatasetWorker(globalThis);
}
