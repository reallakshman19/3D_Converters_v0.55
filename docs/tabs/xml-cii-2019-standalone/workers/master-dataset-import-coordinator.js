import { createMasterDatasetClient } from './master-dataset-client.js?v=20261007-c05-6-2-consumer-authority-1';
import { MASTER_DATASET_EVENT, MASTER_DATASET_CHUNK_ROWS } from './master-dataset-protocol.js?v=20260930-issue781-weight-no-staged-rewrite-1';

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

  async function remapDataset(masterKey, datasetId, fieldMap = {}) {
    const activeId = datasetId || activeDatasets.get(masterKey);
    if (!activeId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return remember(masterKey, await client.remapDataset(activeId, fieldMap));
  }

  async function retryPersistence(masterKey, datasetIdOverride = '') {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return client.retryPersistence(datasetId);
  }

  function assertRowsAuthority(masterKey, expectedRef = {}, result = {}) {
    const expectedId = String(expectedRef?.datasetId || '');
    const actualId = String(result?.datasetId || '');
    if (expectedId && actualId !== expectedId) {
      throw new Error(`Dataset authority mismatch for ${masterKey}: expected datasetId ${expectedId}, received ${actualId || 'unknown'}.`);
    }
    const actualKey = String(result?.masterKey || '');
    if (actualKey && actualKey !== masterKey) {
      throw new Error(`Dataset authority mismatch for ${masterKey}: dataset belongs to ${actualKey}.`);
    }
    const expectedRevision = Number(expectedRef?.datasetRevision || 0);
    const actualRevision = Number(result?.datasetRevision || 0);
    if (expectedRevision > 0 && actualRevision > 0 && expectedRevision !== actualRevision) {
      throw new Error(`Dataset revision mismatch for ${masterKey}: expected ${expectedRevision}, received ${actualRevision}.`);
    }
    const expectedFingerprint = String(expectedRef?.masterFingerprint || '');
    const actualFingerprint = String(result?.masterFingerprint || '');
    if (expectedFingerprint && actualFingerprint !== expectedFingerprint) {
      throw new Error(`Dataset fingerprint mismatch for ${masterKey}: expected ${expectedFingerprint}, received ${actualFingerprint || 'missing'}.`);
    }
    return result;
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

  async function materializeRows(masterKey, rowCount = 0, datasetIdOverride = '', datasetRef = {}) {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    const expectedRef = { ...(datasetRef || {}), datasetId };
    const expected = Math.max(0, Number(rowCount) || 0);
    const rows = [];
    for (let offset = 0; offset < expected; offset += MASTER_DATASET_CHUNK_ROWS) {
      const result = assertRowsAuthority(
        masterKey,
        expectedRef,
        await client.getRows(datasetId, offset, MASTER_DATASET_CHUNK_ROWS),
      );
      rows.push(...(result?.rows || []));
    }
    if (rows.length !== expected) {
      throw new Error(`Dataset materialization mismatch for ${masterKey}: expected ${expected}, received ${rows.length}.`);
    }
    return { datasetId, rowCount: expected, rows };
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

  function rankWeightIssues(masterKey, issues = [], config = {}, options = {}, datasetIdOverride = '') {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return client.rankWeightIssues(datasetId, issues, config, options);
  }

  function prepareWeightBasis(payload = {}, options = {}) {
    return client.prepareWeightBasis(payload, options);
  }

  async function getRows(masterKey, offset = 0, limit = 150, datasetIdOverride = '', datasetRef = {}) {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return assertRowsAuthority(
      masterKey,
      { ...(datasetRef || {}), datasetId },
      await client.getRows(datasetId, offset, limit),
    );
  }

  async function getRowsByIndexes(masterKey, indexes = [], datasetIdOverride = '', datasetRef = {}) {
    const datasetId = datasetIdOverride || activeDatasets.get(masterKey);
    if (!datasetId) throw new Error(`No active dataset exists for ${masterKey}.`);
    return assertRowsAuthority(
      masterKey,
      { ...(datasetRef || {}), datasetId },
      await client.getRowsByIndexes(datasetId, indexes),
    );
  }

  function dispose() {
    jobs.clear();
    activeDatasets.clear();
    client.dispose();
  }

  return Object.freeze({ openFile, openBuffer, selectSheet, workbookJob, remapDataset, retryPersistence, materialize, materializeRows, releaseMaster, search, rankWeightIssues, prepareWeightBasis, getRows, getRowsByIndexes, dispose });
}
