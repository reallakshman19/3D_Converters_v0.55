import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT, makeRequestId } from './master-dataset-protocol.js?v=20260930-issue781-weight-basis-linear-1';

function defaultWorkerFactory() {
  return new Worker(new URL('./master-dataset-worker.js?v=20260930-issue781-weight-basis-linear-1', import.meta.url), { type: 'module' });
}

function workerError(message) {
  const error = new Error(message?.error?.message || 'Master dataset worker failed.');
  error.name = message?.error?.name || 'Error';
  if (message?.error?.stack) error.stack = message.error.stack;
  return error;
}

function transportError(message) {
  const error = new Error(message || 'Master dataset worker transport failed.');
  error.name = 'WorkerTransportError';
  return error;
}

function timeoutError(type, timeoutMs) {
  const error = new Error(`Master dataset worker timed out during ${type} after ${Math.round(timeoutMs / 1000)}s.`);
  error.name = 'TimeoutError';
  return error;
}

export function createMasterDatasetClient(options = {}) {
  const workerFactory = options.workerFactory || defaultWorkerFactory;
  const configuredWeightTimeout = Number(options.weightRequestTimeoutMs);
  const weightRequestTimeoutMs = Number.isFinite(configuredWeightTimeout) && configuredWeightTimeout > 0
    ? configuredWeightTimeout
    : 15000;
  const configuredBasisTimeout = Number(options.weightBasisTimeoutMs);
  const weightBasisTimeoutMs = Number.isFinite(configuredBasisTimeout) && configuredBasisTimeout > 0
    ? configuredBasisTimeout
    : 60000;
  let worker = null;
  const pending = new Map();
  let generation = 0;

  function rejectPending(reason) {
    for (const entry of pending.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.reject(reason);
    }
    pending.clear();
  }

  function restartWorker(reason = new Error('Master dataset worker restarted.')) {
    generation += 1;
    worker?.terminate?.();
    worker = null;
    rejectPending(reason instanceof Error ? reason : new Error(String(reason)));
  }

  function attachWorker(nextWorker) {
    nextWorker.addEventListener('message', (event) => {
      const message = event.data || {};
      const entry = pending.get(message.requestId);
      if (!entry) return;
      if (message.type === MASTER_DATASET_EVENT.WEIGHT_BASIS_PROGRESS) {
        entry.onProgress?.(message);
        return;
      }
      pending.delete(message.requestId);
      if (entry.timer) clearTimeout(entry.timer);
      if (message.type === MASTER_DATASET_EVENT.ERROR) entry.reject(workerError(message));
      else entry.resolve(message);
    });
    nextWorker.addEventListener('error', (event) => {
      if (worker !== nextWorker) return;
      restartWorker(transportError(event?.message || 'Master dataset worker crashed.'));
    });
    nextWorker.addEventListener('messageerror', () => {
      if (worker !== nextWorker) return;
      restartWorker(transportError('Master dataset worker returned an unreadable message.'));
    });
    return nextWorker;
  }

  function ensureWorker() {
    if (!worker) worker = attachWorker(workerFactory());
    return worker;
  }

  function request(type, payload = {}, transfer = [], timeoutMs = 0, onProgress = null) {
    const requestId = makeRequestId(type.toLowerCase());
    const requestGeneration = generation;
    return new Promise((resolve, reject) => {
      const entry = {
        resolve: (message) => requestGeneration === generation ? resolve(message) : reject(new Error('Worker response is stale.')),
        reject,
        timer: null,
        onProgress: typeof onProgress === 'function' ? onProgress : null,
      };
      if (timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          if (!pending.has(requestId)) return;
          restartWorker(timeoutError(type, timeoutMs));
        }, timeoutMs);
      }
      pending.set(requestId, entry);
      try {
        ensureWorker().postMessage({ type, requestId, ...payload }, transfer);
      } catch (error) {
        restartWorker(transportError(error?.message || String(error)));
      }
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

  function remapDataset(datasetId, fieldMap = {}) {
    if (!datasetId) throw new Error('datasetId is required.');
    return request(MASTER_DATASET_COMMAND.REMAP_DATASET, { datasetId, fieldMap: { ...(fieldMap || {}) } });
  }

  function search(datasetId, query) {
    return request(MASTER_DATASET_COMMAND.SEARCH, { datasetId, query });
  }

  async function rankWeightIssues(datasetId, issues = [], config = {}, options = {}) {
    if (!datasetId) throw new Error('datasetId is required.');
    const payload = {
      datasetId,
      issues: Array.isArray(issues) ? issues : [],
      config: config && typeof config === 'object' ? config : {},
      ratingMode: options.ratingMode || 'preview',
      previewRatingSnapshot: options.previewRatingSnapshot || {},
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await request(MASTER_DATASET_COMMAND.RANK_WEIGHT_ISSUES, payload, [], weightRequestTimeoutMs);
      } catch (error) {
        const recoverable = error?.name === 'TimeoutError' || error?.name === 'WorkerTransportError';
        if (!recoverable || attempt > 0) throw error;
      }
    }
    throw new Error('Weight Match worker recovery exhausted.');
  }

  async function prepareWeightBasis(payload = {}, options = {}) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await request(
          MASTER_DATASET_COMMAND.PREPARE_WEIGHT_BASIS,
          payload,
          [],
          weightBasisTimeoutMs,
          options.onProgress,
        );
      } catch (error) {
        if (error?.name !== 'WorkerTransportError' || attempt > 0) throw error;
      }
    }
    throw new Error('Weight basis worker recovery exhausted.');
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

  function cancelActiveImport() {
    restartWorker(new Error('Master import cancelled.'));
  }

  function dispose() {
    restartWorker(new Error('Master dataset client disposed.'));
  }

  return Object.freeze({
    openBuffer, openFile, selectSheet, remapDataset, search, rankWeightIssues, prepareWeightBasis, getRows, getRowsByIndexes, getRawRows,
    releaseSource, releaseDataset, cancelActiveImport, dispose,
  });
}
