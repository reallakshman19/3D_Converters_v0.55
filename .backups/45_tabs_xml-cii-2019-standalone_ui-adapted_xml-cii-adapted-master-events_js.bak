import { MASTER_FIELDS } from './xml-cii-adapted-fields-config.js';
import { detectLineListFieldMap, normalizeLineListRow } from '../../../converters/xml-cii2019-core/linelist-mapping.js';
import { prepareStandaloneImportMasters } from '../xml-cii-master-context.js';
import {
  applyStandaloneImportMastersContext,
  updateWorkflowState,
  updateMasterLastLoadedPath,
  getSavedMappingsForMaster,
  saveMappingForFile,
  findSmartMatchingMapping,
  getStoredJson,
} from './xml-cii-adapted-state.js';
import { fuzzyAutoMapFields } from './xml-cii-adapted-fuzzy-mapper.js';
import {
  MASTER_DEF_MAP,
  appliedFieldMap,
  clearPersistedMaster,
  commitAppliedMaster,
  discardMasterMappingDraft,
  effectiveDraftFieldMap,
  ensureMasterRuntime,
  masterMappingStatus,
  persistChangedMaster,
  readSupportConfigOnce,
  stageMasterMappingDraft,
} from './xml-cii-adapted-master-runtime.js';
import { perfAddMs, perfCount, perfNow, requestMeasuredFullRender } from './xml-cii-adapted-perf.js';

async function getXlsxModule() {
  if (typeof XLSX !== 'undefined' && typeof XLSX.read === 'function') return XLSX;
  const attempts = [
    () => import('xlsx'),
    () => import('https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs'),
  ];
  const errors = [];
  for (const load of attempts) {
    try {
      const mod = await load();
      if (mod && typeof mod.read === 'function') return mod;
      if (mod && mod.default && typeof mod.default.read === 'function') return mod.default;
      errors.push('module did not expose read/utils');
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }
  throw new Error(`XLSX parser failed to load. ${errors.join(' | ')}`);
}

async function parseMasterFileData(buffer, fileName, masterKey) {
  if (!buffer || buffer.byteLength === 0) throw new Error('File is empty (0 bytes).');
  const isXlsx = /\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(fileName);
  if (isXlsx) {
    if (buffer.byteLength < 4) throw new Error('File is too small to be a valid spreadsheet.');
    const XLSX = await getXlsxModule();
    const data = new Uint8Array(buffer);
    let workbook;
    const readStart = perfNow();
    try {
      workbook = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
    } catch (e) {
      console.error('[xlsx] XLSX.read failed for file:', fileName, e);
      throw e;
    } finally {
      perfAddMs('masterXlsxReadMs', perfNow() - readStart);
    }
    const sheetNames = workbook?.SheetNames || [];
    if (!sheetNames.length) throw new Error('Workbook contains no sheets.');
    const workbookData = {};
    const jsonStart = perfNow();
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      workbookData[name] = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) : [];
    }
    perfAddMs('masterSheetToJsonMs', perfNow() - jsonStart);
    const activeSheet = sheetNames[0];
    return { rawRows: workbookData[activeSheet] || [], sheetNames, activeSheet, workbookData };
  }
  const text = new TextDecoder('utf-8').decode(buffer);
  const rawRows = masterKey === 'materialMap' && /\.(txt|map)$/i.test(fileName) ? parseMaterialMapText(text) : parseCsv(text);
  return { rawRows, sheetNames: [], activeSheet: '', workbookData: null };
}

