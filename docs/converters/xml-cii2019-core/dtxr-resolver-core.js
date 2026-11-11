import * as legacy from './dtxr-resolver-core-legacy.js';
import {
  canonicalizeStagedAttributes,
  normalizeOwnerBranchName,
  normalizeSupportIdentity,
  ownerBranchVariants,
  parseSourcePoint,
  readSourceField,
  resolveCoordinateAlignment,
  shouldAutoCalibrateCoordinates,
  sourceAuthorityPolicy,
  sourceRelationshipEvidence,
  sourceSchemaEnabled,
  sourceSupportIdentities,
  supportIdentityRoot,
  supportIdentityVariants,
  walkStagedSource,
} from './source-schema-adapter.js';

export * from './dtxr-resolver-core-legacy.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function canonKey(value) {
  return text(value).replace(/\s+/g, '').replace(/^=/, '').toUpperCase();
}

function coordinateKey(point, precision = 1) {
  if (!point) return '';
  const unit = Math.max(Number(precision) || 1, 0.000001);
  return [point.x, point.y, point.z].map((value) => Math.round(value / unit)).join('|');
}

function addMap(map, key, item) {
  const normalized = canonKey(key);
  if (!normalized) return;
  const bucket = map.get(normalized) || [];
  if (!bucket.some((candidate) => candidate._path === item._path)) bucket.push(item);
  map.set(normalized, bucket);
}

function addOwner(map, owner, item) {
  for (const variant of ownerBranchVariants(owner)) {
    const bucket = map.get(variant) || [];
    if (!bucket.some((candidate) => candidate._path === item._path)) bucket.push(item);
    map.set(variant, bucket);
  }
}

function uniqueItems(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = item?._path || item;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function xmlChildrenByName(parent, localName) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && String(child.localName || child.nodeName).replace(/^.*:/, '') === localName);
}

function xmlText(parent, localName) {
  return text(xmlChildrenByName(parent, localName)[0]?.textContent);
}

export function normalizeSupportTag(value, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.normalizeSupportTag(value);
  return normalizeSupportIdentity(value, config);
}

export function xmlNodeSupportTags(node, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.xmlNodeSupportTags(node);
  const parts = [];
  if (typeof node?.getElementsByTagName === 'function') {
    parts.push(xmlText(node, 'NodeName'), xmlText(node, 'ComponentRefNo'));
    for (const child of xmlChildrenByName(node, 'SupportTag')) parts.push(text(child.textContent));
  } else if (node && typeof node === 'object') {
    parts.push(node.NodeName, node.nodeName, node.ComponentRefNo, node.componentRefNo, node.SupportTag, node.supportTag);
  }
  const tags = [];
  for (const part of parts.flat().filter(Boolean)) {
    for (const variant of supportIdentityVariants(part, config)) if (!tags.includes(variant)) tags.push(variant);
  }
  return tags;
}

function relationshipGroups(items = []) {
  const map = new Map();
  for (const item of items) {
    if (item.relationshipConflict) continue;
    for (const root of item.relationshipRoots || []) {
      const bucket = map.get(root) || [];
      bucket.push(item);
      map.set(root, bucket);
    }
  }
  return map;
}

function relatedItems(item, groups, config = {}) {
  const policy = sourceAuthorityPolicy(config);
  if (!policy.expandIdentityToGroup || item?.relationshipConflict) return [item];
  const out = [];
  for (const root of item.relationshipRoots || []) out.push(...(groups.get(root) || []));
  return uniqueItems(out.length ? out : [item]);
}

