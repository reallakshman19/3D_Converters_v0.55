import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT, makeRequestId } from './master-dataset-protocol.js?v=20260929-pr780-bounded-ui-1';

function defaultWorkerFactory() {
  return new Worker(new URL('./master-dataset-worker.js?v=20260929-pr780-bounded-ui-1', import.meta.url), { type: 'module' });
}

function workerError(message) {
  const error = new Error(message?.error?.message || 'Master dataset worker failed.');
  error.name = message?.error?.name || 'Error';
  if (message?.error?.stack) error.stack = message.error.stack;
  return error;
}

export function createMasterDatasetClient(options = {}) {
  const workerFactory = options.workerFactory || defaultWorkerFactory;
  let worker = null;
  const pending = new Map();
  let generation = 0;

  function rejectPending(reason) {
    for (const { reject } of pending.values()) reject(reason);
    pending.clear();
  }

  function attachWorker(nextWorker) {
    nextWorker.addEventListener('message', (event) => {
      const message = event.data || {};
      const entry = pending.get(message.requestId);
      if (!entry) return;
      pending.delete(message.requestId);
      if (message.type === MASTER_DATASET_EVENT.ERROR) entry.reject(workerError(message));
      else entry.resolve(message);
    });
    nextWorker.addEventListener('error', (event) => {
      rejectPending(new Error(event?.message || 'Master dataset worker crashed.'));
    });
    return nextWorker;
  }

  function ensureWorker() {
    if (!worker) worker = attachWorker(workerFactory());
    return worker;
  }

  function request(type, payload = {}, transfer = []) {
    const requestId = makeRequestId(type.toLowerCase());
    const requestGeneration = generation;
    return new Promise((resolve, reject) => {
      pending.set(requestId, {
        resolve: (message) => requestGeneration === generation ? resolve(message) : reject(new Error('Worker response is stale.')),
        reject,
      });
      ensureWorker().postMessage({ type, requestId, ...payload }, transfer);
    });
  }

  function openBuffer(buffer, { fileName = 'master.dat', masterKey, config = {}, currentMap = {}, fieldMapOverride = null, jobId = makeRequestId('import') } = {}) {
    if (!(buffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer is required.');
    if (!masterKey) throw new Error('masterKey is required.');
    return request(MASTER_DATASET_COMMAND.OPEN_SOURCE, {
      jobId, fileName, masterKey, config, currentMap, fieldMapOverride, buffer,
    }, [buffer]);
  }

  async function openFile(file, options = {}) {
    if (!file?.arrayBuffer) throw new Error('File with arrayBuffer() is required.');
    const buffer = await file.arrayBuffer();
    return openBuffer(buffer, { ...options, fileName: file.name || options.fileName || 'master.dat' });
  }

  function selectSheet(jobId, sheetName) {
    return request(MASTER_DATASET_COMMAND.SELECT_SHEET, { jobId, sheetName });
  }

  function search(datasetId, query) {
    return request(MASTER_DATASET_COMMAND.SEARCH, { datasetId, query });
  }

  function getRows(datasetId, offset = 0, limit = 150) {
    return request(MASTER_DATASET_COMMAND.GET_ROWS, { datasetId, offset, limit });
  }

  function getRowsByIndexes(datasetId, indexes = []) {
    return request(MASTER_DATASET_COMMAND.GET_ROWS_BY_INDEXES, {
      datasetId,
      indexes: Array.isArray(indexes) ? indexes : [],
    });
  }

  function getRawRows(datasetId, offset = 0, limit = 150) {
    return request(MASTER_DATASET_COMMAND.GET_RAW_ROWS, { datasetId, offset, limit });
  }

  function releaseSource(jobId) {
    return request(MASTER_DATASET_COMMAND.RELEASE_SOURCE, { jobId });
  }

  function releaseDataset(datasetId) {
    return request(MASTER_DATASET_COMMAND.RELEASE_DATASET, { datasetId });
  }

  function restartWorker(reason = 'Master dataset worker restarted.') {
    generation += 1;
    worker?.terminate?.();
    worker = null;
    rejectPending(new Error(reason));
  }

  function cancelActiveImport() {
    restartWorker('Master import cancelled.');
  }

  function dispose() {
    restartWorker('Master dataset client disposed.');
  }

  return Object.freeze({
    openBuffer, openFile, selectSheet, search, getRows, getRowsByIndexes, getRawRows,
    releaseSource, releaseDataset, cancelActiveImport, dispose,
  });
}
