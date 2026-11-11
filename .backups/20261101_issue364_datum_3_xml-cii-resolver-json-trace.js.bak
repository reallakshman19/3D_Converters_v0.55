import { detectXmlCiiWorkflowSourceKind } from './xml-cii-workflow-source-detect.js';
import {
  buildStandaloneDtxrResolutionLedger,
  parseStandaloneDtxrXmlNodes,
} from './xml-cii-trace-resolution-ledger.js';
import {
  DEFAULT_JSON_TRACE_CAPTURE_FIELDS,
  decorateJsonTraceLedger,
  normalizeJsonTraceCaptureFields,
} from './xml-cii-json-trace-fields.js';
import {
  ALL_SCOPE_ID,
  buildJsonHierarchyScopeIndex,
  materializeJsonHierarchyScope,
} from './xml-cii-json-hierarchy-scope.js';

export function createDefaultResolverJsonTraceConfig() {
  return {
    nodeAliases: ['node', 'nodeKey', 'NODE', 'Node', 'FROM_NODE', 'TO_NODE'],
    psAliases: ['ps', 'PS', 'DTXR_PS', 'supportPs', 'psNo'],
    posAliases: ['DTXR_POS', 'POSI', 'POS', 'APOS', 'LPOS', 'BPOS', 'HPOS', 'TPOS', 'SPOS', 'EPOS', 'SUPPORTCOORD'],
    captureFields: DEFAULT_JSON_TRACE_CAPTURE_FIELDS.map((field) => ({ ...field })),
    coordinateTolerance: 6.0,
    sourceSchema: {},
    coordinateAlignment: {},
  };
}

function text(value) { return String(value ?? '').trim(); }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function norm(value) { return text(value).toUpperCase().replace(/\s+/g, '').replace(/[()]/g, ''); }

function parseSupportConfig(rawJson) {
  try { return safeObject(JSON.parse(text(rawJson) || '{}')); } catch { return {}; }
}

function arrayOr(value, fallback) {
  return Array.isArray(value) && value.length ? value.map(text).filter(Boolean) : [...fallback];
}

function configFrom(input = {}) {
  const parsed = parseSupportConfig(input.supportConfigJson);
  const source = safeObject(input.jsonConfig || parsed.jsonTrace || parsed.resolverJsonTrace);
  const defaults = createDefaultResolverJsonTraceConfig();
  return {
    nodeAliases: arrayOr(source.nodeAliases, defaults.nodeAliases),
    psAliases: arrayOr(source.psAliases, defaults.psAliases),
    posAliases: arrayOr(source.posAliases, defaults.posAliases),
    captureFields: normalizeJsonTraceCaptureFields(source.captureFields),
    coordinateTolerance: Number(source.coordinateTolerance ?? defaults.coordinateTolerance) || defaults.coordinateTolerance,
    dtxrPositionOffset: safeObject(source.dtxrPositionOffset || parsed.dtxrPositionOffset),
    sourceSchema: safeObject(source.sourceSchema || parsed.sourceSchema),
    coordinateAlignment: safeObject(source.coordinateAlignment || parsed.coordinateAlignment),
  };
}

function writeSupportConfig(supportConfigJson, jsonConfig) {
  const config = parseSupportConfig(supportConfigJson);
  const { sourceSchema, coordinateAlignment, ...traceConfig } = jsonConfig;
  config.jsonTrace = { ...config.jsonTrace, ...traceConfig };
  if (Object.keys(safeObject(sourceSchema)).length) config.sourceSchema = sourceSchema;
  if (Object.keys(safeObject(coordinateAlignment)).length) config.coordinateAlignment = coordinateAlignment;
  return JSON.stringify(config, null, 2);
}

function addIndex(index, key, row) {
  const normalized = norm(key);
  if (!normalized) return;
  if (!index[normalized]) index[normalized] = [];
  index[normalized].push(row);
}

