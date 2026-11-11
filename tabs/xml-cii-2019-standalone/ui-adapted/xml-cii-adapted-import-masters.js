import { summarizeStandaloneImportMasters, STANDALONE_IMPORT_MASTER_DEFS } from '../xml-cii-master-context.js';
import { createElement } from './xml-cii-adapted-dom.js';
import { MASTER_FIELDS } from './xml-cii-adapted-fields-config.js';
import { getSavedMappingsForMaster, findSmartMatchingMapping } from './xml-cii-adapted-state.js?v=20261001-weight-output-2';
import { buildPreviewSearchRows, previewSearchText } from './xml-cii-adapted-import-preview-search.js';
import { appliedFieldMap, effectiveDraftFieldMap, masterMappingStatus, readSupportConfigOnce } from './xml-cii-adapted-master-runtime.js';
import { getMasterDatasetRows, getMasterDatasetRowsByIndexes, searchMasterDatasetRows } from './xml-cii-adapted-master-dataset-runtime.js?v=20261006-c05-5-5-persistence-retry-1';
import { buildMatchingRowIndexes, logicalRowCount, virtualRowItems, virtualRowWindow } from './xml-cii-adapted-virtual-rows.js';

export { buildPreviewSearchRows, previewSearchText } from './xml-cii-adapted-import-preview-search.js';

function text(value, fallback = '') {
  const out = String(value ?? '').trim();
  return out || fallback;
}

function style(el, rules) {
  if (el?.style) Object.assign(el.style, rules || {});
  return el;
}

function appendMetric(parent, label, value) {
  const item = createElement('div', '', 'xml-cii-master-metric');
  item.append(createElement('span', label), createElement('strong', text(value, '0')));
  parent.appendChild(item);
}

function appendDiagnostics(parent, diagnostics) {
  const safe = Array.isArray(diagnostics) ? diagnostics : [];
  const details = createElement('details', '', 'xml-cii-master-diagnostics');
  details.append(
    createElement('summary', `Diagnostics (${safe.length})`),
    createElement('pre', safe.length ? JSON.stringify(safe, null, 2) : 'No diagnostics.')
  );
  parent.appendChild(details);
}

function getHeaderLabel(header, masterKey, config, context) {
  const fieldMap = appliedFieldMap(context, config, masterKey);
  const fieldDef = MASTER_FIELDS[masterKey]?.fields.find((field) => field.name === header);
  if (fieldDef) return fieldMap[header] ? `${fieldDef.label} [${fieldMap[header]}]` : fieldDef.label;
  if (header === 'lineKey') return 'Line Key';
  if (header === 'densitySource') return 'Density Source';
  return header;
}

function previewColumns(rows, masterKey, config, context) {
  const fieldsDef = MASTER_FIELDS[masterKey]?.fields || [];
  const fieldNames = fieldsDef.map((field) => field.name);
  const standardExtra = masterKey === 'lineList' ? ['lineKey'] : [];
  const sortedKeys = [];
  for (const name of [...standardExtra, ...fieldNames]) if (!sortedKeys.includes(name)) sortedKeys.push(name);

  // Preview is governed by the applied mapping only. A draft mapping is not a
  // calculation or preview authority until the engineer explicitly applies it.
  const mappedRawHeaders = Object.values(appliedFieldMap(context, config, masterKey)).filter(Boolean);
  const extraKeys = [];
  for (const row of rows) {
    for (const key of Object.keys(row || {})) {
      if (
        key !== '_rowIndex'
        && !key.startsWith('_')
        && !extraKeys.includes(key)
        && !fieldNames.includes(key)
        && !standardExtra.includes(key)
        && !mappedRawHeaders.includes(key)
        && key !== 'densitySource'
      ) extraKeys.push(key);
    }
  }
  for (const key of extraKeys) if (!sortedKeys.includes(key) && sortedKeys.length < 30) sortedKeys.push(key);
  if (masterKey === 'lineList' && !sortedKeys.includes('densitySource')) sortedKeys.push('densitySource');
  return sortedKeys;
}

