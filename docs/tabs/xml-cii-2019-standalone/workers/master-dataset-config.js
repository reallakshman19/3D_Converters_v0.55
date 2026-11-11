const MASTER_DATASET_FIELDS = Object.freeze({
  linelist: 'masterRows',
  pipingClass: 'masterRows',
  material: 'mapRows',
  weight: 'masterRows',
});

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function compactMasterConfig(config = {}) {
  const source = object(config);
  const compact = { ...source };
  for (const [sectionName, rowsKey] of Object.entries(MASTER_DATASET_FIELDS)) {
    const section = source[sectionName];
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    const next = { ...section };
    delete next[rowsKey];
    compact[sectionName] = next;
  }
  return compact;
}

export function masterConfigDatasetFields(config = {}) {
  const source = object(config);
  const found = [];
  for (const [sectionName, rowsKey] of Object.entries(MASTER_DATASET_FIELDS)) {
    if (Array.isArray(source?.[sectionName]?.[rowsKey])) found.push(`${sectionName}.${rowsKey}`);
  }
  return found;
}

export function assertMetadataOnlyMasterConfig(config = {}) {
  const found = masterConfigDatasetFields(config);
  if (found.length) throw new Error(`Master config contains dataset arrays: ${found.join(', ')}`);
  return config;
}

export const MASTER_CONFIG_DATASET_FIELDS = MASTER_DATASET_FIELDS;