export function buildStandaloneXmlResolverIndex(sourceText) {
  const nodes = parseStandaloneDtxrXmlNodes(sourceText).map((node) => ({
    ...node,
    branchName: node.xmlBranch,
    posPoint: node.xmlPoint,
    psKey: node.psKey || node.xmlNodeName || '',
    posKey: node.posKey || node.xmlPosition || '',
  }));
  const nodeIndex = {};
  const psIndex = {};
  const posIndex = {};
  for (const row of nodes) {
    for (const key of row.nodeKeys || []) addIndex(nodeIndex, key, row);
    addIndex(psIndex, row.psKey, row);
    addIndex(posIndex, row.posKey, row);
  }
  return {
    nodes,
    nodeIndex,
    psIndex,
    posIndex,
    indexStats: {
      xmlNodeCount: nodes.length,
      nodeKeyCount: Object.keys(nodeIndex).length,
      psKeyCount: Object.keys(psIndex).length,
      posKeyCount: Object.keys(posIndex).length,
    },
  };
}

function matchedByForRecord(record) {
  if (record.matchType === 'POS_PS') return ['pos', 'ps'];
  if (record.matchType === 'POS') return ['pos'];
  if (record.matchType === 'PS_FALLBACK') return ['ps'];
  return [];
}

function unique(values) {
  return [...new Set((values || []).map(text).filter(Boolean))];
}

function positiveBore(value) {
  const match = text(value).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[Ee][-+]?\d+)?/);
  const numeric = match ? Number(match[0]) : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function buildStandaloneBoreTraceValidationIndex(sourceText, stagedJsonText, config = {}) {
  const ledgerResult = buildStandaloneDtxrResolutionLedger(
    String(sourceText || ''),
    stagedJsonText,
    config,
  );
  const index = new Map();
  for (const record of ledgerResult.records || []) {
    const status = text(record.status).toUpperCase();
    const firstMember = Array.isArray(record.positionMembers)
      ? (record.positionMembers[0] || null)
      : null;
    const boreMm = status.startsWith('RESOLVED_')
      ? positiveBore(firstMember?.bore)
      : null;
    index.set(Number(record.xmlIndex), {
      xmlIndex: Number(record.xmlIndex),
      status,
      boreMm,
      source: 'resolver-json-trace',
      effectiveSource: text(record.effectiveSource),
      matchType: text(record.matchType),
      sourcePath: text(firstMember?.sourcePath),
    });
  }
  return index;
}

function factFromLedgerRecord(record, node, jsonConfig) {
  const members = Array.isArray(record.positionMembers) ? record.positionMembers : [];
  const firstMember = members[0] || {};
  const matched = record.status.startsWith('RESOLVED_');
  const gapMembers = members.filter((member) => text(member.cmpSupGap));
  const gaps = unique(gapMembers.map((member) => member.cmpSupGap));
  const groupRefs = unique(members.map((member) => member.semanticFields?.supportGroupRef));
  const directLinks = unique(members.map((member) => member.semanticFields?.directLink));
  return {
    ...node,
    xmlIndex: record.xmlIndex,
    nodeKeys: node?.nodeKeys || [record.xmlNodeNumber].filter(Boolean),
    psKey: record.dtxrPsName || node?.psKey || record.xmlNodeName || '',
    posKey: node?.posKey || record.xmlPosition || '',
    posPoint: record.xmlPoint || null,
    branchName: record.xmlBranch || '',
    matchedBy: matchedByForRecord(record),
    hitCount: matched ? Math.max(1, members.length) : 0,
    xmlHits: matched ? [record.xmlIndex] : [],
    stagedBranchKey: record.sourceBranch || '',
    stagedBore: firstMember.bore || '',
    dtxrPosValue: record.dtxrPosValue || '',
    dtxrPsValue: record.dtxrPsValue || '',
    cmpSupGap: gaps.length === 1 ? gaps[0] : '',
    cmpSupGaps: gaps,
    gapSourcePaths: unique(gapMembers.map((member) => member.path || member.sourcePath)),
    supportGroupRefs: groupRefs,
    directLinks,
    jsonNodeNosDtxrPos: record.dtxrPosNodeNumbers || [],
    jsonNodeNosDtxrPs: record.dtxrPsNodeNumbers || [],
    jsonNodeNoDtxrPos: (record.dtxrPosNodeNumbers || []).join('|'),
    jsonNodeNoDtxrPs: (record.dtxrPsNodeNumbers || []).join('|'),
    dtxrPsName: record.dtxrPsName || '',
    effectiveDtxr: record.effectiveDtxr || '',
    effectiveSource: record.effectiveSource || 'NONE',
    fallbackUsed: record.fallbackUsed === true,
    derivedSupportTypes: record.derivedSupportTypes || [],
    matchType: record.matchType,
    status: record.status,
    positionDistanceMm: record.positionDistanceMm,
    coordinateToleranceMm: record.coordinateToleranceMm,
    branchRelationship: record.branchRelationship,
    groupId: record.groupId,
    sourcePaths: record.sourcePaths || [],
    positionMembers: members,
    capturedFields: firstMember.capturedFields || {},
    semanticFields: firstMember.semanticFields || {},
    jsonTraceConfig: jsonConfig,
    ledgerRecord: record,
    raw: firstMember,
  };
}

