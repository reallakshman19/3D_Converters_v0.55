import { createMasterDatasetImportCoordinator } from '../workers/master-dataset-import-coordinator.js?v=20260929-pr780-worker-search-1';

export const masterDatasetCoordinator = createMasterDatasetImportCoordinator();

export function searchMasterDatasetRows(masterKey, datasetId, query) {
  return masterDatasetCoordinator.search(masterKey, query, datasetId);
}