export function buildStagedDtxrIndex(stagedJson, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.buildStagedDtxrIndex(stagedJson, config);

  const byComponentRefNo = new Map();
  const byPsTag = new Map();
  const byPsBaseTag = new Map();
  const byNodeNumber = new Map();
  const byNodeName = new Map();
  const byCoordKey = new Map();
  const byOwnerBranch = new Map();
  const ownerItems = [];
  const items = [];
  const alignment = resolveCoordinateAlignment(config);

  for (const record of walkStagedSource(stagedJson, config)) {
    const attrs = canonicalizeStagedAttributes(record.attrs, config, record.component);
    const sourceValue = { ...record.component, attributes: attrs, component: record.component };
    const dtxrPos = text(readSourceField(sourceValue, 'dtxrPosition', config));
    const dtxrPs = text(readSourceField(sourceValue, 'dtxrPs', config));
    const dtxr = dtxrPos || text(readSourceField(sourceValue, 'dtxr', config));
    const cmpSupGap = text(readSourceField(sourceValue, 'supportGap', config));
    if (!dtxr && !dtxrPs && !cmpSupGap) continue;

    const position = record.position;
    const owner = text(readSourceField(sourceValue, 'parentRef', config) || record.branchName);
    const relationship = sourceRelationshipEvidence(sourceValue, config);
    const indexed = {
      raw: record,
      attrs,
      dtxr,
      dtxrPos,
      dtxrPs,
      cmpSupGap,
      owner,
      ownerNorm: normalizeOwnerBranchName(owner),
      coord: position?.point || null,
      rawPoint: position?.rawPoint || null,
      positionField: position?.field || '',
      type: text(readSourceField(sourceValue, 'objectType', config) || record.type).toUpperCase(),
      component: record.component,
      _path: record._path || '',
      _jsonSeq: items.length,
      supportTags: relationship.rejected ? [] : sourceSupportIdentities(sourceValue, config),
      relationshipRoots: relationship.roots,
      relationshipEvidence: relationship.roleRoots,
      relationshipConflict: relationship.rejected,
    };
    items.push(indexed);
  }

  const groups = relationshipGroups(items);
  for (const item of items) {
    const identityCandidates = relatedItems(item, groups, config);
    const sourceValue = { ...item.component, attributes: item.attrs };

    // ComponentRefNo and objectName are exact-object indexes. They never expand
    // to an assembly; assembly expansion is reserved for qualified support-ID hits.
    for (const ref of [readSourceField(sourceValue, 'componentRef', config), readSourceField(sourceValue, 'objectName', config)]) {
      if (ref) addMap(byComponentRefNo, ref, item);
    }

    for (const tag of item.supportTags || []) {
      for (const candidate of identityCandidates) addMap(byPsTag, tag, candidate);
      const root = supportIdentityRoot(tag, config);
      if (root) for (const candidate of identityCandidates) addMap(byPsBaseTag, root, candidate);
    }

    const nodeNo = text(readSourceField(sourceValue, 'nodeNumber', config));
    if (nodeNo && !byNodeNumber.has(nodeNo)) byNodeNumber.set(nodeNo, item);
    const nodeName = text(readSourceField(sourceValue, 'nodeName', config));
    if (nodeName && !byNodeName.has(canonKey(nodeName))) byNodeName.set(canonKey(nodeName), item);

    if (item.ownerNorm && item.dtxrPs) {
      ownerItems.push(item);
      addOwner(byOwnerBranch, item.owner, item);
    }

    const key = coordinateKey(item.coord, alignment.matchToleranceMm || 1);
    if (key) {
      const bucket = byCoordKey.get(key) || [];
      if (!bucket.some((entry) => entry._path === item._path)) bucket.push(item);
      byCoordKey.set(key, bucket);
    }
  }

  return {
    items, byComponentRefNo, byPsTag, byPsBaseTag, byNodeNumber, byNodeName,
    byCoordKey, byOwnerBranch, ownerItems, byRelationship: groups,
  };
}

export function buildDtxrContext(stagedJsonText, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.buildDtxrContext(stagedJsonText, config);
  const stagedIndex = buildStagedDtxrIndex(stagedJsonText, config);
  return { stagedIndex, ...stagedIndex };
}

