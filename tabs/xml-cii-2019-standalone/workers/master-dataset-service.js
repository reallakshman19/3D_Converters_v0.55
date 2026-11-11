import { MASTER_DATASET_COMMAND, MASTER_DATASET_EVENT, MASTER_DATASET_PREVIEW_ROWS, MASTER_DATASET_CHUNK_ROWS, assertCommandEnvelope } from './master-dataset-protocol.js?v=20261006-c05-5-5-persistence-retry-1';
import { rankXmlCiiWeightIssues } from '../../../converters/xml-cii2019-core/weight-match-ranking-service.js?v=20261001-weight-rating-1';
import { listWorkbookSheets, parseTextSource, parseWorkbookSheet, parseWorkbookSheetSample, sourceNeedsSheetSelection } from './master-dataset-parser.js';
import { suggestWorkbookSheet } from './master-dataset-sheet-selector.js';
import { xmlCiiWeightMasterRowsFingerprint } from '../../../converters/xml-cii2019-core/rigid-weight-authority.js';
import { recoverMasterDatasetRawRows } from './master-dataset-remap-custody.js?v=20260930-issue781-linelist-integration-2';
import { prepareXmlCiiWeightBasis } from './weight-basis-service.js?v=20261001-weight-output-2';

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

function quotaLike(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || error || '');
  return /QuotaExceededError/i.test(name) || /quota|storage.*full|database.*full/i.test(message);
}

function persistenceFailure(error) {
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Unknown IndexedDB persistence error'),
  };
}