function scopedStagedJsonInput(input = {}) {
  const requestedScopeId = text(input.jsonTraceScopeId);
  if (!requestedScopeId) {
    return {
      stagedInput: input.stagedJsonText,
      hierarchyScope: { requestedScopeId: '', selectedScopeId: ALL_SCOPE_ID, applied: false },
    };
  }
  const index = input.jsonTraceScopeIndex?.schema === 'xml-cii-json-hierarchy-scope/v1'
    ? input.jsonTraceScopeIndex
    : buildJsonHierarchyScopeIndex(input.stagedJsonText);
  const selected = materializeJsonHierarchyScope(
    input.stagedJsonText,
    index,
    requestedScopeId,
  );
  return {
    stagedInput: selected.value,
    hierarchyScope: {
      requestedScopeId,
      selectedScopeId: selected.scopeId,
      applied: selected.scopeId !== ALL_SCOPE_ID,
      indexable: index.indexable === true,
      strategy: index.strategy || '',
      scopeCount: Array.isArray(index.scopes) ? index.scopes.length : 0,
      sourceItemCount: Number(index.itemCount || 0),
      selectedItemCount: Number(selected.itemCount || 0),
    },
  };
}

function stripRawMember(member = {}) {
  const { raw, ...rest } = safeObject(member);
  return rest;
}

function stripRawTraceLedger(ledgerResult = {}) {
  const groups = (ledgerResult.groups || []).map((group) => ({
    ...group,
    entries: (group.entries || []).map(stripRawMember),
  }));
  const records = (ledgerResult.records || []).map((record) => ({
    ...record,
    positionMembers: (record.positionMembers || []).map(stripRawMember),
  }));
  return {
    ...ledgerResult,
    groups,
    records,
    ledger: Array.isArray(ledgerResult.ledger) ? records : ledgerResult.ledger,
  };
}

function positionIndexFromLedger(ledgerResult) {
  const entries = [];
  const byCoordKey = new Map();
  const byNodeKey = new Map();
  const byPsKey = new Map();
  for (const group of ledgerResult.groups || []) {
    for (const entry of group.entries || []) {
      const indexed = {
        dtxr: entry.labeled || entry.description || '',
        dtxrPs: entry.dtxrPs || '',
        cmpSupGap: entry.cmpSupGap || '',
        capturedFields: entry.capturedFields || {},
        semanticFields: entry.semanticFields || {},
        point: entry.point || null,
        nodeKey: entry.jsonNodeNo || '',
        psKey: entry.tags?.[0] || '',
        branchName: entry.branchName || '',
        bore: entry.bore || '',
        _path: entry.path || '',
      };
      entries.push(indexed);
      if (entry.jsonNodeNo) {
        const key = norm(entry.jsonNodeNo);
        if (!byNodeKey.has(key)) byNodeKey.set(key, []);
        byNodeKey.get(key).push(indexed);
      }
      for (const tag of entry.tags || []) {
        const key = norm(tag);
        if (!byPsKey.has(key)) byPsKey.set(key, []);
        byPsKey.get(key).push(indexed);
      }
      if (entry.point) {
        const key = [entry.point.x, entry.point.y, entry.point.z].map((value) => Math.round(value)).join('|');
        if (!byCoordKey.has(key)) byCoordKey.set(key, []);
        byCoordKey.get(key).push(indexed);
      }
    }
  }
  return { entries, byCoordKey, byNodeKey, byPsKey, count: entries.length, groups: ledgerResult.groups || [] };
}