function resolvePathToUrl(pathStr) {
  let normalized = pathStr.replace(/\\/g, '/');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const pathSegs = location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
  const parentIdx = normalized.indexOf('/CODE-4/');
  const wsIdx = normalized.indexOf('/3D_Converters/');
  const wsIdx2 = normalized.indexOf('/3D_Converters - Standalone/');
  let prefix = '';
  if (pathSegs.some((seg) => seg.includes('3D_Converters')) && parentIdx !== -1) prefix = normalized.substring(0, parentIdx + 8);
  else if (wsIdx !== -1) prefix = normalized.substring(0, wsIdx + 15);
  else if (wsIdx2 !== -1) prefix = normalized.substring(0, wsIdx2 + 28);
  if (prefix) return new URL('/' + normalized.substring(prefix.length).replace(/^\/+/, ''), location.href).href;
  const pIdx = normalized.indexOf('CODE-4');
  if (pIdx !== -1) return new URL('../'.repeat(pathSegs.length - 1) + normalized.substring(pIdx + 7).replace(/^\/+/, ''), location.href).href;
  const viewerIdx = normalized.indexOf('/3D_Viewer-SS/');
  if (viewerIdx !== -1) return new URL('../'.repeat(pathSegs.length) + normalized.substring(viewerIdx).replace(/^\/+/, ''), location.href).href;
  return new URL(normalized, location.href).href;
}

function translateError(err) {
  const m = err?.message || String(err || 'Unknown error');
  const stack = err?.stack ? `\nStack:\n${err.stack.split('\n').slice(0, 6).join('\n')}` : '';
  if (m.includes("reading 'length'") || m.includes('Cannot read properties')) return `Workbook structure is invalid or empty. If the file is open in Excel, close it and try again.${stack}`;
  if (m.includes('CFB') || m.includes('xlsx module has no .read') || m.includes('XLSX parser failed')) return `XLSX parser failed to load. Refresh the page (Ctrl+F5), then re-upload. If CDN access is blocked, use CSV export.${stack}`;
  if (m.includes('Fetch failed') || m.includes('500') || m.includes('403') || m.includes('Failed to fetch')) return `Could not read file. If it is open in Excel, close it and retry.${stack}`;
  return m + stack;
}

function configForState(stateRef) {
  return stateRef.current.masterContext?.config || readSupportConfigOnce(stateRef.current);
}

function headersFromRows(rows) {
  const headers = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    for (const key of Object.keys(row || {})) if (key !== '_rowIndex' && !headers.includes(key)) headers.push(key);
    if (headers.length) break;
  }
  return headers;
}

export function autoMapStandaloneMasterFields(masterKey, rawRows, currentMap = {}, config = {}) {
  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const headers = headersFromRows(rawRows);
  const fuzzyMap = fuzzyAutoMapFields(headers, fields, rawRows);
  if (masterKey !== 'lineList') return fuzzyMap;
  const lineListMap = detectLineListFieldMap(rawRows, currentMap || {}, config?.linelist || config || null);
  const mergedMap = { ...fuzzyMap, ...lineListMap };
  for (const field of fields) if (!(field.name in mergedMap)) mergedMap[field.name] = fuzzyMap[field.name] || '';
  return mergedMap;
}

function rawRowsFor(stateRef, key) {
  const current = stateRef.current.masterContext?.rawRows?.[key];
  if (Array.isArray(current) && current.length) return current;
  return getStoredJson(`xml-cii-master-raw-${key}`, []);
}

function stageMapping(stateRef, key, fieldMap, statusMessage) {
  const config = configForState(stateRef);
  const context = stageMasterMappingDraft(stateRef.current.masterContext || {}, config, key, fieldMap);
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: context,
    importMastersWriteBackStatus: statusMessage,
  });
  return context;
}

function mappingStatusText(status) {
  return status.dirty
    ? `Mapping status: MODIFIED — NOT APPLIED. Current calculation basis: Applied mapping revision ${status.revision}. Preview uses applied mapping revision ${status.revision}.`
    : `Mapping status: APPLIED. Revision: ${status.revision}. Preview uses applied mapping revision ${status.revision}.`;
}

function refreshMappingCustodyDom(container, stateRef, key) {
  const config = configForState(stateRef);
  const status = masterMappingStatus(stateRef.current.masterContext || {}, config, key);
  const statusNode = container.querySelector(`[data-master-mapping-status="${key}"]`);
  if (statusNode) statusNode.textContent = mappingStatusText(status);
  for (const action of ['apply-master-mapping', 'discard-master-mapping']) {
    const button = container.querySelector(`[data-action="${action}"][data-master-key="${key}"]`);
    if (button) button.disabled = !status.dirty;
  }
}

