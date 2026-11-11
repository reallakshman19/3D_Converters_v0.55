/**
 * Native ATT selection authority, independent of DOM/page/search. Rules are
 * subtree predicates keyed to exact indexed IDs, not displayed checkboxes.
 * A more specific rule overrides its selected/unselected ancestor.
 */
export function createAttScopeSelection() {
  return Object.freeze({ rules: new Map() });
}

function isDescendant(index, descendantId, ancestorId) {
  const seen = new Set();
  let id = descendantId;
  while (id && !seen.has(id)) {
    if (id === ancestorId) return true;
    seen.add(id);
    id = index.byId.get(id)?.parentId;
  }
  return false;
}

export function setAttScopeRule(index, selection, id, checked) {
  if (!index.byId.has(id)) throw new Error('Unknown native ATT identity: ' + id);
  const rules = new Map(selection?.rules || []);
  // A parent explicitly selected or cleared replaces child rules but does not
  // change independent siblings.
  for (const key of rules.keys()) {
    if (isDescendant(index, key, id)) rules.delete(key);
  }
  rules.set(id, Boolean(checked));
  return Object.freeze({ rules });
}

export function attScopeEffectiveChecked(index, selection, id) {
  if (!index.byId.has(id)) throw new Error('Unknown native ATT identity: ' + id);
  const rules = selection?.rules || new Map();
  const seen = new Set();
  let current = id;
  while (current && !seen.has(current)) {
    if (rules.has(current)) return rules.get(current);
    seen.add(current);
    current = index.byId.get(current)?.parentId;
  }
  return false;
}

export function attScopeNodeState(index, selection, id) {
  const checked = attScopeEffectiveChecked(index, selection, id);
  // Any stricter selection/exclusion under this node makes the subtree mixed.
  for (const [key, override] of selection?.rules || []) {
    if (key !== id && override !== checked && isDescendant(index, key, id)) return 'mixed';
  }
  return checked ? 'checked' : 'unchecked';
}

/** One canonical resolver used for both displayed counts and export scope. */
export function resolveAttScopeSelection(index, selection, options = {}) {
  const rules = selection?.rules || new Map();
  const branchIds = [];
  const selectedNames = options.includeNativeIds ? [] : null;
  const selectedByType = Object.create(null);
  let nativeCount = 0;
  // Traversing the root graph once avoids evaluating 105k ancestor chains
  // on every conversion. H1 must have resolved cycles into roots.
  const stack = index.roots.slice().reverse().map(id => ({ id, active: false }));
  const seen = new Set();
  while (stack.length) {
    const { id, active } = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const rec = index.byId.get(id);
    const included = rules.has(id) ? rules.get(id) : active;
    if (included) {
      nativeCount++;
      selectedByType[rec.type] = (selectedByType[rec.type] || 0) + 1;
      if (selectedNames) selectedNames.push(id);
      if (rec.type === 'BRAN') branchIds.push('branch:' + rec.name);
    }
    for (let i = rec.childrenIds.length - 1; i >= 0; --i) {
      stack.push({ id: rec.childrenIds[i], active: included });
    }
  }
  if (seen.size !== index.counts.typed) {
    throw new Error('Native ATT index contains unreachable records: '
      + seen.size + '/' + index.counts.typed);
  }
  return Object.freeze({
    selectedNativeCount: nativeCount,
    selectedBranchIds: Object.freeze(branchIds),
    selectedNativeIds: selectedNames && Object.freeze(selectedNames),
    byType: Object.freeze({ ...selectedByType }),
    explicitSelection: [...rules.values()].some(value => value === true),
  });
}

/** A branch-selected subtree with excluded children cannot be emitted whole. */
export function attScopePartiallyExcludedBranches(index, selection) {
  const violations = new Set();
  for (const [id, enabled] of selection?.rules || []) {
    if (enabled) continue;
    const seen = new Set();
    let cursor = index.byId.get(id)?.parentId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const parent = index.byId.get(cursor);
      if (!parent) break;
      if (parent.type === 'BRAN' && attScopeEffectiveChecked(index, selection, cursor)) {
        violations.add(cursor);
        break;
      }
      cursor = parent.parentId;
    }
  }
  return Object.freeze([...violations]);
}

/** Remove an explicit source-ID include/exclude override, restoring inherited state. */
export function removeAttScopeRule(index, selection, id) {
  if (!index.byId.has(id)) throw new Error('Unknown native ATT identity: ' + id);
  const rules = new Map(selection?.rules || []);
  rules.delete(id);
  return Object.freeze({ rules });
}

/** Stable view of explicit choices. The underlying ID rules remain the authority. */
export function listAttScopeRules(index, selection) {
  return Object.freeze([...selection?.rules || []].map(([id, checked]) => {
    const record = index.byId.get(id);
    if (!record) throw new Error('Unknown native ATT identity: ' + id);
    return Object.freeze({ id, name: record.name, type: record.type, checked });
  }));
}