function relationshipDtxrResult(xmlNode, stagedIndex, config = {}) {
  const tags = xmlNodeSupportTags(xmlNode, config);
  for (const tag of tags) {
    const matches = stagedIndex?.byPsTag?.get(canonKey(tag)) || stagedIndex?.byPsTag?.get(tag) || [];
    if (!matches.length) continue;
    const dtxrPos = [...new Set(matches.map((item) => text(item.dtxrPos || item.dtxr)).filter(Boolean))].join('+');
    const dtxrPs = matches.map((item) => text(item.dtxrPs)).find(Boolean) || '';
    const evidence = legacy.selectEffectiveDtxrEvidence(dtxrPos, dtxrPs);
    if (!evidence.effectiveDtxr) continue;
    const gaps = [...new Set(matches.map((item) => text(item.cmpSupGap)).filter(Boolean))];
    return {
      canonicalText: evidence.effectiveDtxr,
      value: evidence.effectiveDtxr,
      ...evidence,
      teeDesc: '',
      // A generic GAP is only authoritative when the relationship family has
      // exactly one distinct GAP. Multiple member-owned gaps remain plural.
      cmpSupGap: gaps.length === 1 ? gaps[0] : '',
      cmpSupGaps: gaps,
      supportTags: tags,
      source: 'staged-support-relationship',
      matchedBy: 'support-relationship',
      matchedKey: tag,
      stagedType: matches.map((item) => item.type).find(Boolean) || '',
      componentRefNo: legacy.getXmlNodeProperty(xmlNode, 'ComponentRefNo'),
      confidence: 1,
      suppressed: false,
      suppressionReason: gaps.length > 1 ? 'member-specific-gap-set' : '',
      candidates: matches,
      relationshipRoots: [...new Set(matches.flatMap((item) => item.relationshipRoots || []))],
    };
  }
  return null;
}

export function resolveDtxrForXmlNode(args = {}) {
  if (!sourceSchemaEnabled(args.config || {})) return legacy.resolveDtxrForXmlNode(args);
  if ((args.purpose || 'component-description') === 'support-restraint') {
    const stagedIndex = args.context?.stagedIndex || args.context;
    const linked = relationshipDtxrResult(args.xmlNode, stagedIndex, args.config || {});
    if (linked) return linked;
  }
  return legacy.resolveDtxrForXmlNode(args);
}

export function xmlCiiDtxrPositionOffset(config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.xmlCiiDtxrPositionOffset(config);
  const alignment = resolveCoordinateAlignment(config);
  return {
    enabled: alignment.mode === 'MANUAL',
    xOffset: alignment.offsetMm.x,
    yOffset: alignment.offsetMm.y,
    zOffset: alignment.offsetMm.z,
    tolerance: alignment.matchToleranceMm,
  };
}

export function xmlCiiApplyDtxrPositionOffset(point, config = {}, fieldName = 'POSI') {
  if (!sourceSchemaEnabled(config)) return legacy.xmlCiiApplyDtxrPositionOffset(point, config, fieldName);
  const parsed = parseSourcePoint(point);
  if (!parsed) return null;
  const option = xmlCiiDtxrPositionOffset(config);
  const alignment = resolveCoordinateAlignment(config);
  if (!option.enabled || (alignment.applyToFields.length && !alignment.applyToFields.includes(text(fieldName).toUpperCase()))) return parsed;
  return {
    x: parsed.x + option.xOffset,
    y: parsed.y + option.yOffset,
    z: parsed.z + option.zOffset,
  };
}

function dtxrPositionForRecord(record, config = {}) {
  return record.position || null;
}