function tableHead(columns, masterKey, config, context) {
  const thead = createElement('thead');
  const row = createElement('tr');
  for (const col of columns) {
    const labelText = getHeaderLabel(col, masterKey, config, context);
    const th = createElement('th');
    if (col === 'density' && masterKey === 'lineList') {
      const span = createElement('span', labelText);
      const infoIcon = style(createElement('span', ' ℹ️', 'xml-cii-density-info-icon'), { cursor: 'pointer', color: '#60a5fa', marginLeft: '4px' });
      infoIcon.title = 'Density Resolution Logic:\n1. Manual Process Override density (if set)\n2. If Phase is MIXED: Mixed Density -> Liquid Density\n3. If Phase is GAS: Gas Density\n4. If Phase is LIQUID: Liquid Density\n5. Fallback: Density -> Mixed Density -> Gas Density -> Liquid Density';
      th.append(span, infoIcon);
    } else th.textContent = labelText;
    row.appendChild(th);
  }
  thead.appendChild(row);
  return thead;
}

function virtualSpacerRow(columns, heightPx) {
  const tr = createElement('tr', '', 'xml-cii-virtual-spacer-row');
  const td = createElement('td');
  td.colSpan = Math.max(1, columns.length);
  if (td.style) Object.assign(td.style, { height: `${heightPx}px`, padding: '0', border: '0', lineHeight: '0' });
  tr.appendChild(td);
  return tr;
}

function replaceVirtualPreviewRows(tbody, columns, rows, indexes, scrollTop) {
  const count = logicalRowCount(rows, indexes);
  const window = virtualRowWindow(count, scrollTop);
  tbody.innerHTML = '';
  if (window.topSpacerPx > 0) tbody.appendChild(virtualSpacerRow(columns, window.topSpacerPx));
  for (const item of virtualRowItems(rows, indexes, window)) {
    const tr = createElement('tr');
    tr.dataset.sourceRowIndex = String(item.sourceIndex);
    for (const col of columns) tr.appendChild(createElement('td', text(item.row?.[col])));
    tbody.appendChild(tr);
  }
  if (window.bottomSpacerPx > 0) tbody.appendChild(virtualSpacerRow(columns, window.bottomSpacerPx));
  tbody.dataset.virtualStart = String(window.start);
  tbody.dataset.virtualEnd = String(window.end);
  tbody.dataset.virtualTotal = String(count);
  return window;
}

function bindPreviewSearch({ searchInput, masterKey, state, allRows, scrollContainer, setIndexes, renderWindow, countText }) {
  const datasetId = state.masterContext?.datasetRefs?.[masterKey]?.datasetId || '';
  let generation = 0;
  searchInput.addEventListener('input', async () => {
    const query = searchInput.value;
    const requestGeneration = ++generation;
    scrollContainer.scrollTop = 0;
    if (!query.trim()) {
      setIndexes(null);
      renderWindow();
      return;
    }
    if (!datasetId) {
      setIndexes(buildMatchingRowIndexes(allRows, query, previewSearchText));
      renderWindow();
      return;
    }
    try {
      const result = await searchMasterDatasetRows(masterKey, datasetId, query);
      if (requestGeneration !== generation || searchInput.value !== query) return;
      setIndexes(Array.isArray(result?.indexes) ? result.indexes : []);
      renderWindow();
    } catch (error) {
      if (requestGeneration !== generation) return;
      console.error(`[xml-cii] Worker Preview search failed for ${masterKey}:`, error);
      setIndexes([]);
      renderWindow();
      countText.textContent = `Search failed: ${error?.message || String(error)}`;
    }
  });
}

