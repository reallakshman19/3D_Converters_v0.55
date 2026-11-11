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
