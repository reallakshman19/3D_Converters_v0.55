// XML-CII 2019 source-domain adapter for GC-PW/1.0. Never a source of
// process/weight engineering authority: only exact source occurrence custody.
import {previewOccurrenceId, PreviewBasisError} from './xml-cii-adapted-preview-facts-basis.js';

const fail = (code, message) => { throw new PreviewBasisError(code, message); };
const check = (ok, code, message) => { if (!ok) fail(code, message); };
const name = (node) => String(node?.localName || node?.nodeName || '').replace(/^.*:/, '');
const elements = (node, wanted) => [...(node?.childNodes || [])]
  .filter((child) => child.nodeType === 1 && name(child) === wanted);
const childText = (node, field) => String(elements(node, field)[0]?.textContent || '').trim();
const label = (id) => {
  check(typeof id === 'string' && !!id.trim(), 'INVALID_SOURCE_ID', 'Original sourceId is required');
  return id;
};
const ordinal = (value) => Number.isSafeInteger(value) && value >= 0;
function freezeAll(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeAll(child);
    Object.freeze(value);
  }
  return value;
}
function sourceOrder({mode, sourceId, manifest}, pipeCount) {
  check(mode === 'A' || mode === 'B', 'INVALID_MODE', 'Explicit Mode A or Mode B required');
  if (mode === 'A') {
    check(manifest == null, 'UNEXPECTED_MANIFEST', 'Mode A source cannot consume Mode B mapping');
    return [{sourceId:label(sourceId), pipeCount}];
  }
  check(manifest?.schema === 'xml-node-offset-combine/v1' && Array.isArray(manifest?.sourceOrder),
    'MODE_B_MANIFEST_REQUIRED', 'Mode B requires original source-order manifest');
  check(manifest.sourceOrder.length >= 2 && manifest.sourceCount === manifest.sourceOrder.length,
    'INVALID_MODE_B_MANIFEST', 'Mode B sourceCount/sourceOrder mismatch');
  const ids = new Set();
  let total = 0;
  const order = manifest.sourceOrder.map((entry, i) => {
    const id = label(entry?.sourceId);
    check(!ids.has(id), 'DUPLICATE_SOURCE_ID', 'Repeated Mode B sourceId: ' + id);
    ids.add(id);
    check(Number.isSafeInteger(entry?.pipeCount) && entry.pipeCount > 0,
      'INVALID_MODE_B_MANIFEST', 'Missing/invalid pipeCount at source index ' + i);
    total += entry.pipeCount;
    return {sourceId:id, pipeCount:entry.pipeCount};
  });
  check(total === pipeCount, 'PIPE_CUSTODY_MISMATCH',
    'Combined Pipe count differs from source-order manifest; cannot infer lineage');
  return order;
}
function selectorSet(selection) {
  if (selection == null) return null;
  check(Array.isArray(selection) && selection.length > 0,
    'INVALID_SELECTION', 'Explicit selection must contain at least one source occurrence');
  const seen = new Set();
  for (const s of selection) {
    check(ordinal(s?.branchOrdinal), 'INVALID_SELECTION', 'Source-local branchOrdinal required');
    const key = JSON.stringify([label(s.sourceId), s.branchOrdinal]);
    check(!seen.has(key), 'DUPLICATE_SELECTION', 'Source/branch occurrence selected twice');
    seen.add(key);
  }
  return seen;
}
/**
 * Project immutable, serializable, original-source occurrence *identities*.
 * xmlText may be passed with an injected parseXml(text) port for worker tests.
 * A Mode B manifest is indispensable: concatenated XML contains no trustworthy
 * sourceId by itself. Pipe/source ordering is validated, never guessed by name.
 *
 * The Mode B positive NodeNumber in combined XML may be offset; it is ONLY a
 * diagnostic attribute, never a stable physical identity or original node ID.
 * Authenticating original per-file content is a separate InputBasis/oracle gate.
 */