function appendPreview(parent, master, state, config) {
  const masterKey = master.key;
  const schemaRows = master.previewRows || [];
  const datasetRef = state.masterContext?.datasetRefs?.[masterKey] || null;
  const datasetId = datasetRef?.datasetId || '';
  const datasetRowCount = datasetId
    ? Math.max(0, Number(state.masterContext?.rowCounts?.[masterKey] ?? datasetRef?.rowCount ?? master.rowCount ?? 0) || 0)
    : 0;
  const allRows = datasetId ? [] : buildPreviewSearchRows(master, state);
  const availableRowCount = datasetId ? datasetRowCount : allRows.length;
  const wrap = createElement('div', '', 'xml-cii-master-preview');
  wrap.appendChild(createElement('h4', 'Preview'));
  if (!availableRowCount) {
    wrap.appendChild(createElement('div', 'No rows loaded.', 'xml-cii-phase-help'));
    parent.appendChild(wrap);
    return;
  }

  const searchInput = style(createElement('input'), { width: '100%', padding: '8px 12px', marginBottom: '8px', borderRadius: '4px', border: '1px solid rgba(148, 163, 184, 0.2)', background: 'rgba(15, 23, 42, 0.3)', color: '#fff', fontSize: '0.88rem' });
  searchInput.type = 'text';
  searchInput.placeholder = '🔍 Search preview data...';
  wrap.appendChild(searchInput);

  const countText = createElement('div', '', 'xml-cii-phase-help');
  countText.dataset.previewVirtualCount = masterKey;
  countText.style.marginBottom = '8px';
  wrap.appendChild(countText);

  const columns = previewColumns(schemaRows.length ? schemaRows : allRows.slice(0, 150), masterKey, config, state.masterContext);
  const tableEl = createElement('table', '', 'xml-cii-master-preview-table');
  tableEl.append(tableHead(columns, masterKey, config, state.masterContext));
  const tbodyEl = createElement('tbody');
  tableEl.appendChild(tbodyEl);

  const scrollContainer = style(createElement('div'), { maxHeight: '350px', overflowY: 'auto', border: '1px solid rgba(148, 163, 184, 0.12)', borderRadius: '6px' });
  scrollContainer.appendChild(tableEl);
  wrap.appendChild(scrollContainer);

  let indexes = null;
  let scheduled = false;
  let renderGeneration = 0;

  const renderDatasetWindow = async () => {
    scheduled = false;
    const requestGeneration = ++renderGeneration;
    const total = Array.isArray(indexes) ? indexes.length : datasetRowCount;
    const window = virtualRowWindow(total, scrollContainer.scrollTop);
    try {
      const requestedIndexes = Array.isArray(indexes) ? indexes.slice(window.start, window.end) : null;
      const result = requestedIndexes
        ? await getMasterDatasetRowsByIndexes(masterKey, datasetId, requestedIndexes)
        : await getMasterDatasetRows(masterKey, datasetId, window.start, Math.max(1, window.end - window.start));
      if (requestGeneration !== renderGeneration) return;
      tbodyEl.innerHTML = '';
      if (window.topSpacerPx > 0) tbodyEl.appendChild(virtualSpacerRow(columns, window.topSpacerPx));
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      const sourceIndexes = Array.isArray(result?.indexes) ? result.indexes : null;
      for (let index = 0; index < rows.length; index += 1) {
        const tr = createElement('tr');
        const sourceIndex = sourceIndexes?.[index] ?? requestedIndexes?.[index] ?? (window.start + index);
        tr.dataset.sourceRowIndex = String(sourceIndex);
        for (const col of columns) tr.appendChild(createElement('td', text(rows[index]?.[col])));
        tbodyEl.appendChild(tr);
      }
      if (window.bottomSpacerPx > 0) tbodyEl.appendChild(virtualSpacerRow(columns, window.bottomSpacerPx));
      tbodyEl.dataset.virtualStart = String(window.start);
      tbodyEl.dataset.virtualEnd = String(window.end);
      tbodyEl.dataset.virtualTotal = String(total);
      countText.textContent = total
        ? `Rows ${window.start + 1}-${window.end} of ${total.toLocaleString('en-US')} (worker-backed virtualized)`
        : 'No matching rows.';
    } catch (error) {
      if (requestGeneration !== renderGeneration) return;
      console.error(`[xml-cii] Worker Preview row fetch failed for ${masterKey}:`, error);
      tbodyEl.innerHTML = '';
      countText.textContent = `Preview load failed: ${error?.message || String(error)}`;
    }
  };

  const renderLegacyWindow = () => {
    scheduled = false;
    const window = replaceVirtualPreviewRows(tbodyEl, columns, allRows, indexes, scrollContainer.scrollTop);
    const total = logicalRowCount(allRows, indexes);
    countText.textContent = total
      ? `Rows ${window.start + 1}-${window.end} of ${total.toLocaleString('en-US')} (virtualized)`
      : 'No matching rows.';
  };

  const renderWindow = datasetId ? renderDatasetWindow : renderLegacyWindow;
  const scheduleWindow = () => {
    if (scheduled) return;
    scheduled = true;
    const invoke = () => { void renderWindow(); };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(invoke);
    else invoke();
  };

  bindPreviewSearch({
    searchInput, masterKey, state, allRows, scrollContainer,
    setIndexes: (nextIndexes) => { indexes = nextIndexes; },
    renderWindow, countText,
  });
  scrollContainer.addEventListener('scroll', scheduleWindow);
  void renderWindow();
  parent.appendChild(wrap);
}

