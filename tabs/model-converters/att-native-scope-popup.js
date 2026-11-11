import { indexAttNativeHierarchy } from './att-native-hierarchy-index.js';
import {
  ATT_BROWSER_ROW_HEIGHT, ATT_BROWSER_MAX_RENDER_ROWS, createAttNativeTreeBrowser,
} from './att-native-tree-browser.js';
import {
  createAttScopeSelection, setAttScopeRule, attScopeNodeState, removeAttScopeRule, listAttScopeRules,
  resolveAttScopeSelection, attScopePartiallyExcludedBranches,
} from './att-native-scope-selection.js';

const escapeText = value => String(value ?? '').replace(/[&<>"']/g, chr => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[chr]);

/**
 * The loaded ATT/TXT is the sole authority for every Site, Zone and descendant.
 * NWD/RVM is optional and never a prerequisite for browsing or ATT scope.
 * DOM rendering is windowed; the indexed graph and selected scope never are.
 */
export async function openAttNativeScopePopup(name, bytes) {
  if (typeof document === 'undefined') throw new Error('TXT hierarchy browser needs a document.');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:12px;';
  const card = document.createElement('section');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'Select areas from the loaded ATT or TXT');
  card.style.cssText = 'width:min(1020px,98vw);height:min(92vh,920px);display:flex;flex-direction:column;background:#152030;color:#f0f5ff;border:1px solid #657994;border-radius:12px;overflow:hidden;';
  card.innerHTML = [
    '<header style="padding:14px 16px;border-bottom:1px solid #45516b;">',
    '<strong style="font-size:17px;">Choose model areas to convert</strong>',
    '<div style="font-size:12px;color:#b6c5dc;">', escapeText(name),
    ' · Site, Zone and descendant hierarchy comes entirely from this TXT/ATT file.</div>',
    '<div data-native-stats aria-live="polite" style="font-size:12px;margin-top:6px;"></div>',
    '</header>',
    '<div style="padding:10px 16px;display:flex;align-items:center;gap:8px;">',
    '<label for="att-native-search" style="font-size:12px;">Find</label>',
    '<input id="att-native-search" type="search" data-native-search placeholder="Search Sites, Zones and components in this TXT" style="flex:1;min-width:100px;background:#0b1524;color:#fff;border:1px solid #71809a;border-radius:5px;padding:8px;">',
    '<span data-native-matches style="font-size:12px;white-space:nowrap;"></span></div>',
    '<div data-native-rows role="tree" aria-label="TXT Site Zone hierarchy" tabindex="0" ',
    'style="flex:1;min-height:110px;overflow:auto;padding:0 12px;scrollbar-gutter:stable;font-size:12px;"></div>',
    '<div data-native-selection role="status" aria-live="polite" style="padding:9px 16px;border-top:1px solid #45516b;font-size:12px;"></div>',
    '<div data-native-chips aria-label="Explicitly selected or excluded model areas" style="padding:0 16px 8px;display:flex;gap:5px;flex-wrap:wrap;max-height:84px;overflow:auto;font-size:11px;"></div>',
    '<div data-native-output-scope aria-live="polite" style="padding:5px 16px;color:#c9d9ef;font-size:12px;"></div>',
    '<div data-native-error role="alert" style="display:none;padding:5px 16px;color:#ffcfba;font-size:12px;"></div>',
    '<footer style="padding:12px 16px;display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap;">',
    '<button type="button" data-native-clear>Clear selection</button>',
    '<button type="button" data-native-cancel>Cancel</button>',
    '<button type="button" data-native-full title="Convert all objects without selected filtering" style="border:1px solid #8396af;background:transparent;color:#eaf2ff;padding:8px;border-radius:6px;">Entire TXT…</button>',
    '<button type="button" data-native-confirm disabled style="border:1px solid #75a8ef;background:#2862aa;color:#fff;font-weight:700;padding:8px;border-radius:6px;">Convert selected areas</button>',
    '</footer>',
  ].join('');
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  const element = selector => card.querySelector(selector);
  const viewport = element('[data-native-rows]');
  const status = element('[data-native-stats]');
  const summary = element('[data-native-selection]');
  const output = element('[data-native-output-scope]');
  const chips = element('[data-native-chips]');
  const search = element('[data-native-search]');
  const feedback = element('[data-native-error]');
  let index;
  try {
    status.textContent = 'Reading native TXT/ATT records…';
    index = await indexAttNativeHierarchy(new Blob([bytes]).stream(), {
      onProgress(progress) {
        status.textContent = 'Indexed ' + progress.typed.toLocaleString() + ' TXT records…';
      },
    });
  } catch (error) {
    overlay.remove();
    throw error;
  }

  const browser = createAttNativeTreeBrowser(index);
  let selection = createAttScopeSelection();
  let selected = resolveAttScopeSelection(index, selection);
  let chipLimit = 40;
  let pendingSearch = null;
  let lastScrollBeforeSearch = 0;
  let pendingFrame = false;

  function errorText(value) {
    feedback.style.display = value ? 'block' : 'none';
    feedback.textContent = value || '';
  }
  function paintSummary() {
    const rules = listAttScopeRules(index, selection);
    const nSites = selected.byType.SITE || 0;
    const nZones = selected.byType.ZONE || 0;
    summary.textContent = nSites + ' Sites · ' + nZones + ' Zones · '
      + selected.selectedNativeCount.toLocaleString() + ' TXT objects selected · '
      + selected.selectedBranchIds.length + ' piping branches eligible for XML/JSON. '
      + 'Selecting a Site or Zone includes descendants, even when collapsed.';
    output.textContent = selected.selectedNativeCount
      ? 'Output eligibility — XML/JSON: ' + selected.selectedBranchIds.length
        + ' piping branches. STEP/STP: only structural members with supported source geometry/coordinates;'
        + ' selected TXT names alone are not a guarantee of 3D solids.'
      : 'Choose Site/Zone areas to select piping XML/JSON and supported structural STEP/STP output, or use Entire TXT for unfiltered conversion.';
    chips.innerHTML = rules.slice(0, chipLimit).map(rule =>
      '<button type="button" data-native-remove-rule="' + escapeText(rule.id)
      + '" title="Remove this explicit ' + (rule.checked ? 'selection' : 'exclusion') + '"'
      + ' aria-label="Remove ' + (rule.checked ? 'selection of ' : 'exclusion of ') + escapeText(rule.name) + '"'
      + ' style="border:1px solid #74849b;border-radius:12px;background:#203047;color:#eaf3ff;padding:4px 8px;">'
      + (rule.checked ? '✓ ' : '− ') + escapeText(rule.type) + ' ' + escapeText(rule.name)
      + ' <span aria-hidden="true">×</span></button>').join('')
      + (rules.length > chipLimit
        ? '<button type="button" data-native-more-chips>Show next ' + Math.min(40, rules.length - chipLimit)
          + ' of ' + rules.length + ' rules</button>'
        : '');
    const blockedBranch = attScopePartiallyExcludedBranches(index, selection);
    const noBranch = selected.explicitSelection && selected.selectedNativeCount > 0
      && !selected.selectedBranchIds.length;
    const blocked = noBranch || blockedBranch.length > 0;
    element('[data-native-confirm]').disabled = !selected.explicitSelection
      || !selected.selectedNativeCount || blocked;
    if (noBranch) {
      errorText('Selected areas have no piping branches eligible for XML/JSON. Equipment-only areas cannot be exported as piping geometry.');
    } else if (blockedBranch.length) {
      errorText('Conversion blocked: ' + blockedBranch.length
        + ' selected piping branch(es) have excluded internal components. Whole-branch output would include unchecked geometry.');
    } else {
      errorText('');
    }
  }
  function paintStats() {
    status.textContent = index.counts.typed.toLocaleString() + ' native TXT records · '
      + index.counts.sites + ' Sites · ' + index.counts.zones + ' Zones'
      + (index.counts.unresolved ? ' · ' + index.counts.unresolved + ' unresolved owner(s)' : '');
    element('[data-native-matches]').textContent = browser.search
      ? browser.matchCount.toLocaleString() + ' matches'
      : browser.visibleTotal.toLocaleString() + ' tree rows';
  }
  function paintRows() {
    const buffer = 5;
    const first = Math.max(0, Math.floor(viewport.scrollTop / ATT_BROWSER_ROW_HEIGHT) - buffer);
    const visible = Math.max(18, Math.ceil((viewport.clientHeight || 500) / ATT_BROWSER_ROW_HEIGHT) + buffer * 2);
    const windowed = browser.windowAt(first, Math.min(visible, ATT_BROWSER_MAX_RENDER_ROWS));
    const rowHtml = windowed.rows.map(row => {
      const state = attScopeNodeState(index, selection, row.id);
      const caret = row.childCount
        ? '<button type="button" data-expand="' + escapeText(row.id) + '" aria-label="' + (row.expanded ? 'Collapse ' : 'Expand ')
          + escapeText(row.name) + '" style="width:26px;flex-shrink:0;">' + (row.expanded ? '▾' : '▸') + '</button>'
        : '<span aria-hidden="true" style="display:inline-block;flex-shrink:0;width:26px;"></span>';
      const label = escapeText(row.name);
      const highlighted = row.matches ? '<strong style="color:#ffe59b;">' + label + '</strong>' : label;
      return '<div role="treeitem" tabindex="-1" data-row="' + escapeText(row.id) + '"'
        + ' aria-level="' + (row.depth + 1) + '"'
        + (row.childCount ? ' aria-expanded="' + String(row.expanded) + '"' : '')
        + ' style="box-sizing:border-box;height:' + ATT_BROWSER_ROW_HEIGHT + 'px;display:flex;align-items:center;gap:7px;white-space:nowrap;'
        + 'padding-left:' + (row.depth * 16) + 'px;">'
        + caret
        + '<input type="checkbox" data-check="' + escapeText(row.id) + '" aria-label="Select ' + label + '"'
        + (state === 'checked' ? ' checked' : '') + ' data-mixed="' + (state === 'mixed') + '">'
        + '<small style="color:#a3b8dd;width:42px;flex-shrink:0;">' + escapeText(row.type) + '</small>'
        + '<span title="' + label + '" style="text-overflow:ellipsis;">' + highlighted + '</span>'
        + (row.childCount ? '<small style="color:#a1b1c7;">(' + row.childCount + ')</small>' : '')
        + '</div>';
    }).join('');
    viewport.innerHTML = windowed.visibleTotal
      ? '<div aria-hidden="true" style="height:' + windowed.topPixels + 'px;"></div>' + rowHtml
        + '<div aria-hidden="true" style="height:' + windowed.bottomPixels + 'px;"></div>'
      : '<div role="status" style="padding:12px;color:#ffe3ad;">'
        + (browser.search
          ? 'No matching Site, Zone or component in this loaded TXT/ATT file. Try another name or check that the correct TXT was loaded.'
          : 'No SITE, ZONE or descendant records found in this TXT/ATT file.')
        + '</div>';
    viewport.querySelectorAll('[data-mixed="true"]').forEach(input => { input.indeterminate = true; });
  }
  function refresh({ withStats = false } = {}) {
    if (withStats) paintStats();
    paintRows();
  }
  function focusRow(id, target = 'row') {
    for (const row of viewport.querySelectorAll('[data-row]')) {
      if (row.getAttribute('data-row') !== id) continue;
      const focusable = target === 'check' ? row.querySelector('[data-check]') : row;
      focusable?.focus({ preventScroll: true });
      return;
    }
  }
  function focusPosition(position) {
    const bounded = Math.max(0, Math.min(browser.visibleTotal - 1, position));
    const current = browser.windowAt(bounded, 1).rows[0];
    if (!current) return;
    const top = bounded * ATT_BROWSER_ROW_HEIGHT;
    if (top < viewport.scrollTop) viewport.scrollTop = top;
    else if (top + ATT_BROWSER_ROW_HEIGHT > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTop = Math.max(0, top - viewport.clientHeight + ATT_BROWSER_ROW_HEIGHT);
    }
    paintRows();
    focusRow(current.id);
  }
  function toggleExpanded(id) {
    const oldPosition = browser.positionOf(id);
    const relative = oldPosition * ATT_BROWSER_ROW_HEIGHT - viewport.scrollTop;
    browser.toggle(id);
    const newPosition = browser.positionOf(id);
    if (newPosition >= 0) viewport.scrollTop = Math.max(0, newPosition * ATT_BROWSER_ROW_HEIGHT - relative);
    refresh({ withStats: true });
    focusRow(id);
  }

  return new Promise(resolve => {
    function done(result) {
      if (pendingSearch) clearTimeout(pendingSearch);
      overlay.remove();
      resolve(result);
    }
    viewport.addEventListener('scroll', () => {
      if (pendingFrame) return;
      pendingFrame = true;
      requestAnimationFrame(() => { pendingFrame = false; paintRows(); });
    }, { passive: true });
    viewport.addEventListener('click', event => {
      const button = event.target.closest('[data-expand]');
      if (button) toggleExpanded(button.getAttribute('data-expand'));
    });
    viewport.addEventListener('change', event => {
      const checkbox = event.target.closest('[data-check]');
      if (!checkbox) return;
      const id = checkbox.getAttribute('data-check');
      selection = setAttScopeRule(index, selection, id, checkbox.checked);
      // Traverse all source records on selection changes only, never while scrolling.
      selected = resolveAttScopeSelection(index, selection);
      errorText('');
      paintSummary();
      paintRows();
      focusRow(id, 'check');
    });
    viewport.addEventListener('keydown', event => {
      const row = event.target.closest('[data-row]');
      if (!row) return;
      const currentId = row.getAttribute('data-row');
      const position = browser.positionOf(currentId);
      if (event.key === 'ArrowDown') { event.preventDefault(); focusPosition(position + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); focusPosition(position - 1); }
      else if (event.key === 'Home') { event.preventDefault(); focusPosition(0); }
      else if (event.key === 'End') { event.preventDefault(); focusPosition(browser.visibleTotal - 1); }
      else if (event.key === 'ArrowRight' && row.getAttribute('aria-expanded') === 'false') {
        event.preventDefault(); toggleExpanded(currentId);
      } else if (event.key === 'ArrowLeft' && row.getAttribute('aria-expanded') === 'true') {
        event.preventDefault(); toggleExpanded(currentId);
      } else if (event.key === 'ArrowLeft') {
        const parent = index.byId.get(currentId)?.parentId;
        const parentPosition = parent ? browser.positionOf(parent) : -1;
        if (parentPosition >= 0) { event.preventDefault(); focusPosition(parentPosition); }
      }
    });
    search.addEventListener('input', () => {
      if (pendingSearch) clearTimeout(pendingSearch);
      const next = search.value;
      pendingSearch = setTimeout(() => {
        if (!browser.search && next.trim()) lastScrollBeforeSearch = viewport.scrollTop;
        const restore = Boolean(browser.search && !next.trim());
        browser.setSearch(next);
        viewport.scrollTop = restore ? lastScrollBeforeSearch : 0;
        refresh({ withStats: true });
      }, 160);
    });
    chips.addEventListener('click', event => {
      const more = event.target.closest('[data-native-more-chips]');
      if (more) { chipLimit += 40; paintSummary(); return; }
      const remove = event.target.closest('[data-native-remove-rule]');
      if (!remove) return;
      selection = removeAttScopeRule(index, selection, remove.getAttribute('data-native-remove-rule'));
      selected = resolveAttScopeSelection(index, selection);
      paintSummary(); paintRows();
    });
    element('[data-native-clear]').addEventListener('click', () => {
      selection = createAttScopeSelection();
      selected = resolveAttScopeSelection(index, selection);
      chipLimit = 40;
      paintSummary(); paintRows();
    });
    element('[data-native-cancel]').addEventListener('click', () => done({ cancelled: true }));
    element('[data-native-full]').addEventListener('click', () => {
      const confirmed = typeof window.confirm === 'function' && window.confirm(
        'Convert the ENTIRE loaded TXT/ATT file? Any selected Sites or Zones will be ignored.'
      );
      if (!confirmed) return;
      done({ cancelled: false, wildcard: '', selectedIds: [], nativeScope: { mode: 'FULL' } });
    });
    element('[data-native-confirm]').addEventListener('click', () => {
      if (!selected.explicitSelection || !selected.selectedNativeCount) return;
      if (!selected.selectedBranchIds.length) {
        errorText('Selected areas have no piping BRAN convertible to XML/JSON. No unfiltered output will be generated.');
        return;
      }
      const partial = attScopePartiallyExcludedBranches(index, selection);
      if (partial.length) {
        errorText('Conversion blocked: ' + partial.length
          + ' selected piping branches contain excluded components. Whole-branch export would include unchecked geometry.');
        return;
      }
      done({
        cancelled: false, wildcard: '', selectedIds: [...selected.selectedBranchIds],
        nativeScope: {
          mode: 'SELECTED', rules: [...selection.rules.entries()],
          indexed: index.counts.typed, selectedNativeCount: selected.selectedNativeCount,
          selectedPipingBranches: selected.selectedBranchIds.length,
          selectedByType: selected.byType,
        },
      });
    });
    paintStats(); paintSummary(); paintRows();
    search.focus({ preventScroll: true });
  });
}
