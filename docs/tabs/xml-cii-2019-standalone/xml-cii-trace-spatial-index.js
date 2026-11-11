function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function distance(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.hypot(
    finite(left.x) - finite(right.x),
    finite(left.y) - finite(right.y),
    finite(left.z) - finite(right.z),
  );
}

function axisCell(value, cellSize) {
  return Math.floor(finite(value) / cellSize);
}

function cellKey(point, cellSize) {
  return [
    axisCell(point?.x, cellSize),
    axisCell(point?.y, cellSize),
    axisCell(point?.z, cellSize),
  ].join('|');
}

function neighborKeys(point, cellSize) {
  const [x, y, z] = [
    axisCell(point?.x, cellSize),
    axisCell(point?.y, cellSize),
    axisCell(point?.z, cellSize),
  ];
  const keys = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        keys.push([x + dx, y + dy, z + dz].join('|'));
      }
    }
  }
  return keys;
}

function branchCells(index, root) {
  let cells = index.get(root);
  if (!cells) {
    cells = new Map();
    index.set(root, cells);
  }
  return cells;
}

function addGroupToCell(index, group, groupIndex, cellSize) {
  const cells = branchCells(index, group.branch?.root || '');
  const key = cellKey(group.anchor, cellSize);
  const members = cells.get(key) || [];
  members.push(groupIndex);
  cells.set(key, members);
}

function nearbyGroupIndexes(index, entry, cellSize) {
  const cells = index.get(entry.branch?.root || '');
  if (!cells) return [];
  const found = new Set();
  for (const key of neighborKeys(entry.point, cellSize)) {
    for (const groupIndex of cells.get(key) || []) found.add(groupIndex);
  }
  return [...found].sort((a, b) => a - b);
}

function bestExistingGroup(groups, indexes, entry, toleranceMm) {
  let selectedIndex = -1;
  let selectedDistance = Number.POSITIVE_INFINITY;
  for (const groupIndex of indexes) {
    const candidateDistance = distance(groups[groupIndex].anchor, entry.point);
    if (candidateDistance <= toleranceMm && candidateDistance < selectedDistance) {
      selectedIndex = groupIndex;
      selectedDistance = candidateDistance;
    }
  }
  return selectedIndex;
}

function createGroup(entry, index) {
  return {
    id: 'DTXR-G' + (index + 1),
    branch: entry.branch,
    anchor: entry.point,
    anchorJsonNodeNo: entry.jsonNodeNo,
    entries: [],
  };
}

export function groupTraceEntriesSpatially(entries = [], toleranceMm = 6) {
  const tolerance = Number.isFinite(Number(toleranceMm)) && Number(toleranceMm) > 0
    ? Number(toleranceMm)
    : 6;
  const groups = [];
  const spatial = new Map();
  for (const entry of entries) {
    const nearby = nearbyGroupIndexes(spatial, entry, tolerance);
    let groupIndex = bestExistingGroup(groups, nearby, entry, tolerance);
    if (groupIndex < 0) {
      groupIndex = groups.length;
      groups.push(createGroup(entry, groupIndex));
      addGroupToCell(spatial, groups[groupIndex], groupIndex, tolerance);
    }
    groups[groupIndex].entries.push(entry);
  }
  return groups;
}