function applyFieldMapToContext(stateRef, key, fieldMap, rawRows, statusMessage, sourceMetadata = null) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const config = configForState(stateRef);
  const normalizeStart = perfNow();
  const normalized = mapRowsWithFieldMap(rows, fieldMap, key);
  perfAddMs('masterNormalizeMs', perfNow() - normalizeStart);
  perfCount('masterRowsNormalized', rows.length);

  const committed = commitAppliedMaster({
    context: stateRef.current.masterContext || {},
    config,
    key,
    fieldMap,
    rawRows: rows,
    normalizedRows: normalized,
    sourceMetadata,
  });
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: committed.context,
    supportConfigJson: JSON.stringify(committed.config, null, 2),
    importMastersLoading: false,
    importMastersWriteBackStatus: statusMessage,
  });
  persistChangedMaster(key, committed.context);
  return committed;
}

function applyCurrentDraft(stateRef, key) {
  const rows = rawRowsFor(stateRef, key);
  if (!rows.length) throw new Error(`No ${key} source rows are loaded.`);
  const config = configForState(stateRef);
  const fieldMap = effectiveDraftFieldMap(stateRef.current.masterContext || {}, config, key);
  perfCount('masterMappingApplyCount');
  return applyFieldMapToContext(stateRef, key, fieldMap, rows, `Applied ${key} mapping. Downstream basis advanced exactly once.`);
}

function publishParsedWorkbookMetadata(stateRef, masterKey, parsed) {
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: {
      ...context,
      sheetNames: { ...(context.sheetNames || {}), [masterKey]: parsed.sheetNames },
      activeSheet: { ...(context.activeSheet || {}), [masterKey]: parsed.activeSheet },
      workbookData: { ...(context.workbookData || {}), [masterKey]: parsed.workbookData },
    },
  });
}

export function bindImportMastersEvents(container, stateRef, render) {
  container.querySelectorAll('[data-master-file]').forEach((input) => {
    input.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const masterKey = input.dataset.masterFile;
      try {
        stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: true });
        const bufferStart = perfNow();
        const buffer = await file.arrayBuffer();
        perfAddMs('masterArrayBufferMs', perfNow() - bufferStart);
        const parsed = await parseMasterFileData(buffer, file.name, masterKey);
        stateRef.current = updateMasterLastLoadedPath(stateRef.current, masterKey, file.name);
        publishParsedWorkbookMetadata(stateRef, masterKey, parsed);
        importMasterRows(stateRef, masterKey, parsed.rawRows, file.name, render);
      } catch (err) {
        console.error('Failed to parse uploaded file:', err);
        stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: false, importMastersWriteBackStatus: `Parse error: ${err.message}` });
        requestMeasuredFullRender(render);
        alert(`Failed to parse file: ${translateError(err)}`);
      }
    });
  });

  container.querySelectorAll('[data-action="fetch-master-path"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const masterKey = btn.dataset.masterKey;
      const pathInput = container.querySelector(`[data-master-path-input="${masterKey}"]`);
      if (!pathInput) return;
      const rawPath = pathInput.value.trim();
      const pathValue = rawPath.replace(/^"|"$/g, '');
      if (!pathValue) {
        alert('Please paste a file path first.');
        return;
      }
      const resolvedUrl = resolvePathToUrl(pathValue);
      const fileName = pathValue.split(/[\\/]/).pop();
      try {
        stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: true });
        const busterUrl = resolvedUrl + (resolvedUrl.includes('?') ? '&' : '?') + '_nocache=' + Date.now();
        const response = await fetch(busterUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
        const bufferStart = perfNow();
        const buffer = await response.arrayBuffer();
        perfAddMs('masterArrayBufferMs', perfNow() - bufferStart);
        const parsed = await parseMasterFileData(buffer, fileName, masterKey);
        stateRef.current = updateMasterLastLoadedPath(stateRef.current, masterKey, pathValue);
        publishParsedWorkbookMetadata(stateRef, masterKey, parsed);
        importMasterRows(stateRef, masterKey, parsed.rawRows, fileName, render);
      } catch (err) {
        console.error('Failed to fetch/parse file:', err);
        stateRef.current = updateWorkflowState(stateRef.current, { importMastersLoading: false, importMastersWriteBackStatus: `Fetch error: ${err.message}` });
        requestMeasuredFullRender(render);
        const tips = /^[a-zA-Z]:/.test(pathValue)
          ? "\n\nNote: Local drive letters require browser file permissions. Use 'Choose File' instead or copy file to project workspace."
          : "\n\nTroubleshooting tips:\n1. If file is open in Excel, close it.\n2. Ensure web server is running and file path is relative/correct.";
        alert(`Failed to fetch file: ${translateError(err)}${tips}`);
      }
    });
  });

  container.querySelectorAll('[data-master-sheet-select]').forEach((select) => {
    select.addEventListener('change', () => {
      const masterKey = select.dataset.masterSheetSelect;
      const selectedSheet = select.value;
      const context = stateRef.current.masterContext;
      if (!context?.workbookData?.[masterKey]) return;
      const rawRows = context.workbookData[masterKey][selectedSheet] || [];
      const filename = context.sourceMetadata?.[masterKey]?.source || 'unknown';
      stateRef.current = updateWorkflowState(stateRef.current, {
        masterContext: { ...context, activeSheet: { ...(context.activeSheet || {}), [masterKey]: selectedSheet } },
      });
      importMasterRows(stateRef, masterKey, rawRows, filename, render);
    });
  });

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

function bindAutoMapEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="auto-map-master-fields"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const masterKey = btn.dataset.masterKey;
      const rawRows = rawRowsFor(stateRef, masterKey);
      if (!rawRows.length) {
        alert('Please import rows/file before auto-mapping fields.');
        return;
      }
      const config = configForState(stateRef);
      const currentMap = effectiveDraftFieldMap(stateRef.current.masterContext || {}, config, masterKey);
      const fieldMap = autoMapStandaloneMasterFields(masterKey, rawRows, currentMap, config);
      stageMapping(stateRef, masterKey, fieldMap, `Auto-mapped ${masterKey} into a draft. No calculation basis changed.`);
      requestMeasuredFullRender(render);
    });
  });
}

function bindSaveMappingEvents(container, stateRef) {
  container.querySelectorAll('[data-action="save-master-mapping"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const masterKey = btn.dataset.masterKey;
      const context = stateRef.current.masterContext;
      const filename = context?.sourceMetadata?.[masterKey]?.source;
      if (!filename || filename === 'LocalStorage' || filename === 'not-loaded') {
        alert('Please import a master file first before saving the mapping.');
        return;
      }
      const config = configForState(stateRef);
      const fieldMap = appliedFieldMap(context || {}, config, masterKey);
      if (!Object.keys(fieldMap).length) {
        alert('No applied mappings configured to save.');
        return;
      }
      saveMappingForFile(masterKey, filename, fieldMap);
      showToast(`Saved applied column mapping for: ${filename}`);
    });
  });
}

function bindSavedMappingEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="apply-saved-mapping"]').forEach((select) => {
    select.addEventListener('change', () => {
      const masterKey = select.dataset.masterKey;
      const selectedFilename = select.value;
      if (!selectedFilename) return;
      if (!rawRowsFor(stateRef, masterKey).length) {
        alert('Please load a file first.');
        select.value = '';
        return;
      }
      const fieldMap = getSavedMappingsForMaster(masterKey)[selectedFilename];
      if (!fieldMap) return;
      stageMapping(stateRef, masterKey, fieldMap, `Staged saved mapping from ${selectedFilename}. It is NOT APPLIED.`);
      requestMeasuredFullRender(render);
    });
  });
}

