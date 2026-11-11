import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import {
  applyPreviewBoreWallAuthority,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js';
import { runStandaloneResolverJsonTrace } from '../tabs/xml-cii-2019-standalone/xml-cii-resolver-json-trace.js';
import {
  buildJsonHierarchyScopeIndex,
  materializeJsonHierarchyScope,
} from '../tabs/xml-cii-2019-standalone/xml-cii-json-hierarchy-scope.js';
import {
  ALL_SCOPE_ID,
  ensureResolverHierarchyScope,
} from '../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-resolver-scope.js';

const branchName = '/HBMR-1000-24"-P2810042-61440-01/B9';

function leaf(name, value) {
  return {
    nodeType: 1,
    localName: name,
    nodeName: name,
    textContent: String(value),
    childNodes: [],
  };
}

function node(fields = {}) {
  return {
    nodeType: 1,
    localName: 'Node',
    nodeName: 'Node',
    textContent: '',
    childNodes: Object.entries(fields).map(([key, value]) => leaf(key, value)),
  };
}

function branchElement(nodes) {
  return {
    nodeType: 1,
    localName: 'Branch',
    nodeName: 'Branch',
    textContent: '',
    childNodes: [leaf('Branchname', branchName), ...nodes],
  };
}

function sourceXml({ position = '0 0 0', outsideDiameter = '' } = {}) {
  return `<Root><Branch><Branchname>${branchName}</Branchname><Node>
    <NodeNumber>10</NodeNumber><ComponentType>PIPE</ComponentType>
    <Position>${position}</Position>
    ${outsideDiameter ? `<OutsideDiameter>${outsideDiameter}</OutsideDiameter>` : ''}
  </Node></Branch></Root>`;
}

function sourceDocument({ position = '0 0 0', outsideDiameter = '' } = {}) {
  const fields = {
    NodeNumber: 10,
    ComponentType: 'PIPE',
    Position: position,
  };
  if (outsideDiameter) fields.OutsideDiameter = outsideDiameter;
  const branch = branchElement([node(fields)]);
  return {
    getElementsByTagName(name) {
      if (name === 'Branch') return [branch];
      if (name === 'parsererror') return [];
      return [];
    },
  };
}

function stagedEntry({ bore, position = '0 0 0', name = 'trace-entry' }) {
  return {
    type: 'PIPE',
    name,
    attributes: {
      OWNER: branchName,
      POS: position,
      ABORE: String(bore),
      DTXR: 'SCH 80',
    },
  };
}

function stagedJson(entries) {
  return JSON.stringify([{
    type: 'BRANCH',
    name: branchName,
    children: entries,
  }]);
}

function preview({ entries = [], position = '0 0 0', outsideDiameter = '' } = {}) {
  return applyPreviewBoreWallAuthority({
    xmlText: sourceXml({ position, outsideDiameter }),
    stagedJsonText: stagedJson(entries),
    config: {},
    sourceDocument: sourceDocument({ position, outsideDiameter }),
    result: {
      branchRows: [{ branchName, sizeMm: 600, pipingClass: '' }],
      nodeRows: [],
    },
  });
}

test('resolved JSON-trace bore validates a matching Branchname fallback', () => {
  const result = preview({ entries: [stagedEntry({ bore: 600 })] });
  const row = result.nodeBoreWallRows[0];
  assert.equal(row.boreMm, 600);
  assert.equal(row.boreSource, 'branch-name-fallback');
  assert.equal(row.boreFallbackUsed, true);
  assert.equal(row.boreValidationTraceMm, 600);
  assert.equal(row.boreTraceMismatch, false);
  assert.equal(row.boreNeedsReview, false);
  assert.equal(row.boreTraceStatus, 'RESOLVED_POS');
});

test('resolved JSON-trace bore flags a Branchname fallback mismatch', () => {
  const result = preview({ entries: [stagedEntry({ bore: 50 })] });
  const row = result.nodeBoreWallRows[0];
  assert.equal(row.boreMm, 600);
  assert.equal(row.boreSource, 'branch-name-fallback');
  assert.equal(row.boreValidationTraceMm, 50);
  assert.equal(row.boreTraceMismatch, true);
  assert.equal(row.boreNeedsReview, true);
  assert.equal(row.boreTraceStatus, 'RESOLVED_POS');
  assert.ok(
    result.boreAuthorityDiagnostics.some((item) => item.type === 'bore-fallback-trace-mismatch'),
    'fallback/trace mismatch must be surfaced in Preview diagnostics',
  );
});

test('unresolved JSON trace makes an unvalidated Branchname fallback review-required', () => {
  const result = preview({ entries: [stagedEntry({ bore: 50, position: '100 0 0' })] });
  const row = result.nodeBoreWallRows[0];
  assert.equal(row.boreMm, 600);
  assert.equal(row.boreFallbackUsed, true);
  assert.equal(row.boreValidationTraceMm, null);
  assert.equal(row.boreTraceStatus, 'UNRESOLVED');
  assert.equal(row.boreNeedsReview, true);
  assert.ok(
    result.boreAuthorityDiagnostics.some((item) => item.type === 'bore-fallback-trace-unresolved'),
    'unresolved trace must flag an unvalidated Branchname fallback',
  );
});

test('ambiguous JSON trace preserves ledger ambiguity and blocks silent fallback acceptance', () => {
  const result = preview({
    entries: [
      stagedEntry({ bore: 50, position: '5 0 0', name: 'left' }),
      stagedEntry({ bore: 80, position: '-5 0 0', name: 'right' }),
    ],
  });
  const row = result.nodeBoreWallRows[0];
  assert.equal(row.boreMm, 600);
  assert.equal(row.boreFallbackUsed, true);
  assert.equal(row.boreTraceStatus, 'AMBIGUOUS_REVIEW');
  assert.equal(row.boreNeedsReview, true);
  assert.ok(
    result.boreAuthorityDiagnostics.some((item) => item.type === 'bore-fallback-trace-ambiguous'),
    'ambiguous trace must preserve review-required semantics',
  );
});

test('source XML geometry remains primary and does not emit fallback diagnostics', () => {
  const result = preview({
    outsideDiameter: '33.4',
    entries: [stagedEntry({ bore: 600 })],
  });
  const row = result.nodeBoreWallRows[0];
  assert.equal(row.boreMm, 25);
  assert.equal(row.boreSource, 'xml-outside-diameter');
  assert.equal(row.boreFallbackUsed, false);
  assert.equal(row.boreNeedsReview, false);
  assert.equal(
    result.boreAuthorityDiagnostics.filter((item) => item.type.startsWith('bore-fallback-trace-')).length,
    0,
  );
});


const scopeBranchA = '/SCOPE-A-4"-P1000001-61440-01/B1';
const scopeBranchB = '/SCOPE-B-4"-P1000002-61440-01/B1';

function scopedBranch(name, site, position, tag, dtxr) {
  return {
    type: 'BRANCH',
    name,
    attributes: { OWNER_SITE: site },
    children: [{
      type: 'ATTA',
      name: tag,
      attributes: {
        NAME: tag,
        POS: position,
        DTXR: dtxr,
        ABORE: '100',
      },
    }],
  };
}

function scopedResolverSourceXml() {
  return `<Root><Branch><Branchname>${scopeBranchB}</Branchname><Node>
    <NodeNumber>20</NodeNumber><NodeName>PS-B</NodeName><ComponentType>ANCI</ComponentType>
    <Position>100 0 0</Position>
  </Node></Branch></Root>`;
}

function scopedResolverJson() {
  return JSON.stringify([
    scopedBranch(scopeBranchA, '/ZONE-A', '0 0 0', '/PS-A', 'REST-A'),
    scopedBranch(scopeBranchB, '/ZONE-B', '100 0 0', '/PS-B', 'REST-B'),
  ]);
}

function resolutionSummary(result) {
  return result.resolutionLedger.map((row) => ({
    xmlNodeNumber: row.xmlNodeNumber,
    status: row.status,
    effectiveDtxr: row.effectiveDtxr,
    sourceBranch: row.sourceBranch,
    matchType: row.matchType,
  }));
}

test('bounded JSON Trace scope preserves selected-branch resolution parity', () => {
  const input = {
    sourceKind: 'xml',
    sourceText: scopedResolverSourceXml(),
    stagedJsonText: scopedResolverJson(),
    supportConfigJson: '{}',
  };
  const legacy = runStandaloneResolverJsonTrace(input);
  const scoped = runStandaloneResolverJsonTrace({ ...input, jsonTraceScopeId: '/ZONE-B' });
  assert.equal(legacy.traceResolutionLedger.groups.length, 2);
  assert.equal(scoped.traceResolutionLedger.groups.length, 1);
  assert.equal(scoped.hierarchyScope.applied, true);
  assert.equal(scoped.hierarchyScope.selectedScopeId, '/ZONE-B');
  assert.equal(scoped.hierarchyScope.selectedItemCount, 1);
  assert.deepEqual(resolutionSummary(scoped), resolutionSummary(legacy));
  assert.equal(scoped.positionIndex.entries.some((entry) => Object.hasOwn(entry, 'raw')), false);
  assert.equal(scoped.traceResolutionLedger.groups.some((group) =>
    group.entries.some((entry) => Object.hasOwn(entry, 'raw'))), false);
});

test('explicit All scopes preserves legacy all-source resolver result', () => {
  const input = {
    sourceKind: 'xml',
    sourceText: scopedResolverSourceXml(),
    stagedJsonText: scopedResolverJson(),
    supportConfigJson: '{}',
  };
  const legacy = runStandaloneResolverJsonTrace(input);
  const all = runStandaloneResolverJsonTrace({ ...input, jsonTraceScopeId: '__ALL__' });
  assert.equal(all.hierarchyScope.applied, false);
  assert.equal(all.traceResolutionLedger.groups.length, legacy.traceResolutionLedger.groups.length);
  assert.deepEqual(resolutionSummary(all), resolutionSummary(legacy));
});

test('unknown JSON Trace scope fails explicitly instead of silently dropping branches', () => {
  assert.throws(() => runStandaloneResolverJsonTrace({
    sourceKind: 'xml',
    sourceText: scopedResolverSourceXml(),
    stagedJsonText: scopedResolverJson(),
    supportConfigJson: '{}',
    jsonTraceScopeId: '/ZONE-MISSING',
  }), /Unknown JSON hierarchy scope/);
});


test('Resolver UI defaults to bounded scope while preserving explicit All scopes', () => {
  const stagedJsonText = scopedResolverJson();
  const stateRef = { current: { stagedJsonText } };
  const bounded = ensureResolverHierarchyScope(stateRef.current, stateRef);
  assert.equal(bounded.index.indexable, true);
  assert.equal(bounded.selectedScopeId, '/ZONE-A');
  assert.equal(stateRef.current.jsonTraceScopeId, '/ZONE-A');
  const cached = stateRef.current.resolverJsonTraceUiScopeCache.index;
  assert.equal(ensureResolverHierarchyScope(stateRef.current, stateRef).index, cached);

  stateRef.current = { ...stateRef.current, jsonTraceScopeId: ALL_SCOPE_ID };
  const all = ensureResolverHierarchyScope(stateRef.current, stateRef);
  assert.equal(all.selectedScopeId, ALL_SCOPE_ID);
});

test('Resolver panel render stays lazy until explicit Build / refresh action', async () => {
  const panelSource = await readFile(
    new URL('../tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-resolver-json-trace.js', import.meta.url),
    'utf8',
  );
  assert.equal(panelSource.includes("import { runStandaloneResolverJsonTrace }"), false);
  assert.equal(panelSource.includes('result = runStandaloneResolverJsonTrace('), false);
  assert.match(panelSource, /ensureResolverHierarchyScope\(state, stateRef\)/);
  assert.match(panelSource, /Build \/ refresh resolver index/);
});


test('checked-in managed-stage fixture builds a bounded hierarchy index', async () => {
  const fixture = await readFile(
    new URL('../Benchmarks/Managejson to Input XML/ATTRIBUTE_managed_stage.json', import.meta.url),
    'utf8',
  );
  const started = performance.now();
  const index = buildJsonHierarchyScopeIndex(fixture);
  const elapsedMs = performance.now() - started;
  assert.ok(fixture.length > 10_000_000, 'fixture must remain representative of the large-file class');
  assert.equal(index.indexable, true);
  assert.ok(index.itemCount > 0);
  assert.ok(index.scopes.length > 0);
  assert.notEqual(index.defaultScopeId, ALL_SCOPE_ID);
  console.log(
    'J01-U5-real-fixture bytes=' + fixture.length
      + ' items=' + index.itemCount
      + ' scopes=' + index.scopes.length
      + ' index_ms=' + elapsedMs.toFixed(1),
  );
});

test('generated ~30 MB staged JSON indexes globally but materializes only the selected scope', () => {
  const target = JSON.stringify(scopedBranch(scopeBranchA, '/ZONE-A', '0 0 0', '/PS-A', 'REST-A'));
  const padding = 'X'.repeat(30 * 1024 * 1024);
  const unselected = JSON.stringify({
    type: 'BRANCH',
    name: '/LARGE-UNSELECTED/B1',
    attributes: { OWNER_SITE: '/ZONE-B', PADDING: padding },
    children: [],
  });
  const stagedJsonText = '[' + target + ',' + unselected + ']';
  const indexStarted = performance.now();
  const index = buildJsonHierarchyScopeIndex(stagedJsonText);
  const indexMs = performance.now() - indexStarted;
  const materializeStarted = performance.now();
  const selected = materializeJsonHierarchyScope(stagedJsonText, index, '/ZONE-A');
  const materializeMs = performance.now() - materializeStarted;

  assert.ok(stagedJsonText.length >= 30 * 1024 * 1024);
  assert.equal(index.itemCount, 2);
  assert.equal(selected.itemCount, 1);
  assert.equal(selected.value.length, 1);
  assert.equal(selected.value[0].name, scopeBranchA);
  assert.ok(indexMs < 10_000, '30 MB hierarchy scan must stay bounded on hosted qualification');
  assert.ok(materializeMs < 2_000, 'selected-scope materialization must not parse the unselected 30 MB branch');
  console.log(
    'J01-U5-generated bytes=' + stagedJsonText.length
      + ' index_ms=' + indexMs.toFixed(1)
      + ' selected_materialize_ms=' + materializeMs.toFixed(1),
  );
});

test('J01 source and docs mirrors remain byte-identical', async () => {
  const relativePairs = [
    'xml-cii-json-hierarchy-scope.js',
    'xml-cii-trace-spatial-index.js',
    'xml-cii-resolver-json-trace.js',
    'xml-cii-trace-resolution-ledger.js',
    'ui-adapted/xml-cii-adapted-resolver-json-trace.js',
    'ui-adapted/xml-cii-adapted-resolver-scope.js',
  ];
  for (const relative of relativePairs) {
    const [sourceText, docsText] = await Promise.all([
      readFile(new URL('../tabs/xml-cii-2019-standalone/' + relative, import.meta.url), 'utf8'),
      readFile(new URL('../docs/tabs/xml-cii-2019-standalone/' + relative, import.meta.url), 'utf8'),
    ]);
    assert.equal(docsText, sourceText, relative + ' source/docs mirror drift');
  }
});
