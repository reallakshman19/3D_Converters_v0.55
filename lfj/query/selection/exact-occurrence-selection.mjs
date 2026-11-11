/**
 * LFJ R08 — source-fact-only selection over a trusted complete R05/R07 view.
 *
 * The caller owns the source-index store. readOrdered() must stream committed
 * R05 OPEN rows in original ordinal order, without reparsing raw source bytes.
 * onSelectedPage receives PROVISIONAL bounded pages: callers must not publish
 * them as complete until this function returns a complete summary.
 * No Resolver Site/Zone, engineering match, CII or export interpretation.
 */
export class OccurrenceSelectionError extends Error {
  constructor(code, message) {
    super(code + ': ' + message);
    this.name = 'OccurrenceSelectionError';
    this.code = code;
  }
}
const fail = (code, message) => { throw new OccurrenceSelectionError(code, message); };
const valid = value => typeof value === 'string' && value.length > 0 && value.length <= 67584;
const natural = value => Number.isSafeInteger(value) && value >= 0;

function verifyCommitted(view) {
  const m = view?.manifest, c = view?.completion;
  if (m?.schema !== 'LFJ.JSON.OccurrenceIndexSummary.v1' ||
      m.complete !== true || !valid(m.sourceRefId) ||
      !valid(m.sourceSha256) || !valid(m.sourceRevision) ||
      !natural(m.occurrenceCount) ||
      m.eventCount !== m.occurrenceCount * 2 ||
      m.rightsBasis !== 'SOURCE_FACTS_ONLY' || m.engineeringReady !== false ||
      typeof view.readOrdered !== 'function') {
    fail('INDEX_NOT_COMMITTED', 'complete R05 manifest and ordered committed reader required');
  }
  if (c?.schema !== 'LFJ.WorkerLifecycle.v1' ||
      c.kind !== 'SOURCE_INDEX_COMPLETE' || c.complete !== true ||
      c.sourceIndexReady !== true || c.engineeringReady !== false ||
      c.rightsBasis !== 'SOURCE_FACTS_ONLY' ||
      c.sourceRefId !== m.sourceRefId ||
      c.sourceSha256 !== m.sourceSha256 ||
      c.sourceRevision !== m.sourceRevision ||
      c.byteLength !== m.byteLength) {
    fail('INDEX_NOT_COMMITTED', 'R07 accepted source-index commit must match R05 source basis');
  }
  return m;
}

function verifyQuery(query) {
  const {mode, includes, excludes} = query ?? {};
  if (!['ALL', 'NONE', 'EXPLICIT'].includes(mode) ||
      !Array.isArray(includes) || !Array.isArray(excludes) ||
      includes.length > 4096 || excludes.length > 4096 ||
      includes.some(id => !valid(id)) || excludes.some(id => !valid(id)) ||
      new Set(includes).size !== includes.length ||
      new Set(excludes).size !== excludes.length ||
      (mode !== 'EXPLICIT' && includes.length !== 0) ||
      (mode === 'NONE' && excludes.length !== 0) ||
      (mode === 'EXPLICIT' && includes.length === 0)) {
    fail('INVALID_SCOPE', 'explicit mode and distinct original occurrence IDs required');
  }
  return {mode, includes: new Set(includes), excludes: new Set(excludes)};
}

function verifySourceBasis(query, committed) {
  const source = query?.sourceBasis;
  if (!source || typeof source !== 'object' ||
      !valid(source.sourceRefId) || !valid(source.sourceSha256) ||
      !valid(source.sourceRevision)) {
    fail('SOURCE_BASIS_REQUIRED', 'caller must bind selection to exact current source');
  }
  const same = basis => basis !== null && typeof basis === 'object' &&
    basis.sourceRefId === committed.sourceRefId &&
    basis.sourceSha256 === committed.sourceSha256 &&
    basis.sourceRevision === committed.sourceRevision;
  if (!same(source))
    fail('SOURCE_STALE', 'query source differs from the committed occurrence manifest');
  const getter = query.getCurrentBasis;
  if (getter !== undefined && typeof getter !== 'function')
    fail('INVALID_SCOPE', 'current source basis callback must be a function');
  return () => {
    if (getter === undefined) return;
    let current;
    try { current = getter(); } catch {
      fail('SOURCE_STALE', 'current source basis cannot be attested');
    }
    if (!same(current))
      fail('SOURCE_STALE', 'current original source was superseded');
  };
}

