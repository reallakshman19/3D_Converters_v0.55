import { createMasterDatasetImportCoordinator } from '../workers/master-dataset-import-coordinator.js?v=20260929-pr780-bounded-ui-1';

export const masterDatasetCoordinator = createMasterDatasetImportCoordinator();

export function searchMasterDatasetRows(masterKey, datasetId, query) {
  return masterDatasetCoordinator.search(masterKey, query, datasetId);
}

export function getMasterDatasetRows(masterKey, datasetId, offset = 0, limit = 150) {
  return masterDatasetCoordinator.getRows(masterKey, offset, limit, datasetId);
}

export function getMasterDatasetRowsByIndexes(masterKey, datasetId, indexes = []) {
  return masterDatasetCoordinator.getRowsByIndexes(masterKey, indexes, datasetId);
}


export async function materializeMasterDatasetRows(masterKey, datasetRef = {}) {
  const datasetId = String(datasetRef?.datasetId || '');
  const rowCount = Math.max(0, Number(datasetRef?.rowCount) || 0);
  if (!datasetId) throw new Error(`Dataset id is required to materialize ${masterKey}.`);
  const result = await masterDatasetCoordinator.materializeRows(masterKey, rowCount, datasetId);
  return Array.isArray(result?.rows) ? result.rows : [];
}
