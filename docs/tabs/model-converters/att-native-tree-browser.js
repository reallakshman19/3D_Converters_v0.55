/**
 * One browse projection of the loaded TXT/ATT ownership graph.
 * No NWD, RVM inventory, inferred object or source-count cap.
 * Only a bounded scroll window is materialized as DOM rows by the popup.
 */
export const ATT_BROWSER_ROW_HEIGHT = 32;
export const ATT_BROWSER_MAX_RENDER_ROWS = 120;

export function createAttNativeTreeBrowser(index) {
  if (!index?.records || !index?.byId || !index?.roots) {
    throw new TypeError('An indexed native ATT/TXT hierarchy is required.');
  }
  const expanded = new Set(index.records.filter(r => r.type === 'SITE').map(r => r.id));
  let query = '';
  let rows = [];
  let positions = new Map();
  let matchCount = 0;
  let collapsedSearch = new Set();

  function rebuild() {
    const term = query.toLocaleLowerCase();
    const allowed = term ? new Set() : null;
    const searchExpands = new Set();
    let matches = new Set();
    if (term) {
      for (const record of index.records) {
        if (!record.name.toLocaleLowerCase().includes(term)
          && !record.type.toLocaleLowerCase().includes(term)) continue;
        matches.add(record.id);
        const visited = new Set();
        let current = record;
        while (current && !visited.has(current.id)) {
          visited.add(current.id);
          allowed.add(current.id);
          if (current.id !== record.id) searchExpands.add(current.id);
          current = current.parentId ? index.byId.get(current.parentId) : null;
        }
      }
    }
    rows = [];
    positions = new Map();
    const stack = index.roots.slice().reverse().map(id => ({ id, depth: 0 }));
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current.id)) continue;
      visited.add(current.id);
      if (allowed && !allowed.has(current.id)) continue;
      const record = index.byId.get(current.id);
      if (!record) throw new Error('Native source index references missing child ' + current.id);
      const hasChildren = record.childrenIds.length > 0;
      const open = hasChildren && !collapsedSearch.has(current.id)
        && (expanded.has(current.id) || searchExpands.has(current.id));
      positions.set(record.id, rows.length);
      rows.push({
        id: record.id, name: record.name, type: record.type,
        depth: current.depth, childCount: record.childrenIds.length,
        expanded: Boolean(open), matches: matches.has(record.id),
        parentId: record.parentId,
      });
      if (open) {
        for (let i = record.childrenIds.length - 1; i >= 0; --i) {
          stack.push({ id: record.childrenIds[i], depth: current.depth + 1 });
        }
      }
    }
    matchCount = matches.size;
  }

  function setSearch(value) {
    const next = String(value ?? '').trim();
    if (next === query) return;
    query = next;
    collapsedSearch = new Set();
    rebuild();
  }
  function toggle(id) {
    const record = index.byId.get(id);
    if (!record) throw new Error('Unknown TXT object: ' + id);
    if (!record.childrenIds.length) return;
    const inSearch = Boolean(query);
    const visible = positions.has(id);
    if (inSearch && visible) {
      const isOpen = rows[positions.get(id)].expanded;
      if (isOpen) collapsedSearch.add(id);
      else collapsedSearch.delete(id);
    } else if (expanded.has(id)) expanded.delete(id);
    else expanded.add(id);
    rebuild();
  }
  function windowAt(first, limit = ATT_BROWSER_MAX_RENDER_ROWS) {
    const start = Number.isSafeInteger(first) ? Math.max(0, first) : 0;
    const size = Number.isSafeInteger(limit) && limit > 0
      ? Math.min(limit, ATT_BROWSER_MAX_RENDER_ROWS) : ATT_BROWSER_MAX_RENDER_ROWS;
    return Object.freeze({
      rows: rows.slice(start, start + size),
      first: start, visibleTotal: rows.length, matchCount,
      indexedTotal: index.counts.typed,
      search: query,
      topPixels: start * ATT_BROWSER_ROW_HEIGHT,
      bottomPixels: Math.max(0, rows.length - (start + size)) * ATT_BROWSER_ROW_HEIGHT,
    });
  }
  rebuild();
  return Object.freeze({
    windowAt, setSearch, toggle,
    positionOf(id) { return positions.get(id) ?? -1; },
    get visibleTotal() { return rows.length; },
    get matchCount() { return matchCount; },
    get search() { return query; },
    get indexedTotal() { return index.counts.typed; },
    /** Utility for tests: index all virtual windows; no missing visible row. */
    get originalSourceRecords() { return index.records.length; },
  });
}
