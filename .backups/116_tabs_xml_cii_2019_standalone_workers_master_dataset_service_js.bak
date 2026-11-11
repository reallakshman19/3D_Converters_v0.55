import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT, MASTER_DATASET_PREVIEW_ROWS, MASTER_DATASET_CHUNK_ROWS, assertCommandEnvelope } from './master-dataset-protocol.js';
import { listWorkbookSheets, parseTextSource, parseWorkbookSheet, sourceNeedsSheetSelection } from './master-dataset-parser.js';

function datasetIdFor(jobId, masterKey, sheetName = '', revision = 1) {
  return `${jobId}:${masterKey}:${sheetName || 'rows'}:r${revision}`;
}

function response(type, requestId, payload = {}) {
  return { type, requestId, ...payload };
}

function publicMetadata(metadata) {
  const { config, currentMap, fieldMapOverride, ...safe } = metadata;
  return safe;
}

export function createMasterDatasetService({ getXlsx, store, prepareDataset, buildSearchCorpus, searchCorpusIndexes }) {
  if (typeof getXlsx !== 'function') throw new Error('getXlsx dependency is required.');
  if (!store?.persistDataset || !store?.getRows) throw new Error('dataset store dependency is required.');
  if (typeof prepareDataset !== 'function' || typeof buildSearchCorpus !== 'function' || typeof searchCorpusIndexes !== 'function') {
    throw new Error('dataset normalization/search dependencies are required.');
  }
  const sources = new Map();
  const datasets = new Map();

  async function finalizeDataset(source, rawRows, sheetName = '') {
    const prepared = prepareDataset(source.masterKey, rawRows, source.currentMap, source.config, source.fieldMapOverride);
    source.datasetRevision = Number(source.datasetRevision || 0) + 1;
    const metadata = {
      datasetId: datasetIdFor(source.jobId, source.masterKey, sheetName, source.datasetRevision),
      datasetRevision: source.datasetRevision,
      jobId: source.jobId,
      masterKey: source.masterKey,
      fileName: source.fileName,
      sheetName,
      rowCount: prepared.rows.length,
      fieldMap: prepared.fieldMap,
      sourceType: 'worker-import',
      config: source.config,
      currentMap: source.currentMap,
      fieldMapOverride: source.fieldMapOverride,
    };
    datasets.set(metadata.datasetId, {
      metadata,
      rows: prepared.rows,
      rawRows,
      searchCorpus: prepared.searchCorpus,
    });
    await store.persistDataset(publicMetadata(metadata), prepared.rows);
    return {
      metadata: publicMetadata(metadata),
      previewRows: prepared.rows.slice(0, MASTER_DATASET_PREVIEW_ROWS),
      mappingRows: rawRows.slice(0, MASTER_DATASET_PREVIEW_ROWS),
    };
  }

  async function openSource(message) {
    const source = {
      jobId: message.jobId,
      fileName: message.fileName,
      masterKey: message.masterKey,
      buffer: message.buffer,
      config: message.config || {},
      currentMap: message.currentMap || {},
      fieldMapOverride: message.fieldMapOverride || null,
      datasetRevision: 0,
    };
    if (!(source.buffer instanceof ArrayBuffer)) throw new Error('OPEN_SOURCE requires a transferred ArrayBuffer.');
    sources.set(source.jobId, source);
    if (sourceNeedsSheetSelection(source.fileName)) {
      const sheetNames = listWorkbookSheets(source.buffer, await getXlsx());
      source.sheetNames = sheetNames;
      return response(MASTER_DATASET_EVENT.SHEETS, message.requestId, { jobId: source.jobId, sheetNames });
    }
    const rows = parseTextSource(source.buffer, source.fileName, source.masterKey);
    return response(MASTER_DATASET_EVENT.DATASET_READY, message.requestId, await finalizeDataset(source, rows));
  }

  async function selectSheet(message) {
    const source = sources.get(message.jobId);
    if (!source) throw new Error(`Unknown import job: ${message.jobId}`);
    if (!source.sheetNames?.includes(message.sheetName)) throw new Error(`Unknown worksheet: ${message.sheetName}`);
    const rows = parseWorkbookSheet(source.buffer, message.sheetName, await getXlsx());
    return response(MASTER_DATASET_EVENT.DATASET_READY, message.requestId, await finalizeDataset(source, rows, message.sheetName));
  }

  async function ensureDataset(datasetId) {
    if (datasets.has(datasetId)) return datasets.get(datasetId);
    const metadata = await store.getMetadata?.(datasetId);
    const rows = await store.getRows(datasetId);
    if (!metadata || !rows) throw new Error(`Unknown dataset: ${datasetId}`);
    const dataset = { metadata, rows, rawRows: null, searchCorpus: buildSearchCorpus(rows) };
    datasets.set(datasetId, dataset);
    return dataset;
  }

  async function search(message) {
    const dataset = await ensureDataset(message.datasetId);
    const indexes = searchCorpusIndexes(dataset.searchCorpus, message.query);
    return response(MASTER_DATASET_EVENT.SEARCH_RESULT, message.requestId, {
      datasetId: message.datasetId,
      query: String(message.query || ''),
      indexes,
      matchCount: indexes.length,
    });
  }

  async function rowsResult(message, raw = false) {
    const dataset = await ensureDataset(message.datasetId);
    const sourceRows = raw ? dataset.rawRows : dataset.rows;
    if (raw && !Array.isArray(sourceRows)) throw new Error(`Raw rows are session-only and unavailable for dataset: ${message.datasetId}`);
    const offset = Math.max(0, Number(message.offset) || 0);
    const limit = Math.max(1, Math.min(MASTER_DATASET_CHUNK_ROWS, Number(message.limit) || MASTER_DATASET_PREVIEW_ROWS));
    return response(MASTER_DATASET_EVENT.ROWS_RESULT, message.requestId, {
      datasetId: message.datasetId,
      offset,
      raw,
      rows: sourceRows.slice(offset, offset + limit),
      rowCount: sourceRows.length,
    });
  }

  async function release(message) {
    if (message.jobId) sources.delete(message.jobId);
    if (message.datasetId) datasets.delete(message.datasetId);
    return response(MASTER_DATASET_EVENT.RELEASED, message.requestId, { jobId: message.jobId, datasetId: message.datasetId });
  }

  async function handle(message) {
    assertCommandEnvelope(message);
    switch (message.type) {
      case MASTER_DATASET_COMMAND.OPEN_SOURCE: return openSource(message);
      case MASTER_DATASET_COMMAND.SELECT_SHEET: return selectSheet(message);
      case MASTER_DATASET_COMMAND.SEARCH: return search(message);
      case MASTER_DATASET_COMMAND.GET_ROWS: return rowsResult(message, false);
      case MASTER_DATASET_COMMAND.GET_RAW_ROWS: return rowsResult(message, true);
      case MASTER_DATASET_COMMAND.RELEASE_SOURCE:
      case MASTER_DATASET_COMMAND.RELEASE_DATASET: return release(message);
      default: throw new Error(`Unsupported worker command: ${message.type}`);
    }
  }

  return Object.freeze({ handle });
}
