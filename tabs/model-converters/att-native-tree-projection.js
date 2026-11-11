/**
 * Native ATT hierarchy navigation projection. Full data lives in the index;
 * these APIs bound rendered rows, never indexed or convertible source records.
 * This module must not own selection or mutate the index.
 */
export const ATT_TREE_ROW_LIMIT = 120;

function asPositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
function asOffset(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function recordAt(index, id) {
  const record = index.byId.get(id);
  if (!record) throw new Error('Unknown native ATT identity: ' + id);
  return record;
}
function makeRow(record, depth, searchable = false, breadcrumb = '') {
  return Object.freeze({
    id: record.id, name: record.name, type: record.type,
    depth, childCount: record.childrenIds.length,
    parentId: record.parentId, searchable, breadcrumb,
  });
}

/**
 * Project a globally bounded window of the full expanded native graph.
 * With no expanded nodes, roots (SITE and unresolved references) are shown.
 * Every expanded descendant remains enumerated, including non-piping types.
 */
export function projectAttNativeTree(index, options = {}) {
  const expanded = options.expanded instanceof Set ? options.expanded : new Set();
  const offset = asOffset(options.offset);
  const limit = Math.min(ATT_TREE_ROW_LIMIT, asPositiveInteger(options.limit, ATT_TREE_ROW_LIMIT));
  const rows = [];
  let total = 0;
  const query = String(options.search || '').trim().toLocaleLowerCase();
  if (query) {
    for (const record of index.records) {
      if (!record.name.toLocaleLowerCase().includes(query)
        && !record.type.toLocaleLowerCase().includes(query)) continue;
      if (total >= offset && rows.length < limit) {
        rows.push(makeRow(record, 0, true, attNativeBreadcrumb(index, record.id)));
      }
      ++total;
    }
  } else {
    const stack = index.roots.slice().reverse().map(id => ({ id, depth: 0 }));
    while (stack.length) {
      const current = stack.pop();
      const record = recordAt(index, current.id);
      if (total >= offset && rows.length < limit) {
        rows.push(makeRow(record, current.depth));
      }
      ++total;
      if (expanded.has(record.id)) {
        for (let i = record.childrenIds.length - 1; i >= 0; --i) {
          stack.push({ id: record.childrenIds[i], depth: current.depth + 1 });
        }
      }
    }
  }
  return Object.freeze({
    rows: Object.freeze(rows),
    offset, limit, visibleTotal: total, indexedTotal: index.counts.typed,
    matchedTotal: query ? total : null,
    canNext: offset + rows.length < total,
    canPrevious: offset > 0,
    unresolvedTotal: index.counts.unresolved + index.counts.ambiguous + (index.counts.cycles || 0),
  });
}

export function attNativeAncestors(index, id) {
  const path = [];
  const seen = new Set();
  let record = recordAt(index, id);
  while (record && !seen.has(record.id)) {
    seen.add(record.id);
    path.push(record.id);
    record = record.parentId ? recordAt(index, record.parentId) : null;
  }
  return Object.freeze(path.reverse());
}

export function attNativeBreadcrumb(index, id) {
  const path = attNativeAncestors(index, id);
  return path.map(key => recordAt(index, key).name).join(' › ');
}

export function expandAttNativeAncestors(index, id, existing = new Set()) {
  const path = attNativeAncestors(index, id);
  const next = new Set(existing);
  for (const parent of path.slice(0, -1)) next.add(parent);
  return next;
}

/** Offset of a known visible ID, for search→hierarchy navigation without loss. */
export function findAttNativeVisibleOffset(index, id, expanded) {
  const target = String(id);
  const stack = index.roots.slice().reverse();
  let offset = 0;
  while (stack.length) {
    const current = stack.pop();
    if (current === target) return offset;
    const record = recordAt(index, current);
    ++offset;
    if (expanded.has(current)) {
      for (let i = record.childrenIds.length - 1; i >= 0; --i) stack.push(record.childrenIds[i]);
    }
  }
  return -1;
}
