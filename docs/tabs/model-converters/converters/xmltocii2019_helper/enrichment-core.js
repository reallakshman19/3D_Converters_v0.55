import * as legacy from './enrichment-core-legacy.js';
import { parseXmlCiiEnrichmentConfig } from '../../../../converters/xml-cii2019-core/config.js';
import {
  buildStagedSupportIndex,
  calibrateStagedSupportIndexCoordinates,
  xmlNodeSupportTags,
  xmlCiiRestraintEntriesFromSupportMatch,
  dedupeXmlCiiRestraintEntries,
  applyXmlRestraints,
} from '../../../../converters/xml-cii2019-core/support-mapping.js';
import {
  buildStagedDtxrPositionIndex,
  xmlCiiCalibrateDtxrPositionIndex,
} from '../../../../converters/xml-cii2019-core/dtxr-resolver.js';
import {
  parseSourcePoint,
  resolveCoordinateAlignment,
  sourceAuthorityPolicy,
  sourceSchemaEnabled,
} from '../../../../converters/xml-cii2019-core/source-schema-adapter.js';

export * from './enrichment-core-legacy.js';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}
function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function parseRawSupportConfig(rawJson) {
  try {
    const parsed = JSON.parse(text(rawJson) || '{}');
    return safeObject(parsed);
  } catch {
    return {};
  }
}
function legacyPassOptions(options = {}) {
  const raw = parseRawSupportConfig(options.supportConfigJson);
  raw.supportMapping = {
    ...safeObject(raw.supportMapping),
    useJsonForRestraints: false,
  };
  return { ...options, supportConfigJson: JSON.stringify(raw) };
}

function localName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}
function childrenByName(parent, name) {
  return [...(parent?.childNodes || [])]
    .filter((node) => node.nodeType === 1 && localName(node) === name);
}
function childText(parent, name) {
  return text(childrenByName(parent, name)[0]?.textContent);
}
function distanceMm(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  return Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z);
}
function uniqueMatches(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = text(item?._path)
      || [item?.attrs?.NAME, item?.attrs?.CMPSUPREFN, item?.primaryKind || item?.kind].map(text).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function configuredTolerance(config = {}) {
  return Math.max(Number(resolveCoordinateAlignment(config).matchToleranceMm) || 0, 0);
}
function tagMatchesForNode(node, supportIndex, config) {
  const tags = xmlNodeSupportTags(node, config);
  const hits = [];
  for (const tag of tags) hits.push(...(supportIndex.byTag.get(tag) || []));
  return { tags, matches: uniqueMatches(hits) };
}
function coordinateMatchesForNode(node, supportIndex, toleranceMm) {
  const point = parseSourcePoint(childText(node, 'Position'));
  if (!point) return [];
  return uniqueMatches((supportIndex.items || []).filter((candidate) => (
    !candidate?.relationshipConflict
    && !(candidate?.semanticConflicts?.length)
    && candidate?.point
    && distanceMm(point, candidate.point) <= toleranceMm
  )));
}

function resolveSupportMatches(node, supportIndex, config) {
  const policy = sourceAuthorityPolicy(config);
  const tagged = tagMatchesForNode(node, supportIndex, config);
  const coordinate = coordinateMatchesForNode(node, supportIndex, configuredTolerance(config));

  if (tagged.matches.length) {
    return {
      tags: tagged.tags,
      method: 'support-relationship',
      matches: tagged.matches,
      coordinateMatches: coordinate,
    };
  }

  const allowCoordinateFallback = policy.coordinateAuthority === 'FALLBACK'
    && policy.coordinateOnlyFallback === true;
  return {
    tags: tagged.tags,
    method: allowCoordinateFallback && coordinate.length ? 'coordinate-fallback' : 'unmatched',
    matches: allowCoordinateFallback ? coordinate : [],
    coordinateMatches: coordinate,
  };
}

function calibratedSupportIndex(stagedJsonText, document, config, diagnostics) {
  let supportIndex = buildStagedSupportIndex(stagedJsonText, config, diagnostics);
  if (resolveCoordinateAlignment(config).mode !== 'AUTO') return supportIndex;

  let positionIndex = buildStagedDtxrPositionIndex(stagedJsonText, config);
  positionIndex = xmlCiiCalibrateDtxrPositionIndex(positionIndex, document, config);
  if (!positionIndex?.inferredOffset) {
    if (positionIndex?.calibrationRejected) diagnostics.push({
      type: 'source-schema-support-closure-calibration-rejected',
      reason: positionIndex.calibrationRejected,
      status: 'not-applied',
    });
    return supportIndex;
  }

  supportIndex = calibrateStagedSupportIndexCoordinates(supportIndex, positionIndex.inferredOffset, config);
  diagnostics.push({
    type: 'source-schema-support-closure-calibration',
    xOffset: positionIndex.inferredOffset.x,
    yOffset: positionIndex.inferredOffset.y,
    zOffset: positionIndex.inferredOffset.z,
    samples: positionIndex.calibration?.samples || 0,
    uniqueSupportGroups: positionIndex.calibration?.uniqueSupportGroups || 0,
    uniqueXmlNodes: positionIndex.calibration?.uniqueXmlNodes || 0,
    uniqueTags: positionIndex.calibration?.uniqueTags || 0,
  });
  return supportIndex;
}

function coordinateFallbackEligible(node) {
  const componentType = childText(node, 'ComponentType').toUpperCase();
  return componentType === 'ATTA'
    || componentType === 'ANCI'
    || childrenByName(node, 'Restraint').length > 0;
}

function applySourceSchemaSupportClosure(enriched, stagedJsonText, options = {}) {
  if (!enriched?.xmlText || !text(stagedJsonText)) return enriched;
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return enriched;

  const config = enriched.config || parseXmlCiiEnrichmentConfig(options.supportConfigJson || '{}');
  if (!sourceSchemaEnabled(config)) return enriched;
  const policy = sourceAuthorityPolicy(config);
  const document = new DOMParser().parseFromString(enriched.xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) return enriched;

  const diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  const supportIndex = calibratedSupportIndex(stagedJsonText, document, config, diagnostics);
  let matchedNodes = 0;
  let relationshipNodes = 0;
  let coordinateFallbackNodes = 0;
  let appliedEntries = 0;

  for (const node of [...document.getElementsByTagName('Node')]) {
    const resolved = resolveSupportMatches(node, supportIndex, config);
    const relationshipEligible = resolved.tags.length > 0;
    const coordinateEligible = policy.coordinateOnlyFallback === true && coordinateFallbackEligible(node);
    if (!relationshipEligible && !coordinateEligible) continue;
    if (!resolved.matches.length) continue;

    const entries = dedupeXmlCiiRestraintEntries(
      resolved.matches.flatMap((match) => xmlCiiRestraintEntriesFromSupportMatch(match, node, config)),
    );
    if (!entries.length) continue;

    applyXmlRestraints(document, node, entries, config);
    matchedNodes += 1;
    appliedEntries += entries.length;
    if (resolved.method === 'support-relationship') relationshipNodes += 1;
    else if (resolved.method === 'coordinate-fallback') coordinateFallbackNodes += 1;

    diagnostics.push({
      type: 'source-schema-support-closure',
      nodeNumber: childText(node, 'NodeNumber'),
      nodeName: childText(node, 'NodeName'),
      componentType: childText(node, 'ComponentType'),
      method: resolved.method,
      matchedBy: resolved.method,
      tags: resolved.tags,
      relationshipRoots: [...new Set(resolved.matches.flatMap((match) => match.relationshipRoots || []))],
      sourcePaths: [...new Set(resolved.matches.map((match) => match._path).filter(Boolean))],
      restraintTypes: entries.map((entry) => entry.type).join('+'),
      gaps: entries.map((entry) => `${entry.type}:${entry.gap ?? ''}`).join('|'),
      coordinateCandidateCount: resolved.coordinateMatches.length,
      coordinateAuthority: policy.coordinateAuthority,
      profileId: policy.profileId,
      status: 'applied',
    });
  }

  if (matchedNodes) enriched.xmlText = new XMLSerializer().serializeToString(document);
  enriched.config = config;
  enriched.diagnostics = diagnostics;
  enriched.stats = {
    ...(enriched.stats || {}),
    sourceSchemaSupportClosureNodes: matchedNodes,
    sourceSchemaSupportRelationshipNodes: relationshipNodes,
    sourceSchemaSupportCoordinateFallbackNodes: coordinateFallbackNodes,
    sourceSchemaSupportClosureEntries: appliedEntries,
  };
  return enriched;
}

/**
 * Public enrichment boundary.
 *
 * Legacy mode is byte-compatible: no special pass is introduced.
 * Explicit source-schema mode runs the established non-support enrichment with
 * StagedJson restraint authority disabled, then restores the requested support
 * policy and applies restraints only through this strict closure. This prevents
 * the legacy coordinate-first loop from bypassing CORROBORATION_ONLY policy.
 */
export async function enrichXmlForCii2019(xmlTextVal, stagedJsonText, options = {}) {
  const requestedConfig = parseXmlCiiEnrichmentConfig(options.supportConfigJson || '{}');
  if (!sourceSchemaEnabled(requestedConfig)) {
    return legacy.enrichXmlForCii2019(xmlTextVal, stagedJsonText, options);
  }

  const enriched = await legacy.enrichXmlForCii2019(xmlTextVal, stagedJsonText, legacyPassOptions(options));
  enriched.config = {
    ...(enriched.config || {}),
    sourceSchema: requestedConfig.sourceSchema,
    coordinateAlignment: requestedConfig.coordinateAlignment,
    supportMapping: requestedConfig.supportMapping,
  };
  enriched.diagnostics = Array.isArray(enriched.diagnostics) ? enriched.diagnostics : [];
  enriched.diagnostics.push({
    type: 'source-schema-legacy-restraint-pass-suppressed',
    profileId: sourceAuthorityPolicy(enriched.config).profileId,
    status: 'strict-closure-authoritative',
  });
  return applySourceSchemaSupportClosure(enriched, stagedJsonText, options);
}
