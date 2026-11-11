export const MASTER_DATASET_COMMAND = Object.freeze({
  OPEN_SOURCE: 'OPEN_SOURCE',
  SELECT_SHEET: 'SELECT_SHEET',
  REMAP_DATASET: 'REMAP_DATASET',
  RETRY_PERSISTENCE: 'RETRY_PERSISTENCE',
  SEARCH: 'SEARCH',
  RANK_WEIGHT_ISSUES: 'RANK_WEIGHT_ISSUES',
  PREPARE_WEIGHT_BASIS: 'PREPARE_WEIGHT_BASIS',
  GET_ROWS: 'GET_ROWS',
  GET_ROWS_BY_INDEXES: 'GET_ROWS_BY_INDEXES',
  GET_RAW_ROWS: 'GET_RAW_ROWS',
  RELEASE_SOURCE: 'RELEASE_SOURCE',
  RELEASE_DATASET: 'RELEASE_DATASET',
});

export const MASTER_DATASET_EVENT = Object.freeze({
  SHEETS: 'SHEETS',
  DATASET_READY: 'DATASET_READY',
  PERSISTENCE_RESULT: 'PERSISTENCE_RESULT',
  SEARCH_RESULT: 'SEARCH_RESULT',
  WEIGHT_MATCH_RESULT: 'WEIGHT_MATCH_RESULT',
  WEIGHT_BASIS_PROGRESS: 'WEIGHT_BASIS_PROGRESS',
  WEIGHT_BASIS_RESULT: 'WEIGHT_BASIS_RESULT',
  ROWS_RESULT: 'ROWS_RESULT',
  RELEASED: 'RELEASED',
  ERROR: 'ERROR',
});

export const MASTER_DATASET_PREVIEW_ROWS = 150;
export const MASTER_DATASET_CHUNK_ROWS = 2000;

export function isWorkbookFile(fileName) {
  return /\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(String(fileName || ''));
}

export function makeRequestId(prefix = 'req') {
  const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `${prefix}-${Date.now()}-${random}`;
}

export function assertCommandEnvelope(message) {
  if (!message || typeof message !== 'object') throw new Error('Worker command must be an object.');
  if (!message.type || typeof message.type !== 'string') throw new Error('Worker command type is required.');
  if (!message.requestId || typeof message.requestId !== 'string') throw new Error('Worker requestId is required.');
  return message;
}

export function serializeWorkerError(error) {
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'Unknown worker error'),
    stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 8).join('\n') : '',
  };
}
