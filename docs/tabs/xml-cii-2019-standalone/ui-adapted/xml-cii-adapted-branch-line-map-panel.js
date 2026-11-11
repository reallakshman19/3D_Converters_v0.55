/**
 * Dedicated Bulk Branch → Line Number Mapping Panel.
 * Rendering/state custody lives here; pattern/suggestion actions live in the
 * companion actions module so matching authority remains independently testable.
 */

import { bindBranchLineMapActions } from './xml-cii-adapted-branch-line-map-actions.js';

export { resolveBranchLineKeySuggestion } from './xml-cii-adapted-branch-line-map-actions.js';

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function hasOwn(object, key) {
  return Boolean(object && Object.prototype.hasOwnProperty.call(object, key));
}

function headerHtml(mappedCount, unmappedCount) {
  return `
    <div class="bulk-map-header" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 18px;background:linear-gradient(135deg,rgba(30,41,59,0.9) 0%,rgba(15,23,42,0.95) 100%);border:1px solid rgba(99,102,241,0.35);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);transition:all 0.2s ease;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:16px;">🔗</span>
        <span style="font-weight:700;font-size:14px;color:#f8fafc;letter-spacing:0.02em;">Bulk Branch → Line Number Mapping Panel</span>
        <span class="bulk-badge-mapped" style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);">✓ Mapped: ${mappedCount}</span>
        <span class="bulk-badge-unmapped" style="font-size:11px;padding:2px 8px;border-radius:12px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);">⚠ Unmapped: ${unmappedCount}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="bulk-toggle-hint" style="font-size:12px;color:#94a3b8;">Click to expand</span>
        <span class="bulk-chevron" style="font-size:14px;color:#a5b4fc;transition:transform 0.2s ease;">▼</span>
      </div>
    </div>`;
}