function emptySummary() {
  return STANDALONE_IMPORT_MASTER_DEFS.map((def) => ({
    ...def,
    rowCount: 0,
    previewRows: [],
    diagnostics: [],
    sourceMetadata: { source: 'not-loaded', sourceType: 'empty', status: 'pending' },
  }));
}

function masterStatusText(master) {
  const meta = master.sourceMetadata || {};
  return `${text(meta.sourceType, 'empty')} / ${text(meta.status, 'pending')}`;
}

function buildColumnPreviewMap(rows, headers) {
  const previewMap = {};
  for (const header of headers) {
    const values = [];
    for (let index = 0; index < rows.length && values.length < 3; index += 1) {
      const value = rows[index]?.[header];
      if (value === undefined || value === null || String(value).trim() === '') continue;
      const textVal = String(value).trim();
      if (!values.includes(textVal)) values.push(textVal);
    }
    previewMap[header] = values.length ? `${header} | ${values.join(' | ')}` : header;
  }
  return previewMap;
}

function renderMappingHealth(masterKey, fields, fieldMap) {
  const required = fields.filter((field) => field.required);
  const mappedRequired = required.filter((field) => !!fieldMap[field.name]).length;
  const mappedTotal = fields.filter((field) => !!fieldMap[field.name]).length;
  const textValue = required.length
    ? `Mapped ${mappedTotal}/${fields.length}; required ${mappedRequired}/${required.length}`
    : `Mapped ${mappedTotal}/${fields.length}`;
  const help = masterKey === 'lineList'
    ? 'Line List uses the XML->CII Import Master detector first, then dynamic fuzzy fallback for standalone-only fields.'
    : 'Dynamic fuzzy mapping uses header aliases and row previews.';
  const row = createElement('div', '', 'xml-cii-phase-help');
  row.textContent = `${textValue}. ${help}`;
  row.style.margin = '4px 0 10px 0';
  return row;
}

function renderMappingCustody(masterKey, status) {
  const box = style(createElement('div', '', 'xml-cii-mapping-custody'), {
    margin: '6px 0 12px 0', padding: '8px 10px', borderRadius: '6px',
    border: status.dirty ? '1px solid rgba(245,158,11,.5)' : '1px solid rgba(16,185,129,.35)',
    background: status.dirty ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.06)', fontSize: '0.82rem',
  });
  box.dataset.masterMappingStatus = masterKey;
  if (status.dirty) {
    box.textContent = `Mapping status: MODIFIED — NOT APPLIED. Current calculation basis: Applied mapping revision ${status.revision}. Preview uses applied mapping revision ${status.revision}.`;
  } else {
    box.textContent = `Mapping status: APPLIED. Revision: ${status.revision}. Preview uses applied mapping revision ${status.revision}.`;
  }
  return box;
}

function mappingButton(label, action, masterKey, enabled, positive = false) {
  const button = style(createElement('button', label), {
    margin: '0', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px',
    border: `1px solid ${positive ? 'rgba(16,185,129,.45)' : 'rgba(145,160,180,.25)'}`,
    background: positive ? 'rgba(16,185,129,.22)' : 'rgba(30,41,59,.5)', color: 'inherit', cursor: enabled ? 'pointer' : 'not-allowed',
  });
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.masterKey = masterKey;
  button.disabled = !enabled;
  return button;
}

