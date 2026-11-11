import { MASTER_DATASET_CHUNK_ROWS } from './master-dataset-protocol.js';

const DB_NAME = 'xml-cii-master-datasets-v1';
const DB_VERSION = 1;
const DATASETS = 'datasets';
const CHUNKS = 'chunks';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted.'));
  });
}

export function openMasterDatasetDatabase(indexedDBRef = globalThis.indexedDB) {
  if (!indexedDBRef?.open) throw new Error('IndexedDB is unavailable.');
  const request = indexedDBRef.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(DATASETS)) db.createObjectStore(DATASETS, { keyPath: 'datasetId' });
    if (!db.objectStoreNames.contains(CHUNKS)) db.createObjectStore(CHUNKS, { keyPath: 'key' });
  };
  return requestResult(request);
}

export function createIndexedDbDatasetStore(options = {}) {
  const indexedDBRef = options.indexedDB || globalThis.indexedDB;
  const chunkRows = Math.max(1, Number(options.chunkRows) || MASTER_DATASET_CHUNK_ROWS);
  let dbPromise = null;
  const db = () => (dbPromise ||= openMasterDatasetDatabase(indexedDBRef));

  async function persistDataset(metadata, rows) {
    const database = await db();
    const tx = database.transaction([DATASETS, CHUNKS], 'readwrite');
    tx.objectStore(DATASETS).put({ ...metadata, persistedAt: Date.now() });
    const chunkStore = tx.objectStore(CHUNKS);
    for (let offset = 0, chunkIndex = 0; offset < rows.length; offset += chunkRows, chunkIndex += 1) {
      chunkStore.put({ key: `${metadata.datasetId}:${chunkIndex}`, datasetId: metadata.datasetId, chunkIndex, rows: rows.slice(offset, offset + chunkRows) });
    }
    await transactionDone(tx);
    return metadata;
  }

  async function getMetadata(datasetId) {
    const database = await db();
    return requestResult(database.transaction(DATASETS).objectStore(DATASETS).get(datasetId));
  }

  async function getRows(datasetId) {
    const metadata = await getMetadata(datasetId);
    if (!metadata) return null;
    const database = await db();
    const tx = database.transaction(CHUNKS);
    const store = tx.objectStore(CHUNKS);
    const rows = [];
    const chunkCount = Math.ceil(Number(metadata.rowCount || 0) / chunkRows);
    for (let index = 0; index < chunkCount; index += 1) {
      const chunk = await requestResult(store.get(`${datasetId}:${index}`));
      if (Array.isArray(chunk?.rows)) rows.push(...chunk.rows);
    }
    return rows;
  }

  async function deleteDataset(datasetId) {
    const metadata = await getMetadata(datasetId);
    if (!metadata) return false;
    const database = await db();
    const tx = database.transaction([DATASETS, CHUNKS], 'readwrite');
    tx.objectStore(DATASETS).delete(datasetId);
    const chunks = tx.objectStore(CHUNKS);
    const chunkCount = Math.ceil(Number(metadata.rowCount || 0) / chunkRows);
    for (let index = 0; index < chunkCount; index += 1) chunks.delete(`${datasetId}:${index}`);
    await transactionDone(tx);
    return true;
  }

  return Object.freeze({ persistDataset, getMetadata, getRows, deleteDataset });
}
