// Standalone XML→CII run parity
// -----------------------------
// The parent Model Converters workflow enriches the XML in the browser
// (process data, staged-support restraints with CMPSUPGAP gaps, DTXR
// annotations, weight master matches, valve/flange split renumbering) BEFORE
// the Python conversion runs. This module reuses that enrichment authority and
// now emits deterministic evidence proving that the exact XML sent to Python
// contains the Preview and Weight Match facts that were selected.

import { enrichStandaloneDtxrAnnotations } from './xml-cii-standalone-dtxr-enrichment.js';
import { createStandaloneRunParityEvidence, xmlCiiParityNodeSignature } from './xml-cii-run-parity-evidence.js?v=20261001-weight-output-2';
import { applyXmlCiiStagedGeometryAuthority } from '../../converters/xml-cii2019-core/staged-geometry-authority.js';
import { xmlCiiWeightReviewNodeOverrideKey } from '../../converters/xml-cii2019-core/weight-match-model.js?v=20261006-p2810042-weight-review-1';
import { deferStandaloneRigidWeights, prepareStandaloneRigidWeightAuthority, applyStandaloneAcceptedRigidWeights } from './xml-cii-weight-output-authority.js?v=20261001-weight-output-2';

const PARITY_MODULE_URL = new URL(
  '../model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js?v=20261001-weight-output-2',
  import.meta.url,
);

function text(value) { return value === undefined || value === null ? '' : String(value); }