export function projectXmlCiiOccurrences({
  xmlText, mode = 'A', sourceId = null, manifest = null, selection = null, parseXml = null,
} = {}) {
  check(typeof xmlText === 'string' && xmlText.trim().length > 0, 'INVALID_XML', 'XML text is required');
  const parser = parseXml || ((value) => {
    check(typeof DOMParser === 'function', 'XML_PARSER_UNAVAILABLE', 'DOMParser adapter unavailable');
    return new DOMParser().parseFromString(value, 'application/xml');
  });
  const document = parser(xmlText);
  check(document?.documentElement && !document.getElementsByTagName('parsererror')?.length,
    'INVALID_XML', 'Source XML parse failed');
  const root = document.documentElement;
  check(name(root) === 'PipeStressExport', 'INVALID_XML_ROOT', 'Expected PipeStressExport XML');
  const pipes = elements(root, 'Pipe');
  check(pipes.length > 0, 'NO_PIPES', 'No Pipe occurrences in XML');
  const order = sourceOrder({mode, sourceId, manifest}, pipes.length);
  const selectedKeys = selectorSet(selection);
  const found = new Set();
  const branches = [], nodes = [];
  const sourceTotals = [];
  let currentPipe = 0, globalBranchOrdinal = 0;
  for (const {sourceId:originalId, pipeCount} of order) {
    let sourceBranchOrdinal = 0, sourceNodeCount = 0;
    for (let sourcePipeOrdinal = 0; sourcePipeOrdinal < pipeCount; sourcePipeOrdinal++) {
      const pipe = pipes[currentPipe++];
      for (const branch of elements(pipe, 'Branch')) {
        const combinedBranchOrdinal = globalBranchOrdinal++;
        const branchOrdinal = sourceBranchOrdinal++;
        const selectionKey = JSON.stringify([originalId, branchOrdinal]);
        if (selectedKeys && !selectedKeys.has(selectionKey)) continue;
        found.add(selectionKey);
        const branchName = childText(branch, 'Branchname');
        const branchId = previewOccurrenceId({sourceId:originalId,branchOrdinal});
        branches.push({
          subjectType:'branch', sourceId:originalId, occurrenceId:branchId,
          branchName, branchOrdinal, branchOccurrenceIndex:combinedBranchOrdinal,
          sourcePipeOrdinal, combinedPipeOrdinal:currentPipe-1,
          provenance:[{sourceRef:originalId, locator:`Pipe[${sourcePipeOrdinal}]/Branch[${branchOrdinal}]`}],
        });
        for (const [nodeOrdinal, node] of elements(branch, 'Node').entries()) {
          const nodeNumber = childText(node, 'NodeNumber');
          check(nodeNumber === '' || /^-?\d+$/.test(nodeNumber) && Number.isSafeInteger(Number(nodeNumber)),
            'INVALID_NODE_NUMBER', 'Invalid NodeNumber in source/branch/node ordinal ' +
            JSON.stringify([originalId,branchOrdinal,nodeOrdinal]));
          nodes.push({
            subjectType:'node',sourceId:originalId,
            occurrenceId:previewOccurrenceId({sourceId:originalId,branchOrdinal,nodeOrdinal}),
            branchOccurrenceId:branchId,branchOrdinal,branchOccurrenceIndex:combinedBranchOrdinal,
            nodeOrdinal,nodeNumber,componentType:childText(node,'ComponentType'),
            componentRefNo:childText(node,'ComponentRefNo'),endpoint:childText(node,'Endpoint'),
            provenance:[{sourceRef:originalId,locator:`Pipe[${sourcePipeOrdinal}]/Branch[${branchOrdinal}]/Node[${nodeOrdinal}]`}],
          });
          sourceNodeCount++;
        }
      }
    }
    sourceTotals.push({sourceId:originalId,pipeCount,branchCount:sourceBranchOrdinal,
      selectedBranchCount:branches.filter(x=>x.sourceId===originalId).length,
      selectedNodeCount:sourceNodeCount});
  }
  check(!selectedKeys || selectedKeys.size === found.size, 'SELECTION_OCCURRENCE_MISSING',
    'Selection refers to missing source/branch occurrence');
  check(currentPipe === pipes.length, 'PIPE_CUSTODY_MISMATCH', 'Pipe coverage incomplete');
  check(branches.length > 0, 'EMPTY_SELECTION', 'No selected Branch occurrence');
  const ids = [...branches,...nodes].map((r) => r.occurrenceId);
  check(new Set(ids).size === ids.length, 'OCCURRENCE_ALIAS', 'Source occurrence identity collision');
  return freezeAll({domainId:'xml-cii/2019',schemaVersion:'gc-pw/1.0',
    mode,branchCount:branches.length,nodeCount:nodes.length,sourceTotals,branches,nodes});
}
