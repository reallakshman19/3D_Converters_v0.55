#!/usr/bin/env node
/**
 * H5 independent real private ATT manifest gate. Run on an authorized local
 * extracted AML TXT; never commit the original input or uploaded evidence.
 * e.g. node scripts/att-native-aml-golden-check.mjs /private/AML.txt
 */
import assert from 'node:assert/strict';
import { createReadStream, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { indexAttNativeHierarchy, walkAttSubtreeIds } from '../tabs/model-converters/att-native-hierarchy-index.js';
import { projectAttNativeTree, attNativeAncestors, expandAttNativeAncestors, findAttNativeVisibleOffset } from '../tabs/model-converters/att-native-tree-projection.js';
import { createAttScopeSelection, setAttScopeRule, resolveAttScopeSelection } from '../tabs/model-converters/att-native-scope-selection.js';

const GOLDEN = Object.freeze({
  sha256: '1c1702d3a352c9f62f0b85f41c8185d2a64501e75fcd85c94a0662efad1853f5',
  size: 90852184, typed: 105601, sites: 18, zones: 192, branches: 778, pipes: 377,
});

const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node scripts/att-native-aml-golden-check.mjs /private/AML_2026Oct06-1417.txt');
  process.exitCode = 2;
} else {
  async function hashFile(file) {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return hash.digest('hex');
  }
  const sha256 = await hashFile(filename);
  assert.equal(sha256, GOLDEN.sha256, 'Refuse stale/foreign fixture');
  assert.equal(statSync(filename).size, GOLDEN.size);
  const t0 = performance.now();
  const index = await indexAttNativeHierarchy(createReadStream(filename));
  const elapsedMs = Math.round(performance.now() - t0);
  assert.equal(index.counts.typed, GOLDEN.typed);
  assert.equal(index.counts.sites, GOLDEN.sites);
  assert.equal(index.counts.zones, GOLDEN.zones);
  assert.equal(index.counts.branches, GOLDEN.branches);
  assert.equal(index.counts.pipes, GOLDEN.pipes);
  assert.equal(index.counts.unresolved, 1);
  assert.equal(index.counts.duplicatedNames, 0);
  assert.equal(index.byId.size, GOLDEN.typed);
  const visited = new Set();
  for (const root of index.roots) for (const id of walkAttSubtreeIds(index, root)) {
    assert.equal(visited.has(id), false, 'Multiple parent paths: ' + id);
    visited.add(id);
  }
  assert.equal(visited.size, GOLDEN.typed, 'All indexed objects must be root-reachable.');
  const zones = index.records.filter(record => record.type === 'ZONE');
  assert.equal(zones.length, GOLDEN.zones);
  for (const zone of zones) {
    const ancestors = attNativeAncestors(index, zone.id);
    assert.equal(ancestors.at(-1), zone.id);
    assert.ok(ancestors.length >= 2, 'Orphaned zone ' + zone.id);
  }
  const zoneA = index.byId.get('/ASIM-1835-CU-CI-FDNS');
  const zoneB = index.byId.get('/ASIM-1835-CU-CI-FDSB');
  assert.equal(zoneA?.type, 'ZONE');
  assert.equal(zoneB?.type, 'ZONE');
  let chosen = createAttScopeSelection();
  chosen = setAttScopeRule(index, chosen, zoneA.id, true);
  chosen = setAttScopeRule(index, chosen, zoneB.id, true);
  const target = new Set([...walkAttSubtreeIds(index, zoneA.id), ...walkAttSubtreeIds(index, zoneB.id)]);
  const resolved = resolveAttScopeSelection(index, chosen);
  assert.equal(resolved.selectedNativeCount, target.size, 'Selected native identity loss.');
  const expectedBranches = [...target]
    .filter(id => index.byId.get(id)?.type === 'BRAN')
    .map(id => 'branch:' + index.byId.get(id).name).sort();
  assert.deepEqual([...resolved.selectedBranchIds].sort(), expectedBranches);
  const closed = projectAttNativeTree(index);
  assert.ok(closed.rows.length <= 120);
  assert.equal(closed.indexedTotal, GOLDEN.typed);
  const expanded = expandAttNativeAncestors(index, zoneA.id);
  const visibleAt = findAttNativeVisibleOffset(index, zoneA.id, expanded);
  assert.ok(visibleAt >= 0);
  const opened = projectAttNativeTree(index, {
    expanded, offset: Math.floor(visibleAt / 120) * 120,
  });
  assert.ok(opened.rows.length <= 120);
  assert.ok(opened.rows.some(row => row.id === zoneA.id));
  assert.equal(projectAttNativeTree(index, { search: zoneA.name }).matchedTotal >= 1, true);
  const report = {
    fixtureSha256: sha256, typed: index.counts.typed,
    sites: index.counts.sites, zones: index.counts.zones,
    bran: index.counts.branches, pipes: index.counts.pipes,
    unresolved: index.counts.unresolved, allReachable: visited.size,
    selectedZones: [zoneA.name, zoneB.name],
    independentlySelectedNativeCount: target.size,
    selectedBranchCount: expectedBranches.length,
    renderedInitialRows: closed.rows.length,
    maximumWindowRows: 120,
    indexDurationMs: elapsedMs,
    peakRssBytes: process.memoryUsage().rss,
    qualification: 'INDEX_SELECTION_ONLY_NOT_BROWSER_OR_OUTPUT_PARITY',
  };
  console.log('ATT_NATIVE_AML_GOLDEN_PASS ' + JSON.stringify(report));
}