function parseConfig(raw) {
  try {
    const value = JSON.parse(text(raw) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function localName(node) { return text(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function elementChildren(parent) {
  return [...(parent?.childNodes || parent?.children || [])]
    .filter((node) => node?.nodeType === undefined || node.nodeType === 1);
}
function childrenByName(parent, name) { return elementChildren(parent).filter((node) => localName(node) === name); }
function firstChild(parent, name) { return childrenByName(parent, name)[0] || null; }
function childText(parent, name) { return text(firstChild(parent, name)?.textContent).trim(); }
function normalizedRef(value) { return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase(); }
function nodeAuthorityKey(branchName, node) {
  return [
    text(branchName).trim(),
    childText(node, 'NodeNumber'),
    normalizedRef(childText(node, 'ComponentRefNo')),
    childText(node, 'Endpoint'),
  ].join('::');
}

function ensureChild(document, parent, name) {
  let element = firstChild(parent, name);
  if (element) return element;
  element = parent?.namespaceURI && typeof document.createElementNS === 'function'
    ? document.createElementNS(parent.namespaceURI, name)
    : document.createElement(name);
  parent.appendChild(element);
  return element;
}

function setChildText(document, parent, name, value) {
  const clean = text(value).trim();
  if (!clean) return false;
  ensureChild(document, parent, name).textContent = clean;
  return true;
}

function numeric(value) {
  const n = Number(text(value).replace(/[^0-9.+-eE]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function recordExpected(entries, {
  scope,
  branchName,
  branchOccurrenceIndex = null,
  nodeOrdinal = null,
  nodeSignature = '',
  nodeNumber = '',
  nodeKey = '',
  path,
  field,
  value,
  kind = 'text',
  source = 'preview',
}) {
  const expected = text(value).trim();
  if (!expected) return;
  entries.push({ scope, branchName, branchOccurrenceIndex, nodeOrdinal, nodeSignature,
    nodeNumber, nodeKey, path, field, expected, kind, source });
}

export async function applyStandaloneProcessParity(xmlText, config, stagedJsonText, diagnostics, runtime = {}) {
  const result = { xmlText, branchRows: [], nodeRows: [], nodeBoreWallRows: [], expectedEntries: [], appliedFields: 0 };
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    throw new Error('DOMParser/XMLSerializer is unavailable for standalone run parity enrichment.');
  }
  const previewBuilder = typeof runtime.previewBuilder === 'function'
    ? runtime.previewBuilder
    : (await import('./ui-adapted/xml-cii-adapted-preview-dryrun.js?v=20261001-weight-output-2')).xmlCiiDryRunPreview;
  const preview = previewBuilder(xmlText, config, stagedJsonText || '');
  result.branchRows = Array.isArray(preview?.branchRows) ? preview.branchRows : [];
  result.nodeRows = Array.isArray(preview?.nodeRows) ? preview.nodeRows : [];
  result.nodeBoreWallRows = Array.isArray(preview?.nodeBoreWallRows) ? preview.nodeBoreWallRows : [];
  if (Array.isArray(preview?.boreAuthorityDiagnostics)) diagnostics.push(...preview.boreAuthorityDiagnostics);
  if (!result.branchRows.length) return result;

  // Names and abbreviated node keys are not unique in combined Mode B documents.
  const expectedBranches = result.branchRows;
  const authoritativeNodes = result.nodeBoreWallRows;
  let nodeOccurrenceIndex = 0;
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('Standalone run parity could not parse the enriched XML.');

  const actualBranches = [...document.getElementsByTagName('Branch')];
  if (actualBranches.length !== expectedBranches.length) {
    throw new Error('Combined XML branch occurrences differ from Preview; converter input blocked.');
  }
  for (const [branchOccurrenceIndex, branch] of actualBranches.entries()) {
    const branchName = childText(branch, 'Branchname');
    const row = expectedBranches[branchOccurrenceIndex];
    if (text(row?.branchName).trim() !== branchName) {
      throw new Error('Combined XML branch occurrence order differs from Preview; converter input blocked.');
    }
    const pressure = ensureChild(document, branch, 'Pressure');
    const temperature = ensureChild(document, branch, 'Temperature');

    const branchWrites = [
      { owner: pressure, name: 'Pressure1', path: ['Pressure', 'Pressure1'], field: 'p1', value: row.p1, kind: 'number' },
      { owner: pressure, name: 'HydroPressure', path: ['Pressure', 'HydroPressure'], field: 'hydroPressure', value: row.hydroPressure, kind: 'number' },
      { owner: temperature, name: 'Temperature1', path: ['Temperature', 'Temperature1'], field: 't1', value: row.t1, kind: 'number' },
      { owner: temperature, name: 'Temperature2', path: ['Temperature', 'Temperature2'], field: 't2', value: row.t2, kind: 'number' },
      { owner: temperature, name: 'Temperature3', path: ['Temperature', 'Temperature3'], field: 't3', value: row.t3, kind: 'number' },
      { owner: branch, name: 'FluidDensity', path: ['FluidDensity'], field: 'density', value: row.density, kind: 'number' },
      { owner: branch, name: 'MaterialNumber', path: ['MaterialNumber'], field: 'materialCode', value: row.materialCode, kind: 'text' },
    ];

    for (const write of branchWrites) {
      const valid = write.kind === 'number' ? numeric(write.value) !== null : text(write.value).trim() !== '';
      if (!valid || !setChildText(document, write.owner, write.name, write.value)) continue;
      result.appliedFields += 1;
      recordExpected(result.expectedEntries, {
        scope: 'branch', branchName, branchOccurrenceIndex, path: write.path, field: write.field,
        value: write.value, kind: write.kind, source: 'standalone-preview',
      });
    }

    for (const [nodeIndex, node] of childrenByName(branch, 'Node').entries()) {
      const nodeNumber = childText(node, 'NodeNumber');
      const nodeKey = xmlCiiWeightReviewNodeOverrideKey(branchName, node, nodeIndex);
      const nodeAuthority = authoritativeNodes.length ? authoritativeNodes[nodeOccurrenceIndex] : null;
      if (authoritativeNodes.length && (!nodeAuthority
        || text(nodeAuthority.branchName).trim() !== branchName
        || text(nodeAuthority.nodeNumber).trim() !== nodeNumber
        || normalizedRef(nodeAuthority.componentRefNo) !== normalizedRef(childText(node, 'ComponentRefNo'))
        || text(nodeAuthority.endpoint).trim() !== childText(node, 'Endpoint'))) {
        throw new Error('Combined XML node bore authority occurrence differs from Preview; converter input blocked.');
      }
      nodeOccurrenceIndex += 1;
      const nodeWrites = [
        { name: 'PipingClass', field: 'pipingClass', value: row.pipingClass, kind: 'text' },
        { name: 'Rating', field: 'rating', value: row.rating, kind: 'text' },
        { name: 'MaterialName', field: 'material', value: row.material, kind: 'text' },
        { name: 'MaterialCode', field: 'materialCode', value: row.materialCode, kind: 'text' },
        { name: 'BoreMm', field: 'boreMm', value: nodeAuthority?.boreMm, kind: 'number', source: 'standalone-preview-node' },
        { name: 'WallThickness', field: 'wallThickness', value: nodeAuthority?.wallThickness, kind: 'number', source: 'standalone-preview-node' },
        { name: 'CorrosionAllowance', field: 'corrosion', value: row.corrosion, kind: 'number' },
      ];
      for (const write of nodeWrites) {
        const valid = write.kind === 'number' ? numeric(write.value) !== null : text(write.value).trim() !== '';
        if (!valid || !setChildText(document, node, write.name, write.value)) continue;
        result.appliedFields += 1;
        recordExpected(result.expectedEntries, {
          scope: 'node', branchName, branchOccurrenceIndex, nodeOrdinal: nodeIndex,
          nodeSignature: xmlCiiParityNodeSignature(node),
          nodeNumber, nodeKey, path: [write.name], field: write.field,
          value: write.value, kind: write.kind, source: write.source || 'standalone-preview',
        });
      }

    }
  }

  if (authoritativeNodes.length && nodeOccurrenceIndex !== authoritativeNodes.length) {
    throw new Error('Combined XML node bore authority count differs from Preview; converter input blocked.');
  }
  if (!result.appliedFields) return result;
  diagnostics.push({
    type: 'standalone-process-parity-applied',
    fields: result.appliedFields,
    message: 'Branch process and node facts were synchronised from the standalone Preview and Weight Match authorities.',
  });
  result.xmlText = new XMLSerializer().serializeToString(document);
  return result;
}

const WEIGHT_MATCH_MODULE_URL = new URL(
  '../model-converters/converters/xmltocii2019_helper/weight-match-renderer.js?v=20261001-single-weight-owners-1',
  import.meta.url,
);

export async function loadParentWeightMatchModules() {
  const [renderer, parity] = await Promise.all([
    import(WEIGHT_MATCH_MODULE_URL.href),
    import(PARITY_MODULE_URL.href),
  ]);
  return { bindXmlCiiWeightMatchPhase: renderer.bindXmlCiiWeightMatchPhase, enrichXmlForCii2019: parity.enrichXmlForCii2019 };
}

export function standaloneParityOptions(supportConfigJson, options = {}) {
  const config = parseConfig(supportConfigJson);
  const split = options.splitCondensedValveFlange !== undefined
    ? options.splitCondensedValveFlange !== false
    : (config.splitCondensedValveFlange !== false);
  return {
    supportConfigJson: text(supportConfigJson) || '{}',
    splitCondensedValveFlange: split,
    split_condensed_valve_flange: split,
    condenseRigidXsd: config.condenseRigidXsd === true || config.condense_rigid_xsd === true,
    preserveNodeGeometry: true,
  };
}

export async function prepareStandaloneWeightReviewXml(state = {}, config = {}) {
  const sourceText = text(state?.sourceText);
  const stagedJsonText = text(state?.stagedJsonText);
  if (!sourceText.trim()) return { xmlText: sourceText, config, diagnostics: [], stats: {}, error: 'Weight review requires non-empty XML source text.' };
  const parity = await import(PARITY_MODULE_URL.href);
  const supportConfigJson = JSON.stringify(config && typeof config === 'object' ? config : {});
  const options = standaloneParityOptions(supportConfigJson, state?.options || {});
  const authority = prepareStandaloneRigidWeightAuthority(parity, sourceText, stagedJsonText, config, options);
  const enriched = await parity.enrichXmlForCii2019(sourceText, stagedJsonText, {
    ...options, supportConfigJson: JSON.stringify(deferStandaloneRigidWeights(config)),
  });
  const preparedConfig = enriched?.config && typeof enriched.config === 'object'
    ? { ...enriched.config, ...config, overrides: { ...(enriched.config.overrides || {}), ...(config?.overrides || {}) } }
    : config;
  const geometry = applyXmlCiiStagedGeometryAuthority(
    enriched?.xmlText || sourceText,
    stagedJsonText,
    { config: preparedConfig },
  );
  return {
    xmlText: geometry.xmlText,
    config: preparedConfig,
    diagnostics: [...(enriched?.diagnostics || []), ...(geometry?.diagnostics || [])],
    stats: { ...(enriched?.stats || {}), ...(geometry?.stats || {}) },
    weightAuthority: authority,
    error: null,
  };
}

export async function enrichStandaloneXmlForRun(job, extraOptions = {}) {
  const sourceText = text(job?.sourceText);
  const out = {
    xmlText: sourceText,
    applied: false,
    diagnostics: [],
    stats: {},
    logs: [],
    error: null,
    evidence: null,
    branchRows: [],
    nodeRows: [],
    nodeBoreWallRows: [],
    expectedEntries: [],
  };
  if (!sourceText.trim()) {
    out.error = 'Standalone run parity requires non-empty XML source text.';
    out.logs.push(`Standalone run parity blocked: ${out.error}`);
    return out;
  }
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    out.error = 'DOMParser/XMLSerializer is unavailable for standalone run parity.';
    out.logs.push(`Standalone run parity blocked: ${out.error}`);
    return out;
  }

  try {
    const parity = await import(PARITY_MODULE_URL.href);
    const options = { ...standaloneParityOptions(job.supportConfigJson, job.options || {}), ...extraOptions };
    const supportConfig = parseConfig(options.supportConfigJson);
    const validated = prepareStandaloneRigidWeightAuthority(parity, sourceText, text(job.stagedJsonText), supportConfig, options);
    const enriched = await parity.enrichXmlForCii2019(sourceText, text(job.stagedJsonText), {
      ...options, supportConfigJson: JSON.stringify(deferStandaloneRigidWeights(supportConfig)),
    });
    const config = enriched?.config && typeof enriched.config === 'object'
      ? {
          ...enriched.config,
          ...supportConfig,
          overrides: { ...(enriched.config.overrides || {}), ...(supportConfig.overrides || {}) },
        }
      : supportConfig;
    const dtxr = enrichStandaloneDtxrAnnotations(enriched.xmlText || sourceText, text(job.stagedJsonText), config);
    const geometry = applyXmlCiiStagedGeometryAuthority(
      dtxr.text || enriched.xmlText || sourceText,
      text(job.stagedJsonText),
      { config },
    );
    const authorityConfig = validated.config;

    out.diagnostics = [
      ...(Array.isArray(enriched.diagnostics) ? enriched.diagnostics : []),
      ...(Array.isArray(dtxr.diagnostics) ? dtxr.diagnostics : []),
      ...(Array.isArray(geometry.diagnostics) ? geometry.diagnostics : []),
      ...Object.entries(validated.validation.stale).map(([key, item]) => ({
        type: 'rigid-weight-match1-stale',
        key,
        weight: item.weightKg,
        reason: item.reason,
        changedFields: item.changedFields || [],
        message: `Match-1 weight ${item.weightKg} kg was not released to the standalone CII engine because its accepted component basis is stale.`,
      })),
    ];
    out.stats = {
      ...(enriched.stats && typeof enriched.stats === 'object' ? enriched.stats : {}),
      ...(dtxr.stats && typeof dtxr.stats === 'object' ? dtxr.stats : {}),
      ...(geometry.stats && typeof geometry.stats === 'object' ? geometry.stats : {}),
      validMatch1Weights: validated.validation.validCount,
      staleMatch1Weights: validated.validation.staleCount,
    };

    const process = await applyStandaloneProcessParity(
      geometry.xmlText,
      authorityConfig,
      text(job.stagedJsonText),
      out.diagnostics,
    );
    const accepted = applyStandaloneAcceptedRigidWeights(process.xmlText, validated);
    out.xmlText = accepted.xmlText;
    out.branchRows = process.branchRows;
    out.nodeRows = process.nodeRows;
    out.nodeBoreWallRows = process.nodeBoreWallRows;
    out.expectedEntries = [...process.expectedEntries, ...accepted.expectedEntries];
    out.stats.acceptedRigidWeightWrites = accepted.appliedCount;
    out.diagnostics.push(...accepted.appliedRows.map((row) => ({ ...row, source: 'validated-or-final-weight' })));
    out.evidence = createStandaloneRunParityEvidence({
      xmlText: out.xmlText,
      expectedEntries: out.expectedEntries,
      branchRows: out.branchRows,
      nodeRows: out.nodeRows,
    });
    out.stats.parityComparisons = out.evidence.comparisons;
    out.stats.parityMismatches = out.evidence.mismatchCount;

    if (!out.evidence.ok) {
      out.error = `Standalone run parity blocked ${out.evidence.mismatchCount} authority mismatch(es).`;
      out.logs.push(`${out.error} Engine input was not released.`);
      for (const mismatch of out.evidence.mismatches.slice(0, 50)) {
        out.logs.push(`PARITY_MISMATCH ${JSON.stringify(mismatch)}`);
      }
      return out;
    }

    out.applied = true;
    out.logs.push(
      `Standalone run parity PASS (${out.evidence.status}): ${out.evidence.comparisons} comparison(s), input ${out.evidence.engineInputDigest}.`,
    );
    out.logs.push(`Standalone run parity applied: ${out.stats.weightAnnotations || 0} weight annotation(s), ${out.stats.processAnnotations || 0} process annotation(s), ${out.stats.stagedSupportsMapped || 0} staged support(s), ${out.stats.dtxrPosAnnotations || 0} DTXR_POS annotation(s), ${out.stats.dtxrPsAnnotations || 0} DTXR_PS annotation(s), ${out.stats.splitCondensedRigidNodes || 0} renumbered node(s), ${out.stats.validMatch1Weights || 0} valid Match-1 weight(s), ${out.stats.staleMatch1Weights || 0} stale Match-1 weight(s) rejected.`);
  } catch (error) {
    out.error = text(error?.message || error);
    out.applied = false;
    out.logs.push(`Standalone run parity blocked: ${out.error}`);
  }
  return out;
}
