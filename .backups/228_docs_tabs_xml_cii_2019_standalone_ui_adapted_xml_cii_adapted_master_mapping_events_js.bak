import { MASTER_FIELDS } from './xml-cii-adapted-fields-config.js';
import { detectLineListFieldMap, normalizeLineListRow } from '../../../converters/xml-cii2019-core/linelist-mapping.js';
import { prepareStandaloneImportMasters } from '../xml-cii-master-context.js';
import {
  applyStandaloneImportMastersContext, updateWorkflowState, getSavedMappingsForMaster,
  saveMappingForFile, findSmartMatchingMapping, getStoredJson,
} from './xml-cii-adapted-state.js';
import { fuzzyAutoMapFields } from './xml-cii-adapted-fuzzy-mapper.js';
import {
  MASTER_DEF_MAP, appliedFieldMap, clearPersistedMaster, commitAppliedMaster,
  discardMasterMappingDraft, effectiveDraftFieldMap, ensureMasterRuntime,
  masterMappingStatus, persistChangedMasterDetailed, readSupportConfigOnce,
  stageMasterMappingDraft,
} from './xml-cii-adapted-master-runtime.js';
import { perfAddMs, perfCount, perfNow, requestMeasuredFullRender } from './xml-cii-adapted-perf.js';

export function masterConfigForState(stateRef) {
  return stateRef.current.masterContext?.config || readSupportConfigOnce(stateRef.current);
}

function headersFromRows(rows) {
  const row = Array.isArray(rows) ? rows.find(Boolean) : null;
  return row ? Object.keys(row).filter((key) => key !== '_rowIndex') : [];
}

export function autoMapStandaloneMasterFields(masterKey, rawRows, currentMap = {}, config = {}) {
  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const fuzzyMap = fuzzyAutoMapFields(headersFromRows(rawRows), fields, rawRows);
  if (masterKey !== 'lineList') return fuzzyMap;
  const governed = detectLineListFieldMap(rawRows, currentMap || {}, config?.linelist || config || null);
  const merged = { ...fuzzyMap, ...governed };
  for (const field of fields) if (!(field.name in merged)) merged[field.name] = fuzzyMap[field.name] || '';
  return merged;
}

export function rawRowsForMaster(stateRef, key) {
  const current = stateRef.current.masterContext?.rawRows?.[key];
  if (Array.isArray(current) && current.length) return current;
  return getStoredJson(`xml-cii-master-raw-${key}`, []);
}

function stageMapping(stateRef, key, fieldMap, statusMessage) {
  const context = stageMasterMappingDraft(
    stateRef.current.masterContext || {}, masterConfigForState(stateRef), key, fieldMap,
  );
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: context, importMastersWriteBackStatus: statusMessage,
  });
}

function mappingStatusText(status) {
  return status.dirty
    ? `Mapping status: MODIFIED — NOT APPLIED. Current calculation basis: Applied mapping revision ${status.revision}. Preview uses applied mapping revision ${status.revision}.`
    : `Mapping status: APPLIED. Revision: ${status.revision}. Preview uses applied mapping revision ${status.revision}.`;
}

function refreshMappingCustodyDom(container, stateRef, key) {
  const status = masterMappingStatus(stateRef.current.masterContext || {}, masterConfigForState(stateRef), key);
  const node = container.querySelector(`[data-master-mapping-status="${key}"]`);
  if (node) node.textContent = mappingStatusText(status);
  for (const action of ['apply-master-mapping', 'discard-master-mapping']) {
    const button = container.querySelector(`[data-action="${action}"][data-master-key="${key}"]`);
    if (button) button.disabled = !status.dirty;
  }
}

export function masterPersistenceStatus(baseMessage, persistence) {
  if (persistence.failures.length) {
    const restart = persistence.normalizedPersisted ? 'core rows were saved' : 'restart persistence was not saved';
    const cause = persistence.quotaLimited ? 'browser storage quota' : 'browser storage error';
    return `${baseMessage} Active session is usable; persistence is limited by ${cause} (${restart}).`;
  }
  if (persistence.indexedDbBacked) return `${baseMessage} Large dataset persisted in IndexedDB.`;
  if (persistence.compact) return `${baseMessage} Browser persistence uses compact mode; raw workbook copies remain session-only.`;
  return baseMessage;
}

function applyFieldMapToContext(stateRef, key, fieldMap, rawRows, statusMessage, sourceMetadata = null) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const normalizeStart = perfNow();
  const normalized = mapRowsWithFieldMap(rows, fieldMap, key);
  perfAddMs('masterNormalizeMs', perfNow() - normalizeStart);
  perfCount('masterRowsNormalized', rows.length);
  const committed = commitAppliedMaster({
    context: stateRef.current.masterContext || {}, config: masterConfigForState(stateRef),
    key, fieldMap, rawRows: rows, normalizedRows: normalized, sourceMetadata,
  });
  const persistence = persistChangedMasterDetailed(key, committed.context);
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: committed.context,
    supportConfigJson: JSON.stringify(committed.config, null, 2),
    importMastersLoading: false,
    importMastersWriteBackStatus: masterPersistenceStatus(statusMessage, persistence),
  });
  return { ...committed, persistence };
}

function applyCurrentDraft(stateRef, key) {
  const rows = rawRowsForMaster(stateRef, key);
  if (!rows.length) throw new Error(`No ${key} source rows are loaded.`);
  const map = effectiveDraftFieldMap(stateRef.current.masterContext || {}, masterConfigForState(stateRef), key);
  perfCount('masterMappingApplyCount');
  return applyFieldMapToContext(stateRef, key, map, rows, `Applied ${key} mapping. Downstream basis advanced exactly once.`);
}

function bindAutoMapEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="auto-map-master-fields"]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.masterKey;
      const rows = rawRowsForMaster(stateRef, key);
      if (!rows.length) return alert('Please import rows/file before auto-mapping fields.');
      const config = masterConfigForState(stateRef);
      const current = effectiveDraftFieldMap(stateRef.current.masterContext || {}, config, key);
      stageMapping(stateRef, key, autoMapStandaloneMasterFields(key, rows, current, config),
        `Auto-mapped ${key} into a draft. No calculation basis changed.`);
      requestMeasuredFullRender(render);
    });
  });
}

function bindSaveMappingEvents(container, stateRef) {
  container.querySelectorAll('[data-action="save-master-mapping"]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.masterKey;
      const filename = stateRef.current.masterContext?.sourceMetadata?.[key]?.source;
      if (!filename || ['LocalStorage', 'not-loaded'].includes(filename)) return alert('Please import a master file first before saving the mapping.');
      const map = appliedFieldMap(stateRef.current.masterContext || {}, masterConfigForState(stateRef), key);
      if (!Object.keys(map).length) return alert('No applied mappings configured to save.');
      saveMappingForFile(key, filename, map);
      showToast(`Saved applied column mapping for: ${filename}`);
    });
  });
}

function bindSavedMappingEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="apply-saved-mapping"]').forEach((select) => {
    select.addEventListener('change', () => {
      const key = select.dataset.masterKey;
      if (!select.value) return;
      if (!rawRowsForMaster(stateRef, key).length) { select.value = ''; return alert('Please load a file first.'); }
      const map = getSavedMappingsForMaster(key)[select.value];
      if (!map) return;
      stageMapping(stateRef, key, map, `Staged saved mapping from ${select.value}. It is NOT APPLIED.`);
      requestMeasuredFullRender(render);
    });
  });
}

function bindDraftCommitEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="apply-master-mapping"]').forEach((button) => {
    button.addEventListener('click', () => {
      try { applyCurrentDraft(stateRef, button.dataset.masterKey); requestMeasuredFullRender(render); }
      catch (error) { alert(error?.message || String(error)); }
    });
  });
  container.querySelectorAll('[data-action="discard-master-mapping"]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.masterKey;
      const context = discardMasterMappingDraft(stateRef.current.masterContext || {}, key);
      stateRef.current = updateWorkflowState(stateRef.current, {
        masterContext: context,
        importMastersWriteBackStatus: `Discarded ${key} mapping draft. Applied calculation basis is unchanged.`,
      });
      requestMeasuredFullRender(render);
    });
  });
}