export function buildStagedDtxrPositionIndex(stagedJsonText, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.buildStagedDtxrPositionIndex(stagedJsonText, config);

  const entries = [];
  const byTag = new Map();
  for (const record of walkStagedSource(stagedJsonText, config)) {
    const attrs = canonicalizeStagedAttributes(record.attrs, config, record.component);
    const sourceValue = { ...record.component, attributes: attrs, component: record.component };
    const dtxrPos = text(readSourceField(sourceValue, 'dtxrPosition', config));
    const dtxrPs = text(readSourceField(sourceValue, 'dtxrPs', config));
    const dtxr = dtxrPos || text(readSourceField(sourceValue, 'dtxr', config));
    const cmpSupGap = text(readSourceField(sourceValue, 'supportGap', config));
    const position = dtxrPositionForRecord(record, config);
    if ((!dtxr && !cmpSupGap) || !position?.point) continue;
    const relationship = sourceRelationshipEvidence(sourceValue, config);
    const indexed = {
      ...record,
      attrs,
      dtxr,
      dtxrPos,
      dtxrPs,
      cmpSupGap,
      name: text(readSourceField(sourceValue, 'objectName', config)),
      point: position.point,
      rawPoint: position.rawPoint,
      positionField: position.field,
      supportTags: relationship.rejected ? [] : sourceSupportIdentities(sourceValue, config),
      relationshipRoots: relationship.roots,
      relationshipEvidence: relationship.roleRoots,
      relationshipConflict: relationship.rejected,
      _path: record._path || '',
    };
    entries.push(indexed);
  }

  const groups = relationshipGroups(entries);
  for (const entry of entries) {
    const identityCandidates = relatedItems(entry, groups, config);
    for (const tag of entry.supportTags || []) {
      const key = normalizeSupportIdentity(tag, config);
      if (!key) continue;
      const bucket = byTag.get(key) || [];
      for (const candidate of identityCandidates) if (!bucket.some((item) => item._path === candidate._path)) bucket.push(candidate);
      byTag.set(key, bucket);
    }
  }
  return { entries, byTag, count: entries.length, byRelationship: groups };
}

function representativeRawPoint(matches = [], tolerance = 1) {
  const points = matches.map((entry) => entry?.rawPoint).filter(Boolean);
  if (!points.length) return null;
  const first = points[0];
  if (points.some((point) => Math.hypot(point.x - first.x, point.y - first.y, point.z - first.z) > tolerance)) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
  };
}

function xmlNodeCalibrationId(node, fallbackIndex) {
  return text(legacy.getXmlNodeProperty(node, 'NodeNumber'))
    || text(legacy.getXmlNodeProperty(node, 'NodeName'))
    || `NODE-${fallbackIndex}`;
}

