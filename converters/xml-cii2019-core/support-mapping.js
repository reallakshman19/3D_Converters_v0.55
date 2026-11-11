import * as legacy from './support-mapping-legacy.js';
import { migrateSupportMappingConfig } from './support-mapping-config.js';
import {
  canonicalizeStagedAttributes,
  normalizeSupportIdentity,
  parseSourcePoint,
  readSourceField,
  resolveCoordinateAlignment,
  sourceAuthorityPolicy,
  sourceFieldEvidence,
  sourceRelationshipEvidence,
  sourceSchemaEnabled,
  sourceSupportIdentities,
  supportIdentityRoot,
  supportIdentityVariants,
  walkStagedSource,
} from './source-schema-adapter.js';

export * from './support-mapping-legacy.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function finite(value, fallback = 1) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function xmlLocalName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function xmlChildrenByName(parent, localName) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && xmlLocalName(child) === localName);
}

function xmlText(parent, localName) {
  const child = xmlChildrenByName(parent, localName)[0];
  return text(child?.textContent);
}

function coordinateTolerances(config = {}) {
  if (!sourceSchemaEnabled(config)) return [Math.max(finite(config.coordinateTolerance, 1), 0.000001)];
  const alignment = resolveCoordinateAlignment(config);
  return [Math.max(finite(alignment.matchToleranceMm, 1), 0.000001)];
}

function coordinateKeys(point, config = {}) {
  if (!point) return [];
  return coordinateTolerances(config).map((tolerance) => (
    [point.x, point.y, point.z].map((value) => Math.round(value / tolerance)).join('|')
  ));
}

function uniqueItems(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = text(item?._path) || item;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function relationshipGroups(items = []) {
  const byRoot = new Map();
  for (const item of items) {
    if (item.relationshipConflict) continue;
    for (const root of item.relationshipRoots || []) {
      if (!byRoot.has(root)) byRoot.set(root, []);
      byRoot.get(root).push(item);
    }
  }
  return byRoot;
}

function relatedItems(item, byRoot, config = {}) {
  const policy = sourceAuthorityPolicy(config);
  if (!policy.expandIdentityToGroup || item?.relationshipConflict) return [item];
  const related = [];
  for (const root of item.relationshipRoots || []) related.push(...(byRoot.get(root) || []));
  return uniqueItems(related.length ? related : [item]);
}

function indexSupportItems(items, config = {}) {
  const byCoord = new Map();
  const byTag = new Map();
  const byBaseTag = new Map();
  const byRelationship = relationshipGroups(items);

  function add(map, key, values) {
    if (!key) return;
    const existing = map.get(key) || [];
    map.set(key, uniqueItems([...existing, ...values]));
  }

  for (const item of items) {
    const identityCandidates = relatedItems(item, byRelationship, config);
    for (const tag of item.supportTags || []) {
      add(byTag, tag, identityCandidates);
      const root = supportIdentityRoot(tag, config);
      if (root) add(byBaseTag, root, identityCandidates);
    }
    for (const root of item.relationshipRoots || []) add(byRelationship, root, byRelationship.get(root) || [item]);

    // Coordinate custody is deliberately item-local. A coordinate hit never
    // expands to relationship-family members; group expansion requires an
    // explicit identity hit plus expandIdentityToGroup=true.
    for (const key of coordinateKeys(item.point, config)) add(byCoord, key, [item]);
  }

  return { byCoord, byTag, byBaseTag, byRelationship };
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

export function resolveXmlCiiSupportDescriptor(attrs, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.resolveXmlCiiSupportDescriptor(attrs, config);
  return legacy.resolveXmlCiiSupportDescriptor(canonicalizeStagedAttributes(attrs, config), config);
}

export function resolveXmlCiiSupportKind(attrs, config = {}) {
  return resolveXmlCiiSupportDescriptor(attrs, config).primaryKind || '';
}

export function buildStagedSupportIndex(stagedJsonText, config = {}, diagnostics = []) {
  if (!sourceSchemaEnabled(config)) return legacy.buildStagedSupportIndex(stagedJsonText, config, diagnostics);

  const empty = {
    byCoord: new Map(), byTag: new Map(), byBaseTag: new Map(), byRelationship: new Map(), items: [], count: 0,
  };
  const supportMapping = migrateSupportMappingConfig(config);
  if (supportMapping?.useJsonForRestraints === false) {
    diagnostics.push({ type: 'staged-support-index', supports: 0, coordinateKeys: 0, psTagKeys: 0, disabled: true });
    return empty;
  }
  if (!text(stagedJsonText)) return empty;

  const walked = walkStagedSource(stagedJsonText, config);
  if (!walked.length) {
    diagnostics.push({ type: 'staged-json-parse-error', message: 'Unable to parse StagedJson source.' });
    return empty;
  }

  const items = [];
  for (const entry of walked) {
    const attrs = canonicalizeStagedAttributes(entry.attrs, config, entry.component);
    const descriptor = legacy.resolveXmlCiiSupportDescriptor(attrs, config);
    if (!descriptor?.primaryKind) continue;

    const sourceValue = { ...entry.component, attributes: attrs, component: entry.component };
    const supportTags = sourceSupportIdentities(sourceValue, config);
    const relationship = sourceRelationshipEvidence(sourceValue, config);
    const position = entry.position;
    const semanticConflicts = ['objectName', 'directLink', 'supportGroupRef', 'supportType', 'supportGap', 'position']
      .map((role) => sourceFieldEvidence(sourceValue, role, config))
      .filter((evidence) => evidence.conflict)
      .map((evidence) => ({ role: evidence.role, values: evidence.distinctValues }));

    if (relationship.rejected || semanticConflicts.length) {
      diagnostics.push({
        type: relationship.rejected ? 'source-schema-relationship-conflict' : 'source-schema-field-conflict',
        sourcePath: entry._path,
        relationshipRoots: relationship.uniqueRoots,
        relationshipEvidence: relationship.roleRoots,
        semanticConflicts,
        status: 'rejected-authority',
      });
    }

    const indexed = {
      component: entry.component,
      attrs,
      rawAttrs: entry.rawAttrs,
      branchName: entry.branchName,
      type: entry.type,
      _path: entry._path,
      kind: descriptor.primaryKind,
      primaryKind: descriptor.primaryKind,
      kinds: descriptor.kinds?.length ? [...descriptor.kinds] : [descriptor.primaryKind],
      dofs: descriptor.dofs || {},
      supportDescriptorSource: descriptor.source,
      supportTags: semanticConflicts.length ? [] : supportTags,
      supportBaseTags: semanticConflicts.length
        ? []
        : [...new Set(supportTags.map((tag) => supportIdentityRoot(tag, config)).filter(Boolean))],
      relationshipRoots: relationship.roots,
      relationshipEvidence: relationship.roleRoots,
      relationshipConflict: relationship.rejected,
      semanticConflicts,
      directLink: text(readSourceField(sourceValue, 'directLink', config)),
      supportGroupRef: text(readSourceField(sourceValue, 'supportGroupRef', config)),
      point: position?.point || null,
      rawPoint: position?.rawPoint || null,
      positionField: position?.field || '',
      coordinateAlignment: position?.alignment || resolveCoordinateAlignment(config),
    };
    items.push(indexed);
  }

  const indexes = indexSupportItems(items, config);
  diagnostics.push({
    type: 'staged-support-index',
    supports: items.length,
    coordinateKeys: indexes.byCoord.size,
    psTagKeys: indexes.byTag.size,
    relationshipKeys: indexes.byRelationship.size,
    coordinateTolerancesMm: coordinateTolerances(config),
    sourceSchema: true,
    profileId: sourceAuthorityPolicy(config).profileId,
  });
  return { ...indexes, items, count: items.length };
}

export function calibrateStagedSupportIndexCoordinates(stagedSupportIndex, offset, config = {}) {
  if (!sourceSchemaEnabled(config)) return legacy.calibrateStagedSupportIndexCoordinates(stagedSupportIndex, offset, config);
  if (!stagedSupportIndex || !Array.isArray(stagedSupportIndex.items)) return stagedSupportIndex;
  const alignment = resolveCoordinateAlignment(config);
  if (alignment.mode !== 'AUTO') return stagedSupportIndex;
  const normalized = parseSourcePoint(offset);
  if (!normalized) return stagedSupportIndex;

  const items = stagedSupportIndex.items.map((item) => ({
    ...item,
    point: item.rawPoint ? {
      x: item.rawPoint.x + normalized.x,
      y: item.rawPoint.y + normalized.y,
      z: item.rawPoint.z + normalized.z,
    } : item.point,
    inferredOffset: normalized,
  }));
  const indexes = indexSupportItems(items, config);
  return { ...stagedSupportIndex, ...indexes, items, inferredOffset: normalized };
}