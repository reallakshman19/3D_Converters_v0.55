export const SPLIT_RIGID_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST']);

function text(value) {
  return value == null ? '' : String(value).trim();
}

export function normalizeRef(value) {
  return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase();
}

export function stableNodeKey(row) {
  return [text(row?.branchName), normalizeRef(row?.componentRefNo), text(row?.endpoint)].join('::');
}

export function parsePosition(value) {
  const numbers = text(value).match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/g)
    ?.map(Number).filter(Number.isFinite) || [];
  return numbers.length >= 3 ? numbers.slice(0, 3) : null;
}

export function positionDistance(left, right) {
  const a = parsePosition(left);
  const b = parsePosition(right);
  if (!a || !b) return null;
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

export function isSplitRigidTransition(source, finalRow) {
  return text(source?.rigid) === ''
    && text(finalRow?.rigid) === '2'
    && Number(source?.nodeNumber) < 0
    && Number(finalRow?.nodeNumber) > 0
    && SPLIT_RIGID_TYPES.has(text(source?.componentType).toUpperCase());
}

function shortDropGroupKey(row) {
  return [
    normalizeRef(row?.componentRefNo),
    text(row?.componentType).toUpperCase(),
  ].join('::');
}

function isShortDropDiagnostic(item) {
  return item?.type === 'short-element-length-node-dropped';
}

function exactDiagnosticFor(row, diagnostics, used) {
  const key = shortDropGroupKey(row);
  return diagnostics.find((item, index) => (
    !used.has(index)
    && isShortDropDiagnostic(item)
    && shortDropGroupKey(item) === key
    && text(item.nodeNumber) === text(row.nodeNumber)
  ));
}

function groupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = shortDropGroupKey(row);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return groups;
}

function recordMatch(matches, row, diagnostic, scope) {
  matches.set(stableNodeKey(row), {
    scope,
    diagnostic: {
      type: diagnostic.type,
      nodeNumber: text(diagnostic.nodeNumber),
      componentType: text(diagnostic.componentType).toUpperCase(),
      componentRefNo: normalizeRef(diagnostic.componentRefNo),
      elementLengthMm: diagnostic.elementLengthMm ?? null,
      thresholdMm: diagnostic.thresholdMm ?? null,
    },
  });
}

export function matchShortDropProvenance(missingRows, diagnostics) {
  const rows = Array.isArray(missingRows) ? missingRows : [];
  const shortDiagnostics = (Array.isArray(diagnostics) ? diagnostics : [])
    .filter(isShortDropDiagnostic);
  const used = new Set();
  const matches = new Map();

  for (const row of rows.filter((item) => Number(item.nodeNumber) > 0)) {
    const diagnostic = exactDiagnosticFor(row, shortDiagnostics, used);
    if (!diagnostic) continue;
    const index = shortDiagnostics.indexOf(diagnostic);
    used.add(index);
    recordMatch(matches, row, diagnostic, 'exact-node');
  }

  const remaining = rows.filter((row) => !matches.has(stableNodeKey(row)));
  for (const [key, group] of groupRows(remaining).entries()) {
    if (!group.every((row) => Number(row.nodeNumber) < 0)) continue;
    const candidates = shortDiagnostics
      .map((item, index) => ({ item, index }))
      .filter(({ item, index }) => !used.has(index) && shortDropGroupKey(item) === key);
    if (candidates.length !== group.length) continue;
    const orderedRows = [...group].sort((a, b) => text(a.endpoint).localeCompare(text(b.endpoint)));
    const orderedDiagnostics = [...candidates].sort((a, b) => Number(a.item.nodeNumber) - Number(b.item.nodeNumber));
    orderedRows.forEach((row, index) => {
      const candidate = orderedDiagnostics[index];
      used.add(candidate.index);
      recordMatch(matches, row, candidate.item, 'component-ref-group');
    });
  }
  return matches;
}

export function isCanonicalCollapsedSourceHelper(source, sourceRows, toleranceMm = 0.01) {
  if (!(Number(source?.nodeNumber) < 0)) return false;
  if (!SPLIT_RIGID_TYPES.has(text(source?.componentType).toUpperCase())) return false;
  const branchRows = sourceRows.filter((row) => row.branchName === source.branchName);
  const index = branchRows.findIndex((row) => stableNodeKey(row) === stableNodeKey(source));
  const junction = index >= 0 ? branchRows[index + 1] : null;
  if (!junction || !(Number(junction.nodeNumber) > 0)) return false;
  const distance = positionDistance(source.position, junction.position);
  if (distance == null || distance > toleranceMm) return false;
  const occurrences = sourceRows.filter((row) => {
    if (text(row.nodeNumber) !== text(junction.nodeNumber)) return false;
    const gap = positionDistance(row.position, junction.position);
    return gap != null && gap <= toleranceMm;
  });
  return new Set(occurrences.map((row) => row.branchName)).size >= 2;
}