export function xmlCiiCalibrateDtxrPositionIndex(dtxrPositionIndex, document, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.xmlCiiCalibrateDtxrPositionIndex(dtxrPositionIndex, document, config);
  if (!shouldAutoCalibrateCoordinates(config) || !document || !dtxrPositionIndex?.byTag) return dtxrPositionIndex;
  const alignment = resolveCoordinateAlignment(config);
  if (alignment.scope !== 'GLOBAL') {
    return { ...dtxrPositionIndex, calibrationRejected: `UNSUPPORTED_SCOPE:${alignment.scope}` };
  }
  const precision = Math.max(alignment.calibrationToleranceMm || 1, 0.001);
  const minSamples = Math.max(alignment.minimumCalibrationSamples || 3, 1);
  const clusters = new Map();
  const nodes = typeof document.getElementsByTagName === 'function' ? [...document.getElementsByTagName('Node')] : [];

  nodes.forEach((node, nodeIndex) => {
    const target = parseSourcePoint(legacy.getXmlNodeProperty(node, 'Position'));
    if (!target) return;
    const nodeId = xmlNodeCalibrationId(node, nodeIndex);
    const tags = xmlNodeSupportTags(node, config);
    for (const tag of tags) {
      const matches = dtxrPositionIndex.byTag.get(normalizeSupportIdentity(tag, config)) || [];
      if (!matches.length) continue;
      const grouped = new Map();
      for (const entry of matches) {
        if (!entry?.rawPoint || entry.relationshipConflict) continue;
        const root = entry.relationshipRoots?.[0] || normalizeSupportIdentity(tag, config);
        const bucket = grouped.get(root) || [];
        bucket.push(entry);
        grouped.set(root, bucket);
      }
      for (const [root, rootMatches] of grouped.entries()) {
        const rawPoint = representativeRawPoint(rootMatches, precision);
        if (!rawPoint) continue;
        const sampleKey = `${nodeId}|${root}`;
        const offset = { x: target.x - rawPoint.x, y: target.y - rawPoint.y, z: target.z - rawPoint.z };
        const clusterKey = [offset.x, offset.y, offset.z].map((value) => Math.round(value / precision)).join('|');
        const cluster = clusters.get(clusterKey) || {
          samples: new Map(), x: 0, y: 0, z: 0, roots: new Set(), nodes: new Set(), tags: new Set(),
        };
        if (cluster.samples.has(sampleKey)) continue;
        cluster.samples.set(sampleKey, offset);
        cluster.x += offset.x;
        cluster.y += offset.y;
        cluster.z += offset.z;
        cluster.roots.add(root);
        cluster.nodes.add(nodeId);
        cluster.tags.add(tag);
        clusters.set(clusterKey, cluster);
      }
    }
  });

  const qualified = [...clusters.entries()]
    .filter(([, cluster]) => cluster.roots.size >= minSamples && cluster.nodes.size >= minSamples)
    .sort((a, b) => b[1].roots.size - a[1].roots.size || b[1].nodes.size - a[1].nodes.size || b[1].samples.size - a[1].samples.size);
  if (!qualified.length) return { ...dtxrPositionIndex, calibrationRejected: 'INSUFFICIENT_INDEPENDENT_SUPPORT_GROUPS' };
  if (qualified.length > 1) {
    const first = qualified[0][1];
    const second = qualified[1][1];
    if (first.roots.size === second.roots.size && first.nodes.size === second.nodes.size) {
      return { ...dtxrPositionIndex, calibrationRejected: 'AMBIGUOUS_OFFSET_CLUSTERS' };
    }
  }

  const [bestKey, best] = qualified[0];
  const count = best.samples.size;
  const offset = { x: best.x / count, y: best.y / count, z: best.z / count };
  const entries = (dtxrPositionIndex.entries || []).map((entry) => ({
    ...entry,
    point: entry.rawPoint ? {
      x: entry.rawPoint.x + offset.x,
      y: entry.rawPoint.y + offset.y,
      z: entry.rawPoint.z + offset.z,
    } : entry.point,
    inferredOffset: offset,
  }));

  const byTag = new Map();
  const groups = relationshipGroups(entries);
  for (const entry of entries) {
    const identityCandidates = relatedItems(entry, groups, config);
    for (const tag of entry.supportTags || []) {
      const key = normalizeSupportIdentity(tag, config);
      if (!key) continue;
      const bucket = byTag.get(key) || [];
      for (const candidate of identityCandidates) if (!bucket.some((item) => item._path === candidate._path)) bucket.push(candidate);
      byTag.set(key, bucket);
    }
  }

  return {
    ...dtxrPositionIndex,
    entries,
    byTag,
    count: entries.length,
    inferredOffset: offset,
    calibration: {
      ...offset,
      samples: count,
      uniqueSupportGroups: best.roots.size,
      uniqueXmlNodes: best.nodes.size,
      uniqueTags: best.tags.size,
      precision,
      key: bestKey,
      source: 'source-schema-auto-calibration-independent-groups',
    },
  };
}

export function xmlCiiDtxrPosForNode(node, dtxrPositionIndex, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.xmlCiiDtxrPosForNode(node, dtxrPositionIndex, config);
  const alignment = resolveCoordinateAlignment(config);
  const compatible = {
    ...config,
    dtxrPositionOffset: {
      ...(config.dtxrPositionOffset || {}),
      enabled: false,
      tolerance: alignment.matchToleranceMm,
    },
  };
  return legacy.xmlCiiDtxrPosForNode(node, dtxrPositionIndex, compatible);
}