const ALL_SCOPE_ID = '__ALL__';
const UNSCOPED_ID = '__UNSCOPED__';

function text(value) {
  return String(value ?? '').trim();
}

function decodeJsonString(raw) {
  if (!raw) return '';
  try { return JSON.parse('"' + raw + '"'); } catch { return raw; }
}

function fieldString(source, key) {
  const escaped = key.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const match = source.match(new RegExp('"' + escaped + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i'));
  return decodeJsonString(match?.[1] || '');
}

function firstField(source, keys) {
  for (const key of keys) {
    const value = fieldString(source, key);
    if (value) return value;
  }
  return '';
}

function matchingBracket(source, start, open, close) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function rootArrayRegion(source) {
  const start = source.search(/\S/);
  if (start < 0) return null;
  if (source[start] === '[') {
    const end = matchingBracket(source, start, '[', ']');
    return end > start ? { start, end, strategy: 'root-array' } : null;
  }
  if (source[start] !== '{') return null;
  let depth = 0;
  let quoted = false;
  let escaped = false;
  let tokenStart = -1;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') {
        quoted = false;
        if (depth === 1 && tokenStart >= 0) {
          const key = decodeJsonString(source.slice(tokenStart, i));
          let cursor = i + 1;
          while (/\s/.test(source[cursor] || '')) cursor += 1;
          if (key === 'children' && source[cursor] === ':') {
            cursor += 1;
            while (/\s/.test(source[cursor] || '')) cursor += 1;
            if (source[cursor] === '[') {
              const end = matchingBracket(source, cursor, '[', ']');
              if (end > cursor) return { start: cursor, end, strategy: 'root-children-array' };
            }
          }
        }
        tokenStart = -1;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      tokenStart = i + 1;
    } else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') depth -= 1;
  }
  return null;
}

function arrayItemRanges(source, region) {
  const out = [];
  let quoted = false;
  let escaped = false;
  let depth = 0;
  let itemStart = -1;
  for (let i = region.start + 1; i < region.end; i += 1) {
    const char = source[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') {
      if (depth === 0 && itemStart < 0) itemStart = i;
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0 && itemStart >= 0) {
        out.push({ start: itemStart, end: i + 1 });
        itemStart = -1;
      }
    }
  }
  return out;
}

function itemMetadata(source, range, itemIndex) {
  const slice = source.slice(range.start, range.end);
  const type = fieldString(slice, 'type').toUpperCase();
  const name = fieldString(slice, 'name');
  const ownerScope = firstField(slice, ['OWNER_ZONE', 'ZONE_ID', 'OWNER_SITE', 'SITE', 'ZONE']);
  const explicitContainer = ['SITE', 'ZONE', 'GROUP'].includes(type);
  const scopeId = text(explicitContainer ? (name || ownerScope) : ownerScope) || UNSCOPED_ID;
  return {
    itemIndex,
    start: range.start,
    end: range.end,
    byteLength: range.end - range.start,
    type,
    branchName: type === 'BRANCH' ? name : '',
    scopeId,
  };
}

function scopeRows(items) {
  const map = new Map();
  for (const item of items) {
    const current = map.get(item.scopeId) || {
      id: item.scopeId,
      label: item.scopeId === UNSCOPED_ID ? 'Unscoped' : item.scopeId,
      itemCount: 0,
      byteLength: 0,
      items: [],
    };
    current.itemCount += 1;
    current.byteLength += item.byteLength;
    current.items.push(item);
    map.set(item.scopeId, current);
  }
  return [...map.values()];
}

export function buildJsonHierarchyScopeIndex(stagedJsonText) {
  const source = String(stagedJsonText || '');
  const region = rootArrayRegion(source);
  if (!region) {
    return {
      schema: 'xml-cii-json-hierarchy-scope/v1',
      indexable: false,
      strategy: 'full-json-fallback',
      byteLength: source.length,
      itemCount: 0,
      scopes: [],
      defaultScopeId: ALL_SCOPE_ID,
    };
  }
  const items = arrayItemRanges(source, region).map((range, index) => itemMetadata(source, range, index));
  const scopes = scopeRows(items);
  return {
    schema: 'xml-cii-json-hierarchy-scope/v1',
    indexable: items.length > 0,
    strategy: region.strategy,
    byteLength: source.length,
    itemCount: items.length,
    scopes,
    defaultScopeId: scopes[0]?.id || ALL_SCOPE_ID,
  };
}

export function materializeJsonHierarchyScope(stagedJsonText, index, scopeId) {
  const source = String(stagedJsonText || '');
  const selectedId = text(scopeId) || index?.defaultScopeId || ALL_SCOPE_ID;
  if (selectedId === ALL_SCOPE_ID || !index?.indexable) {
    return { scopeId: ALL_SCOPE_ID, value: JSON.parse(source), itemCount: index?.itemCount || 0 };
  }
  const scope = (index.scopes || []).find((item) => item.id === selectedId);
  if (!scope) throw new Error('Unknown JSON hierarchy scope: ' + selectedId);
  const value = scope.items.map((item) => JSON.parse(source.slice(item.start, item.end)));
  return { scopeId: selectedId, value, itemCount: scope.itemCount };
}

export function jsonHierarchyScopeOptions(index) {
  return [
    ...(index?.scopes || []).map(({ id, label, itemCount, byteLength }) => ({ id, label, itemCount, byteLength })),
    { id: ALL_SCOPE_ID, label: 'All scopes', itemCount: index?.itemCount || 0, byteLength: index?.byteLength || 0 },
  ];
}

export { ALL_SCOPE_ID, UNSCOPED_ID };