export function createMasterDatasetService({ getXlsx, store, prepareDataset, buildSearchCorpus, searchCorpusIndexes, emitEvent = null }) {
  if (typeof getXlsx !== 'function') throw new Error('getXlsx dependency is required.');
  if (!store?.persistDataset || !store?.getRows) throw new Error('dataset store dependency is required.');
  if (typeof prepareDataset !== 'function' || typeof buildSearchCorpus !== 'function' || typeof searchCorpusIndexes !== 'function') {
    throw new Error('dataset normalization/search dependencies are required.');
  }
  const sources = new Map();
  const datasets = new Map();

  async function finalizeDataset(source, rawRows, sheetName = '') {
    const prepared = prepareDataset(source.masterKey, rawRows, source.currentMap, source.config, source.fieldMapOverride);
    let nextRevision = Number(source.datasetRevision || 0) + 1;
    while (datasets.has(datasetIdFor(source.jobId, source.masterKey, sheetName, nextRevision))) nextRevision += 1;
    source.datasetRevision = nextRevision;
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
      ...(source.masterKey === 'weight' ? { masterFingerprint: xmlCiiWeightMasterRowsFingerprint(prepared.rows) } : {}),
    };
    const mappingRows = rawRows.slice(0, MASTER_DATASET_PREVIEW_ROWS);
    datasets.set(metadata.datasetId, {
      metadata,
      rows: prepared.rows,
      rawRows,
      mappingRows,
      searchCorpus: prepared.searchCorpus,
    });
    let persistence;
    metadata.persistenceMode = 'indexeddb';
    try {
      await store.persistDataset({ ...publicMetadata(metadata), mappingRows }, prepared.rows);
      persistence = { persisted: true, failure: null, quotaLimited: false };
    } catch (error) {
      metadata.persistenceMode = 'session';
      persistence = {
        persisted: false,
        failure: persistenceFailure(error),
        quotaLimited: quotaLike(error),
      };
    }
    return {
      metadata: publicMetadata(metadata),
      previewRows: prepared.rows.slice(0, MASTER_DATASET_PREVIEW_ROWS),
      mappingRows,
      persistence,
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
      const xlsx = await getXlsx();
      const sheetNames = listWorkbookSheets(source.buffer, xlsx);
      source.sheetNames = sheetNames;
      if (source.masterKey === 'lineList') {
        const suggestion = suggestWorkbookSheet({
          masterKey: source.masterKey,
          sheetNames,
          sampleSheet: (sheetName, sampleRows) => parseWorkbookSheetSample(source.buffer, sheetName, xlsx, sampleRows),
          prepareDataset,
          currentMap: source.currentMap,
          config: source.config,
          fieldMapOverride: source.fieldMapOverride,
        });
        source.suggestedSheet = suggestion.sheetName;
        return response(MASTER_DATASET_EVENT.SHEETS, message.requestId, {
          jobId: source.jobId,
          sheetNames,
          suggestedSheet: suggestion.sheetName,
          suggestionBasis: suggestion.basis,
          suggestionScore: suggestion.score,
          suggestionEvidence: suggestion.evidence,
          sampledRows: suggestion.sampledRows,
        });
      }
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

  async function remapDataset(message) {
    const dataset = await ensureDataset(message.datasetId);
    const rawRows = recoverMasterDatasetRawRows(dataset);
    if (!rawRows) {
      throw new Error(`Raw rows are unavailable for dataset remap: ${message.datasetId}`);
    }
    if (!message.fieldMap || typeof message.fieldMap !== 'object' || Array.isArray(message.fieldMap)) {
      throw new Error('REMAP_DATASET requires a fieldMap object.');
    }
    const base = dataset.metadata || {};
    const source = sources.get(base.jobId) || {
      jobId: base.jobId,
      fileName: base.fileName,
      masterKey: base.masterKey,
      config: base.config || {},
      currentMap: base.currentMap || {},
      fieldMapOverride: null,
      datasetRevision: Number(base.datasetRevision || 0),
    };
    source.datasetRevision = Math.max(Number(source.datasetRevision || 0), Number(base.datasetRevision || 0));
    source.fieldMapOverride = { ...message.fieldMap };
    const ready = await finalizeDataset(source, rawRows, base.sheetName || '');
    return response(MASTER_DATASET_EVENT.DATASET_READY, message.requestId, ready);
  }

  async function retryPersistence(message) {
    const dataset = await ensureDataset(message.datasetId);
    const metadata = dataset.metadata || {};
    const mappingRows = Array.isArray(dataset.mappingRows)
      ? dataset.mappingRows
      : (Array.isArray(metadata.mappingRows) ? metadata.mappingRows : []);
    try {
      metadata.persistenceMode = 'indexeddb';
      await store.persistDataset({ ...publicMetadata(metadata), mappingRows }, dataset.rows);
      return response(MASTER_DATASET_EVENT.PERSISTENCE_RESULT, message.requestId, {
        datasetId: metadata.datasetId,
        metadata: publicMetadata(metadata),
        previewRows: dataset.rows.slice(0, MASTER_DATASET_PREVIEW_ROWS),
        mappingRows,
        persistence: { persisted: true, failure: null, quotaLimited: false },
      });
    } catch (error) {
      metadata.persistenceMode = 'session';
      return response(MASTER_DATASET_EVENT.PERSISTENCE_RESULT, message.requestId, {
        datasetId: metadata.datasetId,
        metadata: publicMetadata(metadata),
        previewRows: dataset.rows.slice(0, MASTER_DATASET_PREVIEW_ROWS),
        mappingRows,
        persistence: {
          persisted: false,
          failure: persistenceFailure(error),
          quotaLimited: quotaLike(error),
        },
      });
    }
  }

  async function ensureDataset(datasetId) {
    if (datasets.has(datasetId)) return datasets.get(datasetId);
    const metadata = await store.getMetadata?.(datasetId);
    const rows = await store.getRows(datasetId);
    if (!metadata || !rows) throw new Error(`Unknown dataset: ${datasetId}`);
    const dataset = {
      metadata,
      rows,
      rawRows: null,
      mappingRows: Array.isArray(metadata.mappingRows) ? metadata.mappingRows : [],
      searchCorpus: buildSearchCorpus(rows),
    };
    datasets.set(datasetId, dataset);
    return dataset;
  }

  function emitWeightBasisProgress(requestId, detail = {}) {
    if (typeof emitEvent !== 'function') return;
    emitEvent(response(MASTER_DATASET_EVENT.WEIGHT_BASIS_PROGRESS, requestId, detail));
  }

  async function prepareWeightBasis(message) {
    emitWeightBasisProgress(message.requestId, { stage: 'using-preview-authority' });
    const compactConfig = message.config && typeof message.config === 'object'
      ? message.config
      : {};
    const result = await prepareXmlCiiWeightBasis({
      xmlText: message.xmlText || '',
      stagedJsonText: message.stagedJsonText || '',
      config: compactConfig,
      geometryConfig: compactConfig,
      ratingMode: message.ratingMode || 'preview',
      previewRatingSnapshot: message.previewRatingSnapshot || {},
      onProgress: (detail) => emitWeightBasisProgress(message.requestId, detail),
    });
    return response(MASTER_DATASET_EVENT.WEIGHT_BASIS_RESULT, message.requestId, result);
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
      masterKey: String(dataset?.metadata?.masterKey || ''),
      datasetRevision: Number(dataset?.metadata?.datasetRevision || 0),
      masterFingerprint: String(dataset?.metadata?.masterFingerprint || ''),
      offset,
      raw,
      rows: sourceRows.slice(offset, offset + limit),
      rowCount: sourceRows.length,
    });
  }

  async function indexedRowsResult(message) {
    const dataset = await ensureDataset(message.datasetId);
    const requested = Array.isArray(message.indexes) ? message.indexes.slice(0, MASTER_DATASET_CHUNK_ROWS) : [];
    const indexes = [];
    const rows = [];
    for (const value of requested) {
      const index = Number(value);
      if (!Number.isInteger(index) || index < 0 || index >= dataset.rows.length) continue;
      indexes.push(index);
      rows.push(dataset.rows[index]);
    }
    return response(MASTER_DATASET_EVENT.ROWS_RESULT, message.requestId, {
      datasetId: message.datasetId,
      masterKey: String(dataset?.metadata?.masterKey || ''),
      datasetRevision: Number(dataset?.metadata?.datasetRevision || 0),
      masterFingerprint: String(dataset?.metadata?.masterFingerprint || ''),
      indexes,
      rows,
      rowCount: dataset.rows.length,
      raw: false,
    });
  }

  async function rankWeightIssues(message) {
    const dataset = await ensureDataset(message.datasetId);
    if (String(dataset?.metadata?.masterKey || '') !== 'weight') {
      throw new Error(`Weight Match requires a weight dataset; received ${dataset?.metadata?.masterKey || 'unknown'}.`);
    }
    const issues = Array.isArray(message.issues) ? message.issues : [];
    if (issues.length > 5000) throw new Error(`Weight Match issue batch is too large: ${issues.length}.`);
    const baseConfig = message.config && typeof message.config === 'object' && !Array.isArray(message.config) ? message.config : {};
    const incomingWeight = baseConfig.weight && typeof baseConfig.weight === 'object' && !Array.isArray(baseConfig.weight) ? baseConfig.weight : {};
    const workerConfig = {
      ...baseConfig,
      weight: {
        ...incomingWeight,
        masterRows: dataset.rows,
        masterFingerprint: dataset.metadata?.masterFingerprint || incomingWeight.masterFingerprint || '',
        masterRevision: incomingWeight.masterRevision ?? dataset.metadata?.datasetRevision ?? 0,
      },
    };
    const rankedIssues = rankXmlCiiWeightIssues(issues, workerConfig, {
      ratingMode: message.ratingMode || 'preview',
      snapshot: message.previewRatingSnapshot || {},
    });
    return response(MASTER_DATASET_EVENT.WEIGHT_MATCH_RESULT, message.requestId, {
      datasetId: dataset.metadata.datasetId,
      rowCount: Number(dataset.metadata.rowCount || dataset.rows.length || 0),
      datasetRevision: Number(dataset.metadata.datasetRevision || 0),
      masterFingerprint: dataset.metadata.masterFingerprint || '',
      issues: rankedIssues,
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
      case MASTER_DATASET_COMMAND.REMAP_DATASET: return remapDataset(message);
      case MASTER_DATASET_COMMAND.RETRY_PERSISTENCE: return retryPersistence(message);
      case MASTER_DATASET_COMMAND.SEARCH: return search(message);
      case MASTER_DATASET_COMMAND.RANK_WEIGHT_ISSUES: return rankWeightIssues(message);
      case MASTER_DATASET_COMMAND.PREPARE_WEIGHT_BASIS: return prepareWeightBasis(message);
      case MASTER_DATASET_COMMAND.GET_ROWS: return rowsResult(message, false);
      case MASTER_DATASET_COMMAND.GET_ROWS_BY_INDEXES: return indexedRowsResult(message);
      case MASTER_DATASET_COMMAND.GET_RAW_ROWS: return rowsResult(message, true);
      case MASTER_DATASET_COMMAND.RELEASE_SOURCE:
      case MASTER_DATASET_COMMAND.RELEASE_DATASET: return release(message);
      default: throw new Error(`Unsupported worker command: ${message.type}`);
    }
  }

  return Object.freeze({ handle });
}
