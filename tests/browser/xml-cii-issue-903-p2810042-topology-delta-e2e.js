import { prepareStandaloneWeightReviewXml, enrichStandaloneXmlForRun } from '../../tabs/xml-cii-2019-standalone/xml-cii-standalone-run-parity.js';
import { buildXmlCiiTopologyDisconnectAudit } from '../../converters/xml-cii2019-core/topology/xml-cii-topology-disconnect-audit.js';
import { xmlCiiNominalDnFromOd } from '../../converters/xml-cii2019-core/bore-authority.js';
import { P2810042_C06_CLASS_ROWS, P2810042_C06_TARGET_WEIGHTS } from '../fixtures/xml-cii-p2810042-c06-combined-fixture.js';
import { buildP2810042C06FullXml } from '../fixtures/xml-cii-p2810042-c06-full-fixture.js';
import { stableNodeKey } from '../xml-cii-c06/topology-delta-authority.js';
import { evaluateEngineeringDeltas, summarizeTopologyAudit } from '../xml-cii-c06/topology-delta-evaluator.js';

const CONFIG = {
  splitCondensedValveFlange: true, split_condensed_valve_flange: true,
  dropGasketNodes: true, dropGasketsInEnrichment: true,
  dropShortElementLengthNodes: true, shortElementLengthDropThresholdMm: 6,
  pipingClass: { masterRows: P2810042_C06_CLASS_ROWS },
  rating: { defaultRating: '600' }, weight: { masterRows: [] },
};
const WALL_BY_DN = new Map(P2810042_C06_CLASS_ROWS
  .map((row) => [Number(row.DN), Number(row['Wall Thickness'])]));
