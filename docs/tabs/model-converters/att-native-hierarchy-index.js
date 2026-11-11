/**
 * Lossless hierarchy index for CADC/PDMS ATT files. This is not geometry conversion.
 * NAME/TYPE/OWNER and source line spans are kept for every NEW block, including
 * non-piping records excluded by the RMSS routing parser. Read the input as a stream.
 */
async function* chunksOf(input) {
  if (typeof input === 'string' || input instanceof Uint8Array) {
    yield input;
  } else if (input && typeof input[Symbol.asyncIterator] === 'function') {
    yield* input;
  } else if (input && typeof input.stream === 'function') {
    yield* chunksOf(input.stream());
  } else if (input && typeof input.getReader === 'function') {
    const reader = input.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally { reader.releaseLock(); }
  } else {
    throw new TypeError('ATT index needs text or a streaming byte source.');
  }
}

async function* linesOf(input) {
  const decoder = new TextDecoder('utf-8');
  let pending = '';
  for await (const chunk of chunksOf(input)) {
    pending += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    let end;
    while ((end = pending.indexOf('\n')) !== -1) {
      const line = pending.slice(0, end);
      yield line.endsWith('\r') ? line.slice(0, -1) : line;
      pending = pending.slice(end + 1);
    }
  }
  pending += decoder.decode();
  if (pending) yield pending.endsWith('\r') ? pending.slice(0, -1) : pending;
}

function createRecord(heading, ordinal, startLine) {
  return {
    id: '', ordinal, heading, name: '', type: '', owner: '', startLine,
    endLine: null, parentId: null, childrenIds: [],
  };
}

/**
 * @param {string|Uint8Array|AsyncIterable<Uint8Array>|ReadableStream|Blob} source
 * @param {{onProgress?:(counts:object)=>void, progressInterval?:number}} options
 */
export async function indexAttNativeHierarchy(source, options = {}) {
  const records = [];
  const metadata = [];
  const countsByType = Object.create(null);
  let current = null;
  let lineNo = 0;
  const finish = (endLine) => {
    if (!current) return;
    current.endLine = endLine;
    if (current.type) {
      records.push(current);
      countsByType[current.type] = (countsByType[current.type] || 0) + 1;
      if (typeof options.onProgress === 'function'
        && records.length % Math.max(1, options.progressInterval || 10000) === 0) {
        options.onProgress(Object.freeze({ typed: records.length, sourceLines: lineNo }));
      }
    } else {
      metadata.push(current);
    }
    current = null;
  };
  for await (let line of linesOf(source)) {
    ++lineNo;
    line = line.trim().replace(/^\uFEFF/, '');
    if (line.startsWith('NEW ')) {
      finish(lineNo - 1);
      current = createRecord(line.slice(4).trim(), records.length + metadata.length, lineNo);
    } else if (line === 'END') {
      finish(lineNo);
    } else if (current) {
      const colon = line.indexOf(':=');
      if (colon < 0) continue;
      const field = line.slice(0, colon).trim().replace(/^:/, '').toUpperCase();
      if (field === 'NAME') current.name = line.slice(colon + 2).trim();
      else if (field === 'TYPE') current.type = line.slice(colon + 2).trim().toUpperCase();
      else if (field === 'OWNER') current.owner = line.slice(colon + 2).trim();
    }
  }
  finish(lineNo);

  const byId = new Map();
  // Reserve all raw names: a synthetic duplicate suffix must never steal a real NAME.
  const rawNames = new Set(records.map(record => record.name || record.heading));
  const byName = new Map();
  const duplicateNames = [];
  for (const record of records) {
    record.name ||= record.heading;
    const collisionList = byName.get(record.name) || [];
    collisionList.push(record);
    byName.set(record.name, collisionList);
    if (collisionList.length === 1) record.id = record.name;
    else {
      let suffix = collisionList.length;
      record.id = record.name + '#' + suffix;
      while (rawNames.has(record.id) || byId.has(record.id)) {
        record.id = record.name + '#' + (++suffix);
      }
    }
    byId.set(record.id, record);
    if (collisionList.length > 1) duplicateNames.push(record.id);
  }
  const roots = [];
  const unresolvedOwners = [];
  const ambiguousOwners = [];
  for (const record of records) {
    const parentName = record.owner;
    if (!parentName || parentName === '/*') {
      roots.push(record.id);
      continue;
    }
    const matches = byName.get(parentName) || [];
    if (matches.length !== 1 || matches[0] === record) {
      const diagnostic = { id: record.id, owner: parentName };
      if (matches.length > 1) ambiguousOwners.push(diagnostic);
      else unresolvedOwners.push(diagnostic);
      roots.push(record.id); // preserve under Unresolved owner, never drop
      continue;
    }
    record.parentId = matches[0].id;
    matches[0].childrenIds.push(record.id);
  }
  // A native source can contain owner cycles. Cut one edge per cycle into
  // an explicit root, preserving every record and preventing invisible subtrees.
  const cycles = [];
  const visited = new Set();
  for (const record of records) {
    if (visited.has(record.id)) continue;
    const path = new Set();
    let current = record;
    while (current && !visited.has(current.id) && !path.has(current.id)) {
      path.add(current.id);
      current = current.parentId ? byId.get(current.parentId) : null;
    }
    if (current && path.has(current.id)) {
      const parent = byId.get(current.parentId);
      if (parent) parent.childrenIds = parent.childrenIds.filter(id => id !== current.id);
      cycles.push({ id: current.id, owner: current.parentId });
      current.parentId = null;
      roots.push(current.id);
    }
    for (const id of path) visited.add(id);
  }
  const counts = Object.freeze({
    typed: records.length, metadata: metadata.length, lines: lineNo,
    sites: countsByType.SITE || 0, zones: countsByType.ZONE || 0,
    branches: countsByType.BRAN || 0, pipes: countsByType.PIPE || 0,
    roots: roots.length, unresolved: unresolvedOwners.length,
    ambiguous: ambiguousOwners.length, duplicatedNames: duplicateNames.length,
    cycles: cycles.length,
  });
  return {
    records, byId, roots, metadata, counts,
    countsByType: Object.freeze({ ...countsByType }),
    diagnostics: { unresolvedOwners, ambiguousOwners, duplicateNames, cycles },
  };
}

/** Retrieve one page; paging limits DOM size, never the modeled node count. */
export function pageAttChildren(index, parentId, offset = 0, pageSize = 100) {
  const ids = parentId == null ? index.roots : index.byId.get(parentId)?.childrenIds;
  if (!ids) throw new Error('Unknown native ATT identity: ' + parentId);
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new RangeError('Expected nonnegative offset and positive integer pageSize.');
  }
  return Object.freeze({
    total: ids.length, offset,
    rows: ids.slice(offset, offset + pageSize).map(id => index.byId.get(id)),
  });
}

/** Selection enumeration is independent of DOM expansion and child paging. */
export function* walkAttSubtreeIds(index, selectedId) {
  if (!index.byId.has(selectedId)) throw new Error('Unknown native ATT identity: ' + selectedId);
  const seen = new Set();
  const stack = [selectedId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    yield id;
    const record = index.byId.get(id);
    for (let i = record.childrenIds.length - 1; i >= 0; --i) stack.push(record.childrenIds[i]);
  }
}