export function runStandaloneResolverJsonTrace(input = {}) {
  const sourceText = String(input.sourceText || '');
  const sourceKind = input.sourceKind === 'auto'
    ? detectXmlCiiWorkflowSourceKind(sourceText)
    : (input.sourceKind || 'xml');
  const jsonConfig = configFrom(input);
  if (sourceKind === 'inputxml') return inputXmlNotRequired(jsonConfig, input.supportConfigJson);

  const supportConfig = parseSupportConfig(input.supportConfigJson);
  const ledgerConfig = {
    ...supportConfig,
    sourceSchema: jsonConfig.sourceSchema,
    coordinateAlignment: jsonConfig.coordinateAlignment,
    resolverJsonTrace: { ...safeObject(supportConfig.resolverJsonTrace), ...jsonConfig },
    jsonTrace: { ...safeObject(supportConfig.jsonTrace), ...jsonConfig },
    dtxrPositionOffset: jsonConfig.dtxrPositionOffset,
  };
  const scoped = scopedStagedJsonInput(input);
  const rawLedgerResult = buildStandaloneDtxrResolutionLedger(sourceText, scoped.stagedInput, ledgerConfig);
  const ledgerResult = stripRawTraceLedger(decorateJsonTraceLedger(rawLedgerResult, jsonConfig));
  const indexes = buildStandaloneXmlResolverIndex(sourceText);
  const nodeByIndex = new Map(indexes.nodes.map((node) => [Number(node.xmlIndex), node]));
  const resolvedFacts = ledgerResult.records
    .map((record) => factFromLedgerRecord(record, nodeByIndex.get(Number(record.xmlIndex)), jsonConfig))
    .sort((a, b) => Number(a.xmlIndex) - Number(b.xmlIndex));
  const matchedFacts = resolvedFacts.filter((fact) => fact.hitCount > 0);
  const rejectedFacts = resolvedFacts.filter((fact) => fact.hitCount <= 0);
  const positionIndex = positionIndexFromLedger(ledgerResult);

  const diagnostics = [
    { type: 'resolver-json-trace-source-kind', sourceKind },
    { type: 'resolver-json-trace-hierarchy-scope', ...scoped.hierarchyScope },
    { type: 'resolver-json-trace-index-stats', ...indexes.indexStats },
    { type: 'resolver-json-trace-position-index', count: positionIndex.count, groups: ledgerResult.groups.length },
    { type: 'resolver-json-trace-capture-fields', rows: jsonConfig.captureFields.filter((field) => field.enabled).length },
    { type: 'resolver-json-trace-matched-facts', rows: matchedFacts.length },
    { type: 'resolver-json-trace-rejected-facts', rows: rejectedFacts.length },
    ...ledgerResult.diagnostics,
  ];

  return {
    ...indexes,
    jsonConfig,
    hierarchyScope: scoped.hierarchyScope,
    positionIndex,
    resolutionLedger: ledgerResult.records,
    traceResolutionLedger: ledgerResult,
    resolvedFacts,
    matchedFacts,
    rejectedFacts,
    diagnostics,
    supportConfigJson: writeSupportConfig(input.supportConfigJson, jsonConfig),
  };
}

function inputXmlNotRequired(jsonConfig, supportConfigJson) {
  return {
    indexStats: { xmlNodeCount: 0, nodeKeyCount: 0, psKeyCount: 0, posKeyCount: 0 },
    nodeIndex: {},
    psIndex: {},
    posIndex: {},
    nodes: [],
    jsonConfig,
    positionIndex: { entries: [], byCoordKey: new Map(), byNodeKey: new Map(), byPsKey: new Map(), count: 0, groups: [] },
    resolutionLedger: [],
    traceResolutionLedger: { records: [], ledger: [], groups: [], diagnostics: [] },
    resolvedFacts: [],
    matchedFacts: [],
    rejectedFacts: [],
    diagnostics: [{ type: 'resolver-json-trace-inputxml-not-required', sourceKind: 'inputxml' }],
    supportConfigJson: writeSupportConfig(supportConfigJson, jsonConfig),
  };
}