function text(value) { return value == null ? '' : String(value).trim(); }
function localName(node) { return text(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function children(parent, name) {
  return [...(parent?.childNodes || [])].filter((child) => child.nodeType === 1 && localName(child) === name);
}
function childText(parent, name) { return text(children(parent, name)[0]?.textContent); }
function numberOrNull(value) {
  const number = Number(text(value));
  return Number.isFinite(number) ? number : null;
}
function parseXml(xmlText) {
  const document = new DOMParser().parseFromString(String(xmlText || ''), 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw new Error('XML parse failed');
  return document;
}
function normalizeRef(value) { return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase(); }
function nodeRows(xmlText) {
  const rows = [], seen = new Set();
  for (const branch of [...parseXml(xmlText).getElementsByTagNameNS('*', 'Branch')]) {
    const branchName = childText(branch, 'Branchname');
    for (const node of children(branch, 'Node')) {
      const row = {
        branchName, nodeNumber: childText(node, 'NodeNumber'),
        componentType: childText(node, 'ComponentType').toUpperCase(),
        componentRefNo: childText(node, 'ComponentRefNo'), endpoint: childText(node, 'Endpoint'),
        rigid: childText(node, 'Rigid'), position: childText(node, 'Position'),
        outsideDiameter: numberOrNull(childText(node, 'OutsideDiameter')),
        boreMm: numberOrNull(childText(node, 'BoreMm')),
        wallThickness: numberOrNull(childText(node, 'WallThickness')),
        weight: numberOrNull(childText(node, 'Weight')) ?? 0,
      };
      const key = stableNodeKey(row);
      if (seen.has(key)) throw new Error(`duplicate stable node key ${key}`);
      seen.add(key); rows.push(row);
    }
  }
  return rows;
}
function rowId(row) {
  const branch = text(row.branchName);
  const suffix = /EXE\/B2$/i.test(branch) ? 'EXE/B2'
    : branch.match(/\/(B\d+)$/i)?.[1]?.toUpperCase() || branch;
  return `${suffix}::${text(row.nodeNumber)}`;
}
function requireValue(condition, message) { if (!condition) throw new Error(message); }
function targetWeightMap(sourceNodes) {
  const out = new Map();
  for (const target of P2810042_C06_TARGET_WEIGHTS) {
    const row = sourceNodes.find((item) => rowId(item) === `${target.branch}::${target.node}`
      && normalizeRef(item.componentRefNo) === normalizeRef(target.ref));
    requireValue(row, `${target.id}: source target missing`);
    out.set(stableNodeKey(row), Number(target.kg));
  }
  return out;
}
async function buildFinalXml(sourceText) {
  const prepared = await prepareStandaloneWeightReviewXml(
    { sourceText, stagedJsonText: '', options: { splitCondensedValveFlange: true } },
    structuredClone(CONFIG),
  );
  requireValue(!prepared.error, `weight review failed: ${prepared.error}`);
  const accepted = {};
  for (const target of P2810042_C06_TARGET_WEIGHTS) {
    const row = (prepared.weightAuthority?.basisRows || [])
      .find((item) => rowId(item) === `${target.branch}::${target.node}`);
    requireValue(row, `${target.id}: review target missing`);
    requireValue(normalizeRef(row.componentRefNo) === normalizeRef(target.ref), `${target.id}: review ref drift`);
    accepted[row.key] = target.kg;
  }
  const config = structuredClone(CONFIG);
  config.overrides = { rigidWeight: accepted };
  const final = await enrichStandaloneXmlForRun({
    sourceText, stagedJsonText: '', supportConfigJson: JSON.stringify(config),
    options: { splitCondensedValveFlange: true },
  });
  requireValue(final.applied, `run enrichment failed: ${final.error || 'not applied'}`);
  return final;
}
function topologySummary(xmlText) {
  return summarizeTopologyAudit(buildXmlCiiTopologyDisconnectAudit(xmlText, { mode: 'audit' }));
}
export async function runP2810042C06TopologyDeltaGate() {
  const sourceText = buildP2810042C06FullXml();
  const sourceNodes = nodeRows(sourceText);
  requireValue(sourceNodes.length === 172, `expected 172 source nodes, got ${sourceNodes.length}`);
  const final = await buildFinalXml(sourceText);
  const sourceTopology = topologySummary(sourceText);
  const finalTopology = topologySummary(final.xmlText);
  requireValue(sourceTopology.continuityFailures.length === 0, 'source continuity is not clean');
  requireValue(finalTopology.continuityFailures.length === 0, 'final continuity is not clean');
  const delta = evaluateEngineeringDeltas({
    sourceNodes, finalNodes: nodeRows(final.xmlText), diagnostics: final.diagnostics,
    nominalDnFromOd: xmlCiiNominalDnFromOd, wallByDn: WALL_BY_DN,
    weightTargets: targetWeightMap(sourceNodes),
  });
  requireValue(delta.ok, `unexplained engineering deltas: ${JSON.stringify(delta.unexplained.slice(0, 12))}`);
  return {
    schema: 'XMLCII_ISSUE_903_P2810042_TOPOLOGY_DELTA_V2', ok: true,
    topology: { fixState: 'READ_ONLY_NOT_APPLIED', source: sourceTopology, final: finalTopology },
    delta: {
      sourceNodes: sourceNodes.length, finalNodes: nodeRows(final.xmlText).length,
      removedNodes: delta.removed.length, generatedNodes: delta.generated.length,
      unexplainedCount: delta.unexplained.length,
      removalReasonCounts: delta.removalReasonCounts, removed: delta.removed,
    },
    finalStats: final.stats || {}, finalEvidence: final.evidence || null, finalXmlText: final.xmlText,
  };
}
function publish(result) {
  globalThis.__XML_CII_ISSUE_903_DONE__ = true;
  globalThis.__XML_CII_ISSUE_903_RESULT__ = result;
  const visible = { ...result, finalXmlText: result.finalXmlText ? '[omitted]' : undefined };
  document.querySelector('#out').textContent = JSON.stringify(visible, null, 2);
}
runP2810042C06TopologyDeltaGate().then(publish).catch((error) => publish({
  schema: 'XMLCII_ISSUE_903_P2810042_TOPOLOGY_DELTA_V2',
  ok: false, error: String(error?.stack || error),
}));