function controlsHtml() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 10px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:260px;">
        <input type="text" class="bulk-search-input" placeholder="🔍 Filter branch name or mapped line key..." style="flex:1;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:7px 12px;font-size:12px;outline:none;">
        <select class="bulk-status-filter" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:7px 10px;font-size:12px;cursor:pointer;">
          <option value="all">All Branches</option>
          <option value="unmapped">Unmapped Only</option>
          <option value="mapped">Mapped Only</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <button type="button" class="bulk-autosuggest-btn" style="background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:6px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;">✨ Auto-Suggest Unmapped</button>
        <button type="button" class="bulk-save-btn" style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;border-radius:6px;padding:7px 16px;font-size:12px;font-weight:700;cursor:pointer;">💾 Save & Apply Mappings</button>
      </div>
    </div>`;
}

function patternCardHtml() {
  return `
    <div style="margin-top:14px;padding:12px 16px;background:rgba(15,23,42,0.6);border:1px dashed rgba(148,163,184,0.25);border-radius:8px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
      <div style="display:flex;flex-direction:column;align-items:flex-start;gap:5px;max-width:540px;">
        <span style="font-size:12px;font-weight:600;color:#e2e8f0;">⚡ Advanced Branch → Line transform</span>
        <span style="font-size:11px;color:#94a3b8;">Use <strong>Auto Detect Pattern</strong> first. Regex selects branch text; Replace builds a candidate key. <code>$1</code>, <code>$2</code>… are captured regex groups. Apply accepts only exact loaded Line List keys; progressive family suggestions are uniqueness-gated.</span>
        <button type="button" class="bulk-auto-detect-pattern-btn" style="margin-top:3px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:650;cursor:pointer;">⚡ Auto Detect Pattern</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="text" class="bulk-pattern-regex" placeholder="Regex, e.g. ^.*?(P\\d+).*$" style="width:260px;background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:6px 10px;font-size:12px;font-family:monospace;">
        <span style="color:#94a3b8;font-weight:bold;">→</span>
        <input type="text" class="bulk-pattern-replace" placeholder="Replace, e.g. $1" style="width:150px;background:#1e293b;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:6px 10px;font-size:12px;font-family:monospace;">
        <button type="button" class="bulk-apply-pattern-btn" style="background:#4338ca;color:#f8fafc;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">Apply Pattern</button>
      </div>
      <div class="bulk-pattern-detect-result" style="display:none;width:100%;margin-top:2px;padding:9px 11px;background:rgba(2,6,23,0.55);border:1px solid rgba(148,163,184,0.18);border-radius:6px;font-size:11px;color:#cbd5e1;"></div>
    </div>`;
}

export function branchLineMapRowState(row, map = {}) {
  const branchName = text(row?.branchName);
  const explicitValue = hasOwn(map, branchName) ? text(map[branchName]) : '';
  const resolvedValue = !row?.lineMiss && text(row?.lineKey) && text(row.lineKey) !== branchName ? text(row.lineKey) : '';
  if (explicitValue) return { branchName, value: explicitValue, status: 'override', mapped: true, explicit: true, resolvedValue };
  if (resolvedValue) return { branchName, value: resolvedValue, status: 'resolved', mapped: true, explicit: false, resolvedValue };
  return { branchName, value: '', status: 'unmapped', mapped: false, explicit: false, resolvedValue: '' };
}

function statusBadge(status) {
  if (status === 'override') return '<span class="bulk-row-status" style="color:#34d399;font-weight:600;font-size:11px;">✓ Explicit override</span>';
  if (status === 'resolved') return '<span class="bulk-row-status" style="color:#93c5fd;font-weight:600;font-size:11px;">✓ Resolver mapped</span>';
  return '<span class="bulk-row-status" style="color:#fbbf24;font-weight:500;font-size:11px;">⚠ Unmapped</span>';
}

function tableRows(branches, map, datalistId) {
  return branches.map((row) => {
    const state = branchLineMapRowState(row, map);
    const locked = state.status === 'resolved';
    const override = locked
      ? '<button type="button" class="bulk-enable-override-btn" style="margin-left:6px;background:#1e293b;color:#bfdbfe;border:1px solid #3b82f6;border-radius:5px;padding:5px 8px;font-size:11px;cursor:pointer;">Override</button>'
      : '';
    return `<tr class="bulk-map-tr" data-branch="${esc(state.branchName)}" data-status="${state.mapped ? 'mapped' : 'unmapped'}" data-mapping-source="${esc(state.status)}" data-has-explicit-override="${state.explicit ? 'true' : 'false'}" data-resolved-line-key="${esc(state.resolvedValue)}" style="border-bottom:1px solid rgba(148,163,184,0.1);">
      <td style="padding:8px 12px;font-family:monospace;font-size:12px;color:#e2e8f0;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(state.branchName)}">${esc(state.branchName)}</td>
      <td style="padding:6px 12px;"><div style="display:flex;align-items:center;"><input type="text" list="${esc(datalistId)}" class="bulk-line-input" data-branch="${esc(state.branchName)}" value="${esc(state.value)}" placeholder="Type or select line list key..." ${locked ? 'readonly aria-readonly="true"' : ''} style="width:100%;max-width:320px;background:${locked ? '#111827' : '#0f172a'};color:#f8fafc;border:1px solid ${locked ? '#475569' : '#334155'};border-radius:5px;padding:5px 10px;font-size:12px;">${override}</div></td>
      <td style="padding:8px 12px;text-align:center;">${statusBadge(state.status)}</td></tr>`;
  }).join('');
}

function bindFilters(container) {
  const body = container.querySelector('.bulk-map-tbody');
  const search = container.querySelector('.bulk-search-input');
  const status = container.querySelector('.bulk-status-filter');
  const filter = () => {
    const query = text(search?.value).toLowerCase();
    body?.querySelectorAll('.bulk-map-tr').forEach((tr) => {
      const branch = text(tr.dataset.branch).toLowerCase();
      const assigned = text(tr.querySelector('.bulk-line-input')?.value).toLowerCase();
      const mapped = Boolean(assigned);
      const statusOk = status?.value === 'all' || (status?.value === 'mapped' && mapped) || (status?.value === 'unmapped' && !mapped);
      tr.style.display = statusOk && (!query || branch.includes(query) || assigned.includes(query)) ? '' : 'none';
    });
  };
  search?.addEventListener('input', filter);
  status?.addEventListener('change', filter);
}

function markPending(tr, label) {
  tr.dataset.status = 'mapped';
  tr.dataset.mappingSource = 'pending';
  const input = tr.querySelector('.bulk-line-input');
  if (input) {
    input.style.borderColor = '#3b82f6';
    input.style.backgroundColor = 'rgba(59,130,246,0.1)';
  }
  const status = tr.querySelector('.bulk-row-status');
  if (status) {
    status.textContent = label;
    status.style.color = '#60a5fa';
  }
}

function bindOverrides(container) {
  container.querySelectorAll('.bulk-enable-override-btn').forEach((button) => button.addEventListener('click', () => {
    const tr = button.closest('.bulk-map-tr');
    const input = tr?.querySelector('.bulk-line-input');
    if (!tr || !input) return;
    tr.dataset.overrideEnabled = 'true';
    input.readOnly = false;
    input.removeAttribute('aria-readonly');
    button.remove();
    markPending(tr, '✏ Override enabled');
    input.focus();
    input.select();
  }));
}

function bindSave(container, config, onSaveConfig, onRebuildPreview) {
  container.querySelector('.bulk-save-btn')?.addEventListener('click', () => {
    if (!config.linelist) config.linelist = {};
    const map = { ...(config.linelist.branchLineKeyMap || {}) };
    container.querySelectorAll('.bulk-map-tr').forEach((tr) => {
      const input = tr.querySelector('.bulk-line-input');
      const branch = text(input?.dataset.branch);
      if (!input || !branch) return;
      const source = tr.dataset.mappingSource || 'unmapped';
      if (source === 'resolved' && tr.dataset.hasExplicitOverride !== 'true' && tr.dataset.overrideEnabled !== 'true') return;
      const value = text(input.value);
      if (value) map[branch] = value;
      else delete map[branch];
    });
    config.linelist.branchLineKeyMap = map;
    onSaveConfig?.(config);
    onRebuildPreview?.();
  });
}

function bindToggle(container) {
  const header = container.querySelector('.bulk-map-header');
  const body = container.querySelector('.bulk-map-body');
  const chevron = container.querySelector('.bulk-chevron');
  const hint = container.querySelector('.bulk-toggle-hint');
  let expanded = false;
  header?.addEventListener('click', () => {
    expanded = !expanded;
    if (body) body.style.display = expanded ? 'block' : 'none';
    if (chevron) chevron.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
    if (hint) hint.textContent = expanded ? 'Click to collapse' : 'Click to expand';
  });
}

export function renderBranchLineMapPanel(container, { branchRows = [], lineListKeys = [], config = {}, onSaveConfig, onRebuildPreview }) {
  if (!container || !Array.isArray(branchRows) || !branchRows.length) return;
  const currentMap = config.linelist?.branchLineKeyMap || {};
  const states = branchRows.map((row) => branchLineMapRowState(row, currentMap));
  const mappedCount = states.filter((state) => state.mapped).length;
  const datalistId = `bulk-ll-keys-${Math.random().toString(36).slice(2, 8)}`;
  const options = (lineListKeys || []).map((key) => `<option value="${esc(key)}"></option>`).join('');
  container.innerHTML = `<div class="bulk-branch-mapping-wrapper" style="margin:0 0 16px;font-family:inherit;">${headerHtml(mappedCount, states.length - mappedCount)}<div class="bulk-map-body" style="display:none;margin-top:8px;padding:16px;background:rgba(15,23,36,0.85);border:1px solid #1e293b;border-radius:8px;">${controlsHtml()}<datalist id="${datalistId}">${options}</datalist><div style="max-height:360px;overflow-y:auto;border:1px solid rgba(148,163,184,0.15);border-radius:6px;background:#090d16;"><table style="width:100%;border-collapse:collapse;text-align:left;"><thead style="position:sticky;top:0;background:#182235;z-index:2;"><tr><th style="padding:10px 12px;font-size:11px;color:#94a3b8;">Branch Name</th><th style="padding:10px 12px;font-size:11px;color:#94a3b8;">Assigned Line List Key</th><th style="padding:10px 12px;font-size:11px;color:#94a3b8;text-align:center;">Status</th></tr></thead><tbody class="bulk-map-tbody">${tableRows(branchRows, currentMap, datalistId)}</tbody></table></div>${patternCardHtml()}</div></div>`;
  bindToggle(container);
  bindFilters(container);
  bindOverrides(container);
  bindBranchLineMapActions(container, lineListKeys);
  bindSave(container, config, onSaveConfig, onRebuildPreview);
}
