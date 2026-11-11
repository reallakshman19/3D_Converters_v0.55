import { createMasterDatasetClient } from './master-dataset-client.js';
import { MASTER_DATASET_EVENT, MASTER_DATASET_CHUNK_ROWS } from './master-dataset-protocol.js';

function assertDatasetMessage(message) {
  if (message?.type !== MASTER_DATASET_EVENT.DATASET_READY || !message?.metadata?.datasetId) {
    throw new Error('Dataset-ready worker response is required.');
  }
  return message;
}

export function createMasterDatasetImportCoordinator(options = {}) {
  const client = options.client || createMasterDatasetClient(options);
  const jobs = new Map();
  const activeDatasets = new Map();

  function remember(masterKey, message) {
    if (message?.type === MASTER_DATASET_EVENT.SHEETS) {
      jobs.set(masterKey, { jobId: message.jobId, sheetNames: [...(message.sheetNames || [])] });
    }
    if (message?.type === MASTER_DATASET_EVENT.DATASET_READY) {
      activeDatasets.set(masterKey, message.metadata.datasetId);
    }
    return message;
  }

  async function openFile(masterKey, file, settings = {}) {
    return remember(masterKey, await client.openFile(file, { ...settings, masterKey }));
  }

  async function openBuffer(masterKey, buffer, fileName, settings = {}) {
    return remember(masterKey, await client.openBuffer(buffer, { ...settings, masterKey, fileName }));
  }

  async function selectSheet(masterKey, sheetName) {
    const job = jobs.get(masterKey);
    if (!job?.jobId) throw new Error(`No workbook import job exists for ${masterKey}.`);
    return remember(masterKey, await client.selectSheet(job.jobId, sheetName));
  }

  function workbookJob(masterKey) {
    const job = jobs.get(masterKey);
    return job ? { jobId: job.jobId, sheetNames: [...job.sheetNames] } : null;
  }

  async function materialize(message, options = {}) {
    const ready = assertDatasetMessage(message);
    const datasetId = ready.metadata.datasetId;
    const rowCount = Number(ready.metadata.rowCount || 0);
    const includeRaw = options.includeRaw !== false;
    const rows = [];
    const rawRows = [];
    for (let offset = 0; offset < rowCount; offset += MASTER_DATASET_CHUNK_ROWS) {
      const normalizedRequest = client.getRows(datasetId, offset, MASTER_DATASET_CHUNK_ROWS);
      const rawRequest = includeRaw ? client.getRawRows(datasetId, offset, MASTER_DATASET_CHUNK_ROWS) : null;
      const [normalized, raw] = await Promise.all([normalizedRequest, rawRequest]);
      rows.push(...(normalized?.rows || []));
      if (includeRaw) rawRows.push(...(raw?.rows || []));
    }
    if (rows.length !== rowCount) throw new Error(`Dataset hydration mismatch: expected ${rowCount}, received ${rows.length}.`);
    if (includeRaw && rawRows.length !== rowCount) throw new Error(`Raw dataset hydration mismatch: expected ${rowCount}, received ${rawRows.length}.`);
    return { rows, rawRows, metadata: ready.metadata, previewRows: ready.previewRows || [], mappingRows: ready.mappingRows || [] };
  }

  async function releaseMaster(masterKey) {
    const job = jobs.get(masterKey);
    const datasetId = activeDatasets.get(masterKey);
    jobs.delete(masterKey);
    activeDatasets.delete(masterKey);
    if (job?.jobId) await client.releaseSource(job.jobId);
    if (datasetId) await client.releaseDataset(datasetId);
  }

  function search(masterKey, query, datasetIdOverride = '') {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return client.search(datasetId, query);
  }

  function dispose() {
    jobs.clear();
    activeDatasets.clear();
    client.dispose();
  }

  return Object.freeze({ openFile, openBuffer, selectSheet, workbookJob, materialize, releaseMaster, search, dispose });
}