function bindDraftCommitEvents(container, stateRef, render) {
  container.querySelectorAll('[data-action="apply-master-mapping"]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        applyCurrentDraft(stateRef, button.dataset.masterKey);
        requestMeasuredFullRender(render);
      } catch (error) {
        alert(error?.message || String(error));
      }
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

function parseCsv(txt) {
  const lines = txt.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const hdrs = lines[0].split(',').map((header) => header.trim().replace(/^["']|["']$/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((value) => value.trim().replace(/^["']|["']$/g, ''));
    return Object.fromEntries(hdrs.map((header, index) => [header, vals[index] || '']));
  });
}

function parseMaterialMapText(txt) {
  return String(txt ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^\d{4}$/.test(line)).map((line, idx) => {
    const match = line.match(/^(\S+)\s+(.+)$/);
    return { _rowIndex: idx + 1, code: match ? match[1].trim() : '', material: match ? match[2].trim() : line };
  });
}

export function mapRowsWithFieldMap(rawRows, fieldMap, masterKey) {
  if (masterKey === 'lineList') {
    return (Array.isArray(rawRows) ? rawRows : []).map((row, index) => normalizeLineListRow(row, fieldMap, index));
  }
  return (Array.isArray(rawRows) ? rawRows : []).map((row, idx) => {
    const result = { ...row, _rowIndex: row?._rowIndex || (idx + 1) };
    for (const [fieldName, sourceHeader] of Object.entries(fieldMap || {})) result[fieldName] = sourceHeader ? (row[sourceHeader] ?? '') : '';
    return result;
  });
}

export function importMasterRows(stateRef, key, rawRows, filename, render) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const context = ensureMasterRuntime(stateRef.current.masterContext || {});
  stateRef.current = updateWorkflowState(stateRef.current, { masterContext: context });
  const config = configForState(stateRef);
  let fieldMap;
  const savedMappings = getSavedMappingsForMaster(key);
  const matchedKey = findSmartMatchingMapping(filename, Object.keys(savedMappings));
  if (matchedKey) fieldMap = savedMappings[matchedKey];
  else fieldMap = autoMapStandaloneMasterFields(key, rows, appliedFieldMap(context, config, key), config);

  perfCount('masterImportCount');
  const sourceMetadata = { key, source: filename, sourceType: 'manual', status: rows.length ? 'loaded' : 'empty', rowCount: rows.length };
  applyFieldMapToContext(
    stateRef,
    key,
    fieldMap,
    rows,
    matchedKey
      ? `Imported ${filename} (${rows.length} rows) using saved mapping from ${matchedKey}.`
      : `Imported and auto-mapped ${filename} (${rows.length} rows) into ${key}.`,
    sourceMetadata
  );
  requestMeasuredFullRender(render);
}

export function updateMasterFieldMap(stateRef, key, fieldName, selectedValue) {
  const rows = rawRowsFor(stateRef, key);
  if (!rows.length) return;
  const config = configForState(stateRef);
  const fieldMap = effectiveDraftFieldMap(stateRef.current.masterContext || {}, config, key);
  fieldMap[fieldName] = selectedValue;
  stageMapping(stateRef, key, fieldMap, `Draft mapping changed for ${key}.${fieldName}. Applied calculation basis is unchanged.`);
}

export function clearMasterContextFromUi(stateRef, render) {
  for (const key of Object.keys(MASTER_DEF_MAP)) clearPersistedMaster(key);
  const config = configForState(stateRef);
  if (config.linelist) delete config.linelist.masterRows;
  if (config.pipingClass) delete config.pipingClass.masterRows;
  if (config.material) delete config.material.mapRows;
  if (config.weight) delete config.weight.masterRows;
  stateRef.current = updateWorkflowState(stateRef.current, {
    masterContext: null,
    supportConfigJson: JSON.stringify(config, null, 2),
    importMastersWriteBackStatus: 'Master context cleared.',
  });
  requestMeasuredFullRender(render);
}

function showToast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, { position: 'fixed', bottom: '24px', right: '24px', background: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: '9999', transition: 'all 0.3s', fontSize: '0.88rem', fontFamily: 'sans-serif' });
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}