function renderColumnMapping(master, state, config) {
  const masterKey = master.key;
  const fields = MASTER_FIELDS[masterKey]?.fields || [];
  const datasetId = state.masterContext?.datasetRefs?.[masterKey]?.datasetId || '';
  const rawRows = datasetId
    ? (state.masterContext?.mappingRows?.[masterKey] || [])
    : (state.masterContext?.rawRows?.[masterKey] || []);
  if (!rawRows.length) {
    const message = datasetId
      ? 'Bounded mapping sample unavailable. Re-import this master to refresh mapping samples.'
      : 'Import rows/file to configure field mapping.';
    return createElement('div', message, 'xml-cii-phase-help');
  }

  const headers = [];
  for (const k of Object.keys(rawRows[0] || {})) if (k !== '_rowIndex' && !headers.includes(k)) headers.push(k);
  const previewMap = buildColumnPreviewMap(rawRows, headers);
  const fieldMap = effectiveDraftFieldMap(state.masterContext, config, masterKey);
  const mappingStatus = masterMappingStatus(state.masterContext, config, masterKey);

  const wrap = createElement('div', '', 'xml-cii-master-column-mapping');
  const h4 = style(createElement('h4', 'Dynamic Field Mapping'), { display: 'inline-flex', alignItems: 'center', gap: '6px', margin: '0 0 8px 0' });
  const infoIcon = style(createElement('span', 'ⓘ', 'xml-cii-fuzzy-info-icon'), { cursor: 'help', fontSize: '1rem', color: '#3b82f6', fontWeight: 'bold', display: 'inline-block', lineHeight: '1' });
  infoIcon.title = masterKey === 'lineList'
    ? 'Standalone Line List Auto Mapping:\n1. Reuses the XML->CII Import Master line-list detector.\n2. Preserves valid existing mappings.\n3. Rejects unsafe matches such as construction class as piping class.\n4. Applies density/process-value safeguards.\n5. Falls back to dynamic fuzzy field mapping for standalone fields such as From/To.'
    : 'Fuzzy Logic Auto-Mapping Logic:\n1. Exact/Fuzzy Header Pass.\n2. Label-row content pass.\n3. Data type value fallback.\n4. Dynamic mapped fields remain editable.';
  h4.appendChild(infoIcon);
  wrap.appendChild(h4);
  wrap.appendChild(renderMappingHealth(masterKey, fields, fieldMap));
  wrap.appendChild(renderMappingCustody(masterKey, mappingStatus));

  const ctrl = style(createElement('div'), { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' });
  const autoBtn = mappingButton('🧠 Auto Map Fields', 'auto-map-master-fields', masterKey, true);
  const saveBtn = mappingButton('💾 Save Applied Mapping', 'save-master-mapping', masterKey, true);
  const applyBtn = mappingButton('Apply Mapping', 'apply-master-mapping', masterKey, mappingStatus.dirty, true);
  const discardBtn = mappingButton('Discard Draft', 'discard-master-mapping', masterKey, mappingStatus.dirty);

  const savedLabel = style(createElement('label', 'Stage Saved:'), { display: 'flex', gap: '6px', alignItems: 'center', margin: '0', fontSize: '0.85rem' });
  const savedSelect = style(createElement('select'), { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(145,160,180,.25)', background: 'rgba(2,6,23,.75)', color: 'inherit' });
  savedSelect.dataset.action = 'apply-saved-mapping';
  savedSelect.dataset.masterKey = masterKey;
  const optDefault = createElement('option', '-- select saved mapping --');
  optDefault.value = '';
  savedSelect.appendChild(optDefault);

  const savedMappings = getSavedMappingsForMaster(masterKey);
  const currentFile = state.masterContext?.sourceMetadata?.[masterKey]?.source || '';
  const matchedKey = findSmartMatchingMapping(currentFile, Object.keys(savedMappings));
  for (const name of Object.keys(savedMappings)) {
    const opt = createElement('option', name);
    opt.value = name;
    if (name === matchedKey) opt.selected = true;
    savedSelect.appendChild(opt);
  }
  savedLabel.appendChild(savedSelect);
  ctrl.append(autoBtn, saveBtn, savedLabel, discardBtn, applyBtn);
  wrap.appendChild(ctrl);

  const grid = createElement('div', '', 'xml-cii-mapping-grid');
  for (const field of fields) {
    const label = createElement('label');
    const span = createElement('span');
    span.textContent = field.label;
    if (field.required) span.appendChild(createElement('span', '*', 'xml-cii-field-required-asterisk'));
    label.appendChild(span);

    const select = createElement('select');
    select.dataset.masterFieldMap = field.name;
    select.dataset.masterKey = masterKey;
    const optEmpty = createElement('option', '-- optional --');
    optEmpty.value = '';
    select.appendChild(optEmpty);
    const currentVal = fieldMap[field.name] || '';
    for (const h of headers) {
      const opt = createElement('option', previewMap[h] || h);
      opt.value = h;
      if (h === currentVal) opt.selected = true;
      select.appendChild(opt);
    }
    label.appendChild(select);
    grid.appendChild(label);
  }
  wrap.appendChild(grid);
  return wrap;
}

function renderMasterCard(master, state, config) {
  const card = createElement('section', '', 'xml-cii-master-card');
  card.dataset.master = master.key;
  card.appendChild(createElement('h3', master.label));

  const fileLabel = createElement('label', 'Upload CSV/Excel/Text file:');
  const fileInput = createElement('input');
  fileInput.type = 'file';
  fileInput.accept = master.key === 'materialMap' ? '.csv,.xlsx,.xls,.txt,.map' : '.csv,.xlsx,.xls';
  fileInput.dataset.masterFile = master.key;
  fileLabel.appendChild(fileInput);
  const alreadyLoaded = Number(master.rowCount || 0) > 0;
  if (alreadyLoaded) {
    style(fileInput, { color: 'transparent', maxWidth: '120px' });
    fileLabel.appendChild(style(createElement('span', ` ✅ Loaded: ${text(master.sourceMetadata?.source, 'stored rows')} (${master.rowCount} rows)`), { color: '#8be28b', fontSize: '0.85rem', marginLeft: '8px' }));
  }
  card.appendChild(fileLabel);

  const context = state.masterContext || {};
  const sheetNames = context.sheetNames?.[master.key] || [];
  const activeSheet = context.activeSheet?.[master.key] || '';
  if (sheetNames.length > 1) {
    const sheetRow = style(createElement('div', '', 'xml-cii-master-sheet-row'), { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', marginBottom: '8px' });
    const sheetLabel = style(createElement('label', 'Select Active Sheet:'), { display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center', margin: '0', fontSize: '0.85rem' });
    const sheetSelect = style(createElement('select'), { padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(145,160,180,.25)', background: 'rgba(2,6,23,.75)', color: 'inherit' });
    sheetSelect.dataset.masterSheetSelect = master.key;
    for (const name of sheetNames) {
      const opt = createElement('option', name);
      opt.value = name;
      if (name === activeSheet) opt.selected = true;
      sheetSelect.appendChild(opt);
    }
    sheetLabel.appendChild(sheetSelect);
    sheetRow.appendChild(sheetLabel);
    card.appendChild(sheetRow);
  }

  const pathRow = style(createElement('div', '', 'xml-cii-master-path-row'), { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px', marginBottom: '16px' });
  const pathLabel = style(createElement('label'), { flex: '1', display: 'flex', flexDirection: 'column', gap: '4px', margin: '0' });
  pathLabel.appendChild(style(createElement('span', 'Or fetch from local path/URL:'), { fontSize: '0.85rem' }));
  const pathInput = style(createElement('input'), { width: '100%', boxSizing: 'border-box', border: '1px solid rgba(145,160,180,.25)', borderRadius: '8px', padding: '8px', color: 'inherit', background: 'rgba(2,6,23,.75)' });
  pathInput.type = 'text';
  pathInput.placeholder = 'Or paste local absolute/relative path or URL...';
  pathInput.dataset.masterPathInput = master.key;
  pathInput.value = state.masterLastLoadedPaths?.[master.key] || '';
  pathLabel.appendChild(pathInput);
  const fetchBtn = style(createElement('button', '🔄 Fetch'), { margin: '0', alignSelf: 'flex-end', padding: '8px 16px', whiteSpace: 'nowrap', height: '35px', borderRadius: '8px', border: '1px solid rgba(145,160,180,.28)', background: 'rgba(30,64,175,.35)', color: 'inherit', cursor: 'pointer' });
  fetchBtn.type = 'button';
  fetchBtn.dataset.action = 'fetch-master-path';
  fetchBtn.dataset.masterKey = master.key;
  pathRow.append(pathLabel, fetchBtn);
  card.appendChild(pathRow);

  const metrics = createElement('div', '', 'xml-cii-master-metrics');
  metrics.style.marginTop = '8px';
  appendMetric(metrics, 'Source', master.sourceMetadata?.source || 'not-loaded');
  appendMetric(metrics, 'Status', masterStatusText(master));
  appendMetric(metrics, 'Rows', master.rowCount);
  const datasetRef = context.datasetRefs?.[master.key] || null;
  const persistenceFailure = state.masterPersistenceFailures?.[master.key] || null;
  if (datasetRef?.datasetId) {
    const durable = String(datasetRef.persistence || '') === 'indexeddb';
    const persistenceText = durable
      ? (persistenceFailure ? 'IndexedDB durable; restart custody needs retry' : 'IndexedDB durable')
      : 'SESSION ONLY — active now; reload requires durable retry or re-import';
    appendMetric(metrics, 'Persistence', persistenceText);
  }
  card.appendChild(metrics);

  if (datasetRef?.datasetId && (String(datasetRef.persistence || '') === 'session' || persistenceFailure)) {
    const retryRow = style(createElement('div', '', 'xml-cii-master-persistence-retry'), {
      display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap',
      margin: '8px 0 12px 0', padding: '8px 10px', borderRadius: '6px',
      border: '1px solid rgba(245,158,11,.45)', background: 'rgba(245,158,11,.08)',
    });
    const retry = mappingButton('Retry durable save', 'retry-master-persistence', master.key, !state.importMastersLoading, true);
    const detail = persistenceFailure?.phase === 'restart-custody'
      ? 'Dataset rows are durable in IndexedDB, but reload custody is incomplete. Retry saves restart metadata only; parsing and mapping are unchanged.'
      : 'Parse/import succeeded and this master is usable now, but it is session-only. Retry reuses the parsed dataset; it does not reparse or remap.';
    retryRow.append(retry, createElement('span', detail, 'xml-cii-phase-help'));
    card.appendChild(retryRow);
  }

  card.appendChild(renderColumnMapping(master, state, config));
  appendPreview(card, master, state, config);
  appendDiagnostics(card, master.diagnostics || []);
  return card;
}

export function renderStandaloneImportMastersPanel(card, state, targetMasterKey = null) {
  // One parse at the panel boundary. Helpers receive this immutable derived
  // value instead of reparsing supportConfigJson throughout the render tree.
  const config = state.masterContext?.config || readSupportConfigOnce(state);
  const masters = state.masterContext ? summarizeStandaloneImportMasters(state.masterContext) : emptySummary();

  if (targetMasterKey) {
    const master = masters.find((item) => item.key === targetMasterKey);
    if (master) {
      const actions = createElement('div', '', 'xml-cii-master-actions');
      actions.style.marginBottom = '12px';
      const load = createElement('button', state.importMastersLoading ? 'Loading…' : 'Load default context');
      load.type = 'button';
      load.dataset.action = 'load-import-masters';
      load.disabled = !!state.importMastersLoading;
      const clear = createElement('button', 'Clear Master Context');
      clear.type = 'button';
      clear.dataset.action = 'clear-master-context';
      clear.style.marginLeft = '8px';
      actions.append(load, clear, createElement('span', state.importMastersWriteBackStatus || '', 'xml-cii-phase-help'));
      card.appendChild(actions);
      card.appendChild(renderMasterCard(master, state, config));
    }
    return;
  }

  card.appendChild(createElement('p', 'Load Line List, Piping Class, Material Map, and Weights / Valve CA8 masters into standalone workflow config.', 'xml-cii-phase-help'));
  const actions = createElement('div', '', 'xml-cii-master-actions');
  const load = createElement('button', state.importMastersLoading ? 'Loading…' : 'Load / refresh master context');
  load.type = 'button';
  load.dataset.action = 'load-import-masters';
  load.disabled = !!state.importMastersLoading;
  const clear = createElement('button', 'Clear Master Context');
  clear.type = 'button';
  clear.dataset.action = 'clear-master-context';
  clear.style.marginLeft = '8px';
  actions.append(load, clear, createElement('span', state.importMastersWriteBackStatus || 'Master rows not loaded into standalone config yet.', 'xml-cii-phase-help'));
  card.appendChild(actions);

  const grid = createElement('div', '', 'xml-cii-master-card-grid');
  for (const master of masters) grid.appendChild(renderMasterCard(master, state, config));
  card.appendChild(grid);
}