export function bindMasterMappingEvents(container, stateRef, render) {
  container.querySelectorAll('[data-master-field-map]').forEach((select) => {
    select.addEventListener('change', () => {
      updateMasterFieldMap(stateRef, select.dataset.masterKey, select.dataset.masterFieldMap, select.value);
      refreshMappingCustodyDom(container, stateRef, select.dataset.masterKey);
    });
  });
  bindAutoMapEvents(container, stateRef, render);
  bindSaveMappingEvents(container, stateRef);
  bindSavedMappingEvents(container, stateRef, render);
  bindDraftCommitEvents(container, stateRef, render);
}

export async function loadImportMastersFromUi(stateRef, render) {
  if (stateRef.current.importMastersLoading) return;
  stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: true });
  try {
    const masterContext = await prepareStandaloneImportMasters({ supportConfigJson: stateRef.current.supportConfigJson });
    stateRef.current = applyStandaloneImportMastersContext(stateRef.current, masterContext);
  } catch (error) {
    stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: false, importMastersWriteBackStatus: error?.message || String(error) });
  }
  requestMeasuredFullRender(render);
}

export function mapRowsWithFieldMap(rawRows, fieldMap, masterKey) {
  if (masterKey === 'lineList') return (rawRows || []).map((row, index) => normalizeLineListRow(row, fieldMap, index));
  return (rawRows || []).map((row, index) => {
    const result = { ...row, _rowIndex: row?._rowIndex || index + 1 };
    for (const [fieldName, sourceHeader] of Object.entries(fieldMap || {})) result[fieldName] = sourceHeader ? (row?.[sourceHeader] ?? '') : '';
    return result;
  });
}

export function importMasterRows(stateRef, key, rawRows, filename, render) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  stateRef.current = updateWorkflowState(stateRef.current, { masterContext: context });
  const config = masterConfigForState(stateRef);
  const saved = getSavedMappingsForMaster(key);
  const matchedKey = findSmartMatchingMapping(filename, Object.keys(saved));
  const fieldMap = matchedKey ? saved[matchedKey] : autoMapStandaloneMasterFields(key, rows, appliedFieldMap(context, config, key), config);
  perfCount('masterImportCount');
  const sourceMetadata = { key, source: filename, sourceType: 'manual', status: rows.length ? 'loaded' : 'empty', rowCount: rows.length };
  applyFieldMapToContext(stateRef, key, fieldMap, rows,
    matchedKey ? `Imported ${filename} (${rows.length} rows) using saved mapping from ${matchedKey}.` : `Imported and auto-mapped ${filename} (${rows.length} rows) into ${key}.`,
    sourceMetadata);
  requestMeasuredFullRender(render);
}

export function updateMasterFieldMap(stateRef, key, fieldName, selectedValue) {
  if (!rawRowsForMaster(stateRef, key).length) return;
  const config = masterConfigForState(stateRef);
  const fieldMap = effectiveDraftFieldMap(stateRef.current.masterContext || {}, config, key);
  fieldMap[fieldName] = selectedValue;
  stageMapping(stateRef, key, fieldMap, `Draft mapping changed for ${key}.${fieldName}. Applied calculation basis is unchanged.`);
}

export function clearMasterContextFromUi(stateRef, render) {
  for (const key of Object.keys(MASTER_DEF_MAP)) clearPersistedMaster(key);
  const config = masterConfigForState(stateRef);
  if (config.linelist) delete config.linelist.masterRows;
  if (config.pipingClass) delete config.pipingClass.masterRows;
  if (config.material) delete config.material.mapRows;
  if (config.weight) delete config.weight.masterRows;
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: null, supportConfigJson: JSON.stringify(config, null, 2), importMastersWriteBackStatus: 'Master context cleared.',
  });
  requestMeasuredFullRender(render);
}

function showToast(message) {
  const node = document.createElement('div');
  node.textContent = message;
  Object.assign(node.style, { position: 'fixed', bottom: '24px', right: '24px', background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '8px', zIndex: '9999' });
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}
