import {
  isCanonicalCollapsedSourceHelper,
  isSplitRigidTransition,
  matchShortDropProvenance,
  stableNodeKey,
} from './topology-delta-authority.js';

function text(value) { return value == null ? '' : String(value).trim(); }
function sameNumber(left, right, tolerance = 1e-6) {
  const a = Number(left), b = Number(right);
  if (!Number.isFinite(a) && !Number.isFinite(b)) return true;
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}
function reasonCounts(rows) {
  const out = {};
  for (const row of rows || []) {
    const key = row.reason || row.status || 'unknown';
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export function auditRowsByPath(audit, prefix) {
  return (audit?.rows || []).filter((row) => (
    text(row.path).startsWith(prefix)
    && ['DISCONNECTED', 'ORPHAN'].includes(text(row.status))
  ));
}
export function summarizeTopologyAudit(audit) {
  const topologyFindings = auditRowsByPath(audit, 'Path 1');
  const continuityFailures = auditRowsByPath(audit, 'Path 2');
  return {
    topologyFindings,
    topologyReasonCounts: reasonCounts(topologyFindings),
    continuityFailures,
    stats: audit?.stats || {},
  };
}
function delta(field, source, final, reason, result = 'PASS') {
  return { field, source, final, reason, result };
}
function lookup(source, key) {
  return source instanceof Map ? source.get(key) : source?.[key];
}
function wallForDn(wallByDn, dn) {
  return lookup(wallByDn, Number(dn)) ?? lookup(wallByDn, String(dn)) ?? null;
}

function classifyMissing(source, sourceNodes, shortMatches) {
  const key = stableNodeKey(source);
  if (text(source.componentType).toUpperCase() === 'GASK') {
    return { key, reason: 'cleanup:gasket', result: 'PASS' };
  }
  if (shortMatches.has(key)) {
    return {
      key,
      reason: 'cleanup:short-element',
      result: 'PASS',
      provenance: shortMatches.get(key),
    };
  }
  if (isCanonicalCollapsedSourceHelper(source, sourceNodes)) {
    return { key, reason: 'cleanup:canonical-junction-helper-collapse', result: 'PASS' };
  }
  return { key, reason: 'source-node-missing-from-final', result: 'FAIL' };
}

function identityChanges(source, finalRow) {
  const changes = [];
  if (text(source.nodeNumber) !== text(finalRow.nodeNumber)) {
    const canonical = Number(source.nodeNumber) < 0 && Number(finalRow.nodeNumber) > 0;
    changes.push(delta('NodeNumber', source.nodeNumber, finalRow.nodeNumber,
      canonical ? 'runtime:canonical-node-numbering' : 'UNEXPLAINED',
      canonical ? 'PASS' : 'FAIL'));
  }
  for (const field of ['componentType', 'position']) {
    if (text(source[field]) !== text(finalRow[field])) {
      changes.push(delta(field, source[field], finalRow[field], 'UNEXPLAINED', 'FAIL'));
    }
  }
  if (!sameNumber(source.outsideDiameter, finalRow.outsideDiameter)) {
    changes.push(delta('OutsideDiameter', source.outsideDiameter, finalRow.outsideDiameter, 'UNEXPLAINED', 'FAIL'));
  }
  if (text(source.rigid) !== text(finalRow.rigid)) {
    const governed = isSplitRigidTransition(source, finalRow);
    changes.push(delta('Rigid', source.rigid, finalRow.rigid,
      governed ? 'authority:split-condensed-rigid-marker' : 'UNEXPLAINED',
      governed ? 'PASS' : 'FAIL'));
  }
  return changes;
}

function authorityChanges(source, finalRow, nominalDnFromOd, wallByDn, weightTargets) {
  const changes = [];
  const dn = nominalDnFromOd(source.outsideDiameter);
  if (dn != null) {
    changes.push(delta('BoreMm', source.boreMm, finalRow.boreMm,
      'authority:source-outside-diameter',
      sameNumber(finalRow.boreMm, dn) ? 'PASS' : 'FAIL'));
    const wall = wallForDn(wallByDn, dn);
    if (wall != null) {
      changes.push(delta('WallThickness', source.wallThickness, finalRow.wallThickness,
        'authority:piping-class-master',
        sameNumber(finalRow.wallThickness, wall) ? 'PASS' : 'FAIL'));
    }
  }
  const target = lookup(weightTargets, stableNodeKey(source));
  if (target != null) {
    changes.push(delta('Weight', source.weight, finalRow.weight,
      'authority:reviewed-exact-rigid-owner',
      sameNumber(finalRow.weight, target) ? 'PASS' : 'FAIL'));
  } else if (!sameNumber(source.weight, finalRow.weight)) {
    changes.push(delta('Weight', source.weight, finalRow.weight, 'UNEXPLAINED', 'FAIL'));
  }
  return changes;
}

export function evaluateEngineeringDeltas({
  sourceNodes, finalNodes, diagnostics, nominalDnFromOd, wallByDn, weightTargets,
}) {
  const sourceRows = Array.isArray(sourceNodes) ? sourceNodes : [];
  const finalRows = Array.isArray(finalNodes) ? finalNodes : [];
  const finalByKey = new Map(finalRows.map((row) => [stableNodeKey(row), row]));
  const sourceKeys = new Set(sourceRows.map(stableNodeKey));
  const missing = sourceRows.filter((row) => !finalByKey.has(stableNodeKey(row)));
  const shortMatches = matchShortDropProvenance(missing, diagnostics);
  const removed = missing.map((row) => classifyMissing(row, sourceRows, shortMatches));
  const retained = sourceRows.filter((row) => finalByKey.has(stableNodeKey(row))).map((source) => {
    const finalRow = finalByKey.get(stableNodeKey(source));
    return {
      key: stableNodeKey(source),
      changes: [
        ...identityChanges(source, finalRow),
        ...authorityChanges(source, finalRow, nominalDnFromOd, wallByDn, weightTargets),
      ],
    };
  });
  const generated = finalRows
    .filter((row) => !sourceKeys.has(stableNodeKey(row)))
    .map((row) => ({ key: stableNodeKey(row), reason: 'UNEXPLAINED_FINAL_NODE', result: 'FAIL' }));
  const unexplained = [
    ...removed.filter((item) => item.result === 'FAIL'),
    ...retained.flatMap((item) => item.changes
      .filter((change) => change.result === 'FAIL')
      .map((change) => ({ key: item.key, ...change }))),
    ...generated,
  ];
  return {
    ok: unexplained.length === 0,
    removed, retained, generated, unexplained,
    removalReasonCounts: reasonCounts(removed),
  };
}
