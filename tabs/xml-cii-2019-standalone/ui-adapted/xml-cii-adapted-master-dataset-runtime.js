import { createMasterDatasetImportCoordinator } from '../workers/master-dataset-import-coordinator.js?v=20261007-c05-6-2-consumer-authority-1';

export const masterDatasetCoordinator = createMasterDatasetImportCoordinator();

export function searchMasterDatasetRows(masterKey, datasetId, query) {
  return masterDatasetCoordinator.search(masterKey, query, datasetId);
}

export function getMasterDatasetRows(masterKey, datasetId, offset = 0, limit = 150, datasetRef = {}) {
  return masterDatasetCoordinator.getRows(masterKey, offset, limit, datasetId, datasetRef);
}

export function getMasterDatasetRowsByIndexes(masterKey, datasetId, indexes = [], datasetRef = {}) {
  return masterDatasetCoordinator.getRowsByIndexes(masterKey, indexes, datasetId, datasetRef);
}

export function remapMasterDataset(masterKey, datasetId, fieldMap = {}) {
  return masterDatasetCoordinator.remapDataset(masterKey, datasetId, fieldMap);
}

export function rankMasterDatasetWeightIssues(masterKey, datasetId, issues = [], config = {}, options = {}) {
  return masterDatasetCoordinator.rankWeightIssues(masterKey, issues, config, options, datasetId);
}

export function prepareMasterDatasetWeightBasis(payload = {}, options = {}) {
  return masterDatasetCoordinator.prepareWeightBasis(payload, options);
}

export async function materializeMasterDatasetRows(masterKey, datasetRef = {}) {
  const datasetId = String(datasetRef?.datasetId || '');
  const rowCount = Math.max(0, Number(datasetRef?.rowCount) || 0);
  if (!datasetId) throw new Error(`Dataset id is required to materialize ${masterKey}.`);
  const result = await masterDatasetCoordinator.materializeRows(masterKey, rowCount, datasetId, datasetRef);
  return Array.isArray(result?.rows) ? result.rows : [];
}