/**
 * Source-ordered selection, constant working ancestry + bounded output page.
 * Exclusions win over descendant re-inclusion (fail-closed subtree policy).
 * All emitted pages are provisional until the complete returned summary.
 */
export async function selectCommittedOccurrences(view, query, {
  onSelectedPage, pageRows = 256, maxPageBytes = 65536, signal = null
} = {}) {
  const basis = verifyCommitted(view);
  const attestCurrentSource = verifySourceBasis(query, basis);
  const scope = verifyQuery(query);
  if (typeof onSelectedPage !== 'function')
    fail('SELECTION_SINK_REQUIRED', 'provisional output-page sink required');
  if (!Number.isSafeInteger(pageRows) || pageRows < 1 || pageRows > 4096 ||
      !Number.isSafeInteger(maxPageBytes) || maxPageBytes < 256 || maxPageBytes > 1048576)
    fail('PAGE_LIMIT', 'page rows and byte budget must be finite and bounded');

  const unseenIncludes = new Set(scope.includes), unseenExcludes = new Set(scope.excludes);
  const ancestors = [];
  const encoder = new TextEncoder();
  let scanned = 0, selected = 0, staged = [], stagedBytes = 0;
  const checkCancel = () => {
    if (signal?.aborted) fail('SELECTION_ABORTED', 'source query superseded or cancelled');
    attestCurrentSource();
  };
  async function flush() {
    if (!staged.length) return;
    checkCancel();
    const batch = Object.freeze(staged);
    staged = []; stagedBytes = 0;
    await onSelectedPage(batch);
    checkCancel();
  }

  checkCancel();
  const reader = view.readOrdered();
  if (!reader || typeof reader[Symbol.asyncIterator] !== 'function')
    fail('INVALID_INDEX_READER', 'readOrdered must return a bounded asynchronous source iterator');

  for await (const row of reader) {
    checkCancel();
    if (row?.kind !== 'OPEN' ||
        row.sourceRefId !== basis.sourceRefId ||
        row.sourceSha256 !== basis.sourceSha256 ||
        row.sourceRevision !== basis.sourceRevision ||
        !valid(row.occurrenceId) ||
        !(row.parentId === null || valid(row.parentId)) ||
        row.ordinal !== scanned ||
        scanned >= basis.occurrenceCount) {
      fail('INDEX_ROW_MISMATCH', 'original source occurrence row/order/basis invalid');
    }

    if (row.parentId === null) {
      ancestors.length = 0;
    } else {
      while (ancestors.length && ancestors.at(-1).id !== row.parentId)
        ancestors.pop();
      if (!ancestors.length) {
        fail('INDEX_ANCESTRY_INVALID', 'original parent is absent from ordered ancestor chain');
      }
    }
    const parent = ancestors.at(-1);
    const excluded = Boolean(parent?.excluded) || scope.excludes.has(row.occurrenceId);
    const included = scope.mode === 'ALL' ||
      (scope.mode === 'EXPLICIT' &&
       (Boolean(parent?.included) || scope.includes.has(row.occurrenceId)));
    ancestors.push({id: row.occurrenceId, included, excluded});
    unseenIncludes.delete(row.occurrenceId);
    unseenExcludes.delete(row.occurrenceId);
    scanned++;

    if (included && !excluded) {
      const bytes = encoder.encode(JSON.stringify(row)).byteLength;
      if (bytes > maxPageBytes) fail('RESULT_ROW_LIMIT', 'one source row exceeds the bounded output budget');
      if (staged.length >= pageRows || stagedBytes + bytes > maxPageBytes) await flush();
      staged.push(row);
      stagedBytes += bytes;
      selected++;
    }
  }
  checkCancel();
  if (scanned !== basis.occurrenceCount)
    fail('INDEX_INCOMPLETE', 'committed reader was truncated before declared occurrence count');
  if (unseenIncludes.size || unseenExcludes.size)
    fail('UNKNOWN_OCCURRENCE', 'scope contains IDs absent from the committed source');
  await flush();
  return Object.freeze({
    schema: 'LFJ.OccurrenceSelectionSummary.v1',
    complete: true,
    sourceRefId: basis.sourceRefId,
    sourceSha256: basis.sourceSha256,
    sourceRevision: basis.sourceRevision,
    scannedCount: scanned,
    selectedCount: selected,
    rightsBasis: 'SOURCE_FACTS_ONLY',
    engineeringReady: false
  });
}
