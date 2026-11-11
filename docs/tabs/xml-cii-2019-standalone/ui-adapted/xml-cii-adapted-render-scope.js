const MASTER_KEYS = Object.freeze(['lineList', 'pipingClass', 'materialMap', 'weight']);
const DRAFT_ONLY_TOP_LEVEL_KEYS = new Set(['masterContext', 'importMastersWriteBackStatus']);

function sameTopLevelOutsideDraft(previous, next) {
  const keys = new Set([...Object.keys(previous || {}), ...Object.keys(next || {})]);
  for (const key of keys) {
    if (DRAFT_ONLY_TOP_LEVEL_KEYS.has(key)) continue;
    if (previous?.[key] !== next?.[key]) return false;
  }
  return true;
}

const MASTER_ROW_KEYS = Object.freeze({
  lineList: 'lineRows',
  pipingClass: 'pipingClassRows',
  materialMap: 'materialMapRows',
  weight: 'weightMasterRows',
});

function datasetIdentity(context, key) {
  const ref = context?.datasetRefs?.[key];
  if (!ref?.datasetId) return '';
  return [
    String(ref.datasetId),
    Number(ref.rowCount || context?.rowCounts?.[key] || 0),
    String(ref.fileName || ''),
    String(ref.sheetName || ''),
    String(ref.persistence || ''),
  ].join('|');
}

function sameMasterRows(previous, next) {
  for (const key of MASTER_KEYS) {
    const previousDataset = datasetIdentity(previous, key);
    const nextDataset = datasetIdentity(next, key);
    if (previousDataset || nextDataset) {
      if (!previousDataset || previousDataset !== nextDataset) return false;
      if (Number(previous?.rowCounts?.[key] || 0) !== Number(next?.rowCounts?.[key] || 0)) return false;
    } else {
      const rowsKey = MASTER_ROW_KEYS[key];
      if (previous?.[rowsKey] !== next?.[rowsKey]) return false;
      if (previous?.rawRows?.[key] !== next?.rawRows?.[key]) return false;
    }
    if (Number(previous?.appliedMappingRevision?.[key] || 0) !== Number(next?.appliedMappingRevision?.[key] || 0)) return false;
  }
  return true;
}

function sameMasterAuthority(previous, next) {
  if (!previous || !next) return false;
  if (previous.config !== next.config) return false;
  if (!sameMasterRows(previous, next)) return false;
  for (const key of ['sourceMetadata', 'rowCounts', 'previewRows', 'sheetNames', 'activeSheet', 'workbookData', 'diagnostics', 'diagnosticsByMaster']) {
    if (previous?.[key] !== next?.[key]) return false;
  }
  return true;
}

function draftFingerprint(value) {
  if (!value) return '';
  return JSON.stringify({
    fieldMap: value.fieldMap || {},
    dirty: value.dirty === true,
    basisAppliedRevision: Number(value.basisAppliedRevision || 0),
  });
}

function changedDraftKeys(previous, next) {
  const previousDrafts = previous?.masterContext?.mappingDrafts || {};
  const nextDrafts = next?.masterContext?.mappingDrafts || {};
  return MASTER_KEYS.filter((key) => draftFingerprint(previousDrafts[key]) !== draftFingerprint(nextDrafts[key]));
}

export function classifyXmlCiiRenderScope(previous, next) {
  if (!previous || !next) return { kind: 'full', reason: 'initial-render' };
  if (!sameTopLevelOutsideDraft(previous, next)) return { kind: 'full', reason: 'top-level-authority-change' };
  if (!sameMasterAuthority(previous.masterContext, next.masterContext)) return { kind: 'full', reason: 'master-authority-change' };

  const changed = changedDraftKeys(previous, next);
  if (changed.length !== 1) return { kind: 'full', reason: changed.length ? 'multi-draft-change' : 'no-draft-change' };
  const masterKey = changed[0];
  if (next.activePhaseId !== 'source' || next.activeSubTabId !== masterKey) {
    return { kind: 'full', reason: 'draft-target-not-visible' };
  }
  return { kind: 'master-draft', masterKey };
}

export const XML_CII_RENDER_MASTER_KEYS = MASTER_KEYS;
