import { materializeMasterDatasetRows } from './ui-adapted/xml-cii-adapted-master-dataset-runtime.js?v=20261007-c05-6-2-consumer-authority-1';

const MASTER_DATASET_CONFIG_DEFS = Object.freeze({
  lineList: Object.freeze({ configKey: 'linelist', rowsProperty: 'masterRows', contextRowsKey: 'lineRows' }),
  pipingClass: Object.freeze({ configKey: 'pipingClass', rowsProperty: 'masterRows', contextRowsKey: 'pipingClassRows' }),
  materialMap: Object.freeze({ configKey: 'material', rowsProperty: 'mapRows', contextRowsKey: 'materialMapRows' }),
  weight: Object.freeze({ configKey: 'weight', rowsProperty: 'masterRows', contextRowsKey: 'weightMasterRows' }),
});

function safeConfig(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function residentRows(context, def, expected) {
  const rows = Array.isArray(context?.[def.contextRowsKey]) ? context[def.contextRowsKey] : [];
  if (!rows.length) return null;
  if (expected > 0 && rows.length !== expected) return null;
  return rows;
}

export async function materializeXmlCiiDatasetBackedConfig(config, state, options = {}) {
  const next = { ...safeConfig(config) };
  const context = state?.masterContext || {};
  const refs = context.datasetRefs || {};
  const materializeRows = options.materializeRows || materializeMasterDatasetRows;

  for (const [masterKey, def] of Object.entries(MASTER_DATASET_CONFIG_DEFS)) {
    const ref = refs?.[masterKey];
    if (!ref?.datasetId) continue;
    const expected = Math.max(0, Number(ref.rowCount) || 0);
    let rows = residentRows(context, def, expected);
    if (!rows) rows = await materializeRows(masterKey, ref);
    if (!Array.isArray(rows) || rows.length !== expected) {
      throw new Error(`Dataset-backed ${masterKey} materialization mismatch: expected ${expected}, received ${Array.isArray(rows) ? rows.length : 0}.`);
    }

    const section = { ...safeConfig(next[def.configKey]), [def.rowsProperty]: rows };
    if (!section.fieldMap && ref.fieldMap) section.fieldMap = { ...ref.fieldMap };
    if (masterKey === 'weight') {
      const revision = Number(context?.appliedMappingRevision?.weight ?? section.masterRevision ?? 0);
      if (revision > 0) section.masterRevision = revision;
      if (ref.masterFingerprint) section.masterFingerprint = String(ref.masterFingerprint);
    }
    next[def.configKey] = section;
  }

  return next;
}

export const XML_CII_DATASET_CONFIG_DEFS = MASTER_DATASET_CONFIG_DEFS;
