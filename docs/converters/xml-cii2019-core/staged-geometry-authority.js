import { applyXmlCiiPostSplitElementLengthCleanup } from './post-split-element-length-cleanup.js';
import { cleanXmlCiiNodeBlocks } from './xml-cii-node-block-cleanup.js';
import { resolveXmlCiiBoreAuthority, xmlCiiNominalDnFromOd } from './bore-authority.js';

export { xmlCiiNominalDnFromOd };

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function truthy(value) { if (value === true) return true; if (value === false || value === null || value === undefined) return false; if (typeof value === 'number') return value !== 0; return /^(1|true|yes|on)$/i.test(text(value)); }
function defaultTrue(value) { return value === undefined || value === null ? true : truthy(value); }
function numberValue(value) { const match = text(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/); if (!match) return null; const numeric = Number(match[0]); return Number.isFinite(numeric) ? numeric : null; }
function normalizeRef(value) { return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase(); }
function normalizeType(value) { return text(value).toUpperCase(); }
function localName(node) { return text(node?.localName || node?.nodeName).replace(/^.*:/, ''); }
function childrenByName(parent, name) { return [...(parent?.childNodes || [])].filter((node) => node.nodeType === 1 && localName(node) === name); }
function firstChild(parent, name) { return childrenByName(parent, name)[0] || null; }
function childText(parent, name) { return text(firstChild(parent, name)?.textContent); }
function ensureText(document, parent, name, value) { if (!document || !parent || value === null || value === undefined || value === '') return false; let element = firstChild(parent, name); if (!element) { element = parent?.namespaceURI ? document.createElementNS(parent.namespaceURI, name) : document.createElement(name); parent.appendChild(element); } const before = text(element.textContent); const after = text(value); element.textContent = after; return before !== after; }
function parsePoint(point) { if (!point && point !== 0) return null; if (Array.isArray(point) && point.length >= 3) { const x = Number(point[0]), y = Number(point[1]), z = Number(point[2]); return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null; } if (typeof point === 'object') { const x = Number(point.x ?? point.X), y = Number(point.y ?? point.Y), z = Number(point.z ?? point.Z); return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null; } const raw = text(point); const nums = raw.match(/-?\d+(?:\.\d+)?(?:[Ee][-+]?\d+)?/g)?.map(Number).filter(Number.isFinite) || []; return nums.length >= 3 ? { x: nums[0], y: nums[1], z: nums[2] } : null; }
function pointDistance(a, b) { const pa = parsePoint(a), pb = parsePoint(b); if (!pa || !pb) return null; const length = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z); return Number.isFinite(length) && length > 0 ? length : null; }
function readAttr(attrs, names) { const entries = Object.entries(attrs || {}); for (const wanted of names) { const direct = attrs?.[wanted]; if (text(direct)) return direct; const upper = wanted.toUpperCase(); for (const [key, value] of entries) if (key.toUpperCase() === upper && text(value)) return value; } return ''; }
function stagedLengthMm(attrs) { for (const [fromKey, toKey] of [['APOS', 'LPOS'], ['HPOS', 'TPOS'], ['BPOS', 'TPOS'], ['SPOS', 'EPOS']]) { const length = pointDistance(readAttr(attrs, [fromKey]), readAttr(attrs, [toKey])); if (length !== null) return length; } return numberValue(readAttr(attrs, ['LENGTH', 'Length', 'LEN', 'lengthMm', 'ElementLengthMm'])); }
function stagedBoreMm(attrs) { const values = ['ABORE', 'LBORE', 'PBORE', 'HBORE', 'TBORE', 'HBOR', 'TBOR', 'BORE', 'DN', 'NB'].map((key) => numberValue(readAttr(attrs, [key]))).filter((value) => Number.isFinite(value) && value > 0); if (!values.length) return null; return values.find((value) => value < 1000) || values[0]; }
function stagedDtxr(attrs, component) { return text(readAttr(attrs, ['DTXR_POS', 'DTXR', 'DESC', 'DESCRIPTION', 'NAME']) || component?.name || ''); }
function walkStaged(value, branchName = '', out = []) { if (Array.isArray(value)) { value.forEach((item) => walkStaged(item, branchName, out)); return out; } if (!value || typeof value !== 'object') return out; const attrs = value.attributes && typeof value.attributes === 'object' ? value.attributes : {}; const type = normalizeType(value.type || attrs.TYPE || attrs.RAW_TYPE); const currentBranch = type === 'BRANCH' || Array.isArray(value.children) ? text(value.name || attrs.NAME || attrs.OWNER || branchName) : branchName; out.push({ component: value, attrs, type, branchName: currentBranch }); if (Array.isArray(value.children)) value.children.forEach((child) => walkStaged(child, currentBranch, out)); return out; }
export function buildXmlCiiStagedGeometryIndex(stagedJsonText) { const index = { byRef: new Map(), count: 0 }; if (!text(stagedJsonText)) return index; let parsed = null; try { parsed = typeof stagedJsonText === 'string' ? JSON.parse(stagedJsonText) : stagedJsonText; } catch { return index; } for (const item of walkStaged(parsed)) { const attrs = item.attrs || {}; const refs = [readAttr(attrs, ['REF', 'ComponentRefNo', 'COMPONENTREFNO']), readAttr(attrs, ['NAME']), item.component?.name].map(normalizeRef).filter(Boolean); if (!refs.length) continue; const geometry = { ref: refs[0], rawRefs: refs, stagedType: item.type, branchName: item.branchName, lengthMm: stagedLengthMm(attrs), boreMm: stagedBoreMm(attrs), dtxr: stagedDtxr(attrs, item.component) }; if (geometry.lengthMm === null && geometry.boreMm === null) continue; for (const ref of refs) if (!index.byRef.has(ref)) index.byRef.set(ref, geometry); index.count += 1; } return index; }
const FALLBACK_HIGH_TYPES = new Set(['FLAN', 'VALV', 'RIGID', 'INST']);
export function resolveXmlCiiStagedGeometryForNode(node, stagedIndex) { if (!node || !stagedIndex?.byRef) return null; const ref = normalizeRef(childText(node, 'ComponentRefNo')); return ref ? stagedIndex.byRef.get(ref) || null : null; }
function formatMm(value) { const numeric = Number(value); return Number.isFinite(numeric) ? numeric.toFixed(3) : ''; }
function setOrInsertInNodeBlock(block, tag, value) { const formatted = formatMm(value); if (!formatted) return block; const re = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'i'); if (re.test(block)) return block.replace(re, `<${tag}>${formatted}</${tag}>`); return block.replace(/<\/Node>\s*$/i, `<${tag}>${formatted}</${tag}></Node>`); }
function shouldDropGasketNodes(options = {}) { const config = options?.config && typeof options.config === 'object' ? options.config : {}; return truthy(options.disableGasketNodes) || truthy(options.disableGasketInOutput) || truthy(config.disableGasketNodes) || truthy(config.disableGasketInOutput) || (defaultTrue(options.dropGasketNodes) && defaultTrue(options.dropGasketsInEnrichment) && defaultTrue(config.dropGasketNodes) && defaultTrue(config.dropGasketsInEnrichment)); }
function shouldSuppressFallbackHighNodeNumbers(options = {}) { const config = options?.config && typeof options.config === 'object' ? options.config : {}; const splitEnabled = truthy(options.splitCondensedValveFlange) || truthy(options.split_condensed_valve_flange) || truthy(config.splitCondensedValveFlange) || truthy(config.split_condensed_valve_flange); return splitEnabled; }
function isFallbackHighNode(componentType, nodeNumber) { const number = Number(nodeNumber); return Number.isFinite(number) && number >= 10000 && FALLBACK_HIGH_TYPES.has(normalizeType(componentType)); }
function dropGasketNodesInDom(document) { let count = 0; for (const node of [...document.getElementsByTagName('Node')]) { if (normalizeType(childText(node, 'ComponentType')) !== 'GASK') continue; node.parentNode?.removeChild(node); count += 1; } return count; }
function suppressFallbackHighNodeNumbersInDom(document) { let count = 0; for (const node of [...document.getElementsByTagName('Node')]) { if (!isFallbackHighNode(childText(node, 'ComponentType'), childText(node, 'NodeNumber'))) continue; if (ensureText(document, node, 'NodeNumber', '-1')) count += 1; } return count; }
function dropNodeBlocksInText(xmlText, predicate) { let count = 0; const xmlOut = text(xmlText).replace(/<Node\b[\s\S]*?<\/Node>/gi, (block) => { const componentType = normalizeType(block.match(/<ComponentType>([\s\S]*?)<\/ComponentType>/i)?.[1] || ''); if (!predicate(componentType)) return block; count += 1; return ''; }); return { xmlText: xmlOut, count }; }
function suppressNodeNumbersInText(xmlText, predicate) { let count = 0; const xmlOut = text(xmlText).replace(/<Node\b[\s\S]*?<\/Node>/gi, (block) => { const componentType = normalizeType(block.match(/<ComponentType>([\s\S]*?)<\/ComponentType>/i)?.[1] || ''); const nodeNumber = text(block.match(/<NodeNumber>([\s\S]*?)<\/NodeNumber>/i)?.[1] || ''); if (!predicate(componentType, nodeNumber)) return block; count += 1; if (/<NodeNumber>[\s\S]*?<\/NodeNumber>/i.test(block)) return block.replace(/<NodeNumber>[\s\S]*?<\/NodeNumber>/i, '<NodeNumber>-1</NodeNumber>'); return block.replace(/(<Node\b[^>]*>)/i, '$1<NodeNumber>-1</NodeNumber>'); }); return { xmlText: xmlOut, count }; }
function enforcedCleanupOptions(options, stage) { const config = options?.config && typeof options.config === 'object' ? options.config : {}; return { ...(options || {}), stage, config: { ...config, dropGasketNodes: true, dropGasketsInEnrichment: true, dropShortElementLengthNodes: true, shortElementLengthDropThresholdMm: Number(config.shortElementLengthDropThresholdMm ?? options.shortElementLengthDropThresholdMm ?? 6) } }; }
function addStats(base = {}, extra = {}) { const out = { ...base }; for (const key of ['gasketNodesDropped', 'shortElementLengthNodesDropped']) out[key] = Number(out[key] || 0) + Number(extra[key] || 0); out.shortElementLengthNodesDroppedByType = { ...(out.shortElementLengthNodesDroppedByType || {}) }; for (const [type, count] of Object.entries(extra.shortElementLengthNodesDroppedByType || {})) out.shortElementLengthNodesDroppedByType[type] = Number(out.shortElementLengthNodesDroppedByType[type] || 0) + Number(count || 0); return out; }
function mergeCleanup(result, options, stage = 'post-staged-geometry-authority') { const cleanup = applyXmlCiiPostSplitElementLengthCleanup(result.xmlText, enforcedCleanupOptions(options, stage)); return { xmlText: cleanup.xmlText, stats: addStats({ ...(result.stats || {}), postSplitElementLengthsRecalculated: cleanup.stats.postSplitElementLengthsRecalculated || 0 }, cleanup.stats || {}), diagnostics: [...(result.diagnostics || []), ...(cleanup.diagnostics || [])] }; }
function preCleanXml(xmlText, options, stage) { return cleanXmlCiiNodeBlocks(xmlText, enforcedCleanupOptions(options, stage)); }
function applyRegexFallback(xmlText, index, options = {}) {
  const first = preCleanXml(xmlText, options, 'pre-staged-geometry-authority');
  const stats = addStats({
    stagedGeometryMatches: 0,
    stagedLengthAnnotations: 0,
    stagedBoreAnnotations: 0,
    sourceBoreAnnotations: 0,
    sourceBoreCorrections: 0,
    gasketNodesDropped: 0,
    fallbackHighNodeNumbersSuppressed: 0,
  }, first.stats || {});
  const diagnostics = [...(first.diagnostics || [])];
  const config = options?.config && typeof options.config === 'object' ? options.config : {};
  let xmlOut = first.xmlText;

  if (shouldDropGasketNodes(options)) {
    const dropped = dropNodeBlocksInText(xmlOut, (type) => type === 'GASK');
    xmlOut = dropped.xmlText;
    stats.gasketNodesDropped += dropped.count;
  }

  xmlOut = xmlOut.replace(/<Node\b[\s\S]*?<\/Node>/gi, (block) => {
    const ref = normalizeRef(block.match(/<ComponentRefNo>([\s\S]*?)<\/ComponentRefNo>/i)?.[1] || '');
    const geometry = ref ? index?.byRef?.get(ref) || null : null;

    let out = block;
    let stagedChanged = false;
    if (geometry?.lengthMm !== null && geometry?.lengthMm !== undefined) {
      out = setOrInsertInNodeBlock(out, 'ElementLengthMm', geometry.lengthMm);
      stats.stagedLengthAnnotations += 1;
      stagedChanged = true;
    }

    const sourceOutsideDiameterMm = numberValue(block.match(/<OutsideDiameter>([\s\S]*?)<\/OutsideDiameter>/i)?.[1] || '');
    const existingBoreMm = numberValue(block.match(/<BoreMm>([\s\S]*?)<\/BoreMm>/i)?.[1] || '');
    const authority = resolveXmlCiiBoreAuthority({
      xmlOutsideDiameterMm: sourceOutsideDiameterMm,
      xmlBoreMm: existingBoreMm,
      stagedBoreMm: geometry?.boreMm,
      validationTraceText: geometry?.dtxr || '',
      config,
    });
    if (authority.boreMm !== null) {
      const before = out;
      out = setOrInsertInNodeBlock(out, 'BoreMm', authority.boreMm);
      if (out !== before) {
        stats.sourceBoreAnnotations += 1;
        if (existingBoreMm !== null && Math.abs(existingBoreMm - Number(authority.boreMm)) > 1e-6) {
          stats.sourceBoreCorrections += 1;
        }
      }
      if (geometry) stats.stagedBoreAnnotations += 1;
      if (geometry && out !== before) stagedChanged = true;
    }
    if (authority.diagnostic) diagnostics.push({
      ...authority.diagnostic,
      componentRefNo: ref,
      stage: 'staged-geometry-regex',
    });
    if (geometry && stagedChanged) stats.stagedGeometryMatches += 1;
    return out;
  });

  if (shouldSuppressFallbackHighNodeNumbers(options)) {
    const suppressedHigh = suppressNodeNumbersInText(xmlOut, isFallbackHighNode);
    xmlOut = suppressedHigh.xmlText;
    stats.fallbackHighNodeNumbersSuppressed = suppressedHigh.count;
  }
  if (stats.fallbackHighNodeNumbersSuppressed > 0) {
    diagnostics.push({
      type: 'fallback-high-node-number-suppressed',
      count: stats.fallbackHighNodeNumbersSuppressed,
      message: 'Generated fallback 10000+ inline node numbers were set back to -1; keeping them is intentionally not user-configurable.',
    });
  }
  return mergeCleanup({ xmlText: xmlOut, stats, diagnostics }, options);
}

export function applyXmlCiiStagedGeometryAuthority(xmlText, stagedJsonText, options = {}) {
  const index = options.stagedIndex || buildXmlCiiStagedGeometryIndex(stagedJsonText);
  const first = preCleanXml(xmlText, options, 'pre-staged-geometry-authority');
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return applyRegexFallback(first.xmlText, index, options);
  }

  let document = null;
  try {
    document = new DOMParser().parseFromString(text(first.xmlText), 'application/xml');
    if (document.getElementsByTagName('parsererror').length) {
      return applyRegexFallback(first.xmlText, index, options);
    }
  } catch {
    return applyRegexFallback(first.xmlText, index, options);
  }

  const stats = addStats({
    stagedGeometryMatches: 0,
    stagedLengthAnnotations: 0,
    stagedBoreAnnotations: 0,
    sourceBoreAnnotations: 0,
    sourceBoreCorrections: 0,
    gasketNodesDropped: 0,
    fallbackHighNodeNumbersSuppressed: 0,
  }, first.stats || {});
  const diagnostics = [...(first.diagnostics || [])];
  const config = options?.config && typeof options.config === 'object' ? options.config : {};

  if (shouldDropGasketNodes(options)) {
    const dropped = dropGasketNodesInDom(document);
    stats.gasketNodesDropped += dropped;
    if (dropped > 0) diagnostics.push({
      type: 'gasket-node-dropped',
      count: dropped,
      message: 'GASK nodes were removed from enriched XML before staged geometry/weight matching.',
    });
  }

  for (const branch of [...document.getElementsByTagName('Branch')]) {
    const branchName = childText(branch, 'Branchname');
    for (const node of childrenByName(branch, 'Node')) {
      const geometry = resolveXmlCiiStagedGeometryForNode(node, index);

      let stagedChanged = false;
      if (geometry?.lengthMm !== null && geometry?.lengthMm !== undefined && geometry.lengthMm > 0) {
        if (ensureText(document, node, 'ElementLengthMm', formatMm(geometry.lengthMm))) stagedChanged = true;
        stats.stagedLengthAnnotations += 1;
      }

      const sourceOutsideDiameterMm = numberValue(childText(node, 'OutsideDiameter'));
      const existingBoreMm = numberValue(childText(node, 'BoreMm'));
      const authority = resolveXmlCiiBoreAuthority({
        xmlOutsideDiameterMm: sourceOutsideDiameterMm,
        xmlBoreMm: existingBoreMm,
        stagedBoreMm: geometry?.boreMm,
        branchName,
        validationTraceText: geometry?.dtxr || '',
        config,
      });
      if (authority.boreMm !== null && authority.boreMm > 0) {
        const changed = ensureText(document, node, 'BoreMm', formatMm(authority.boreMm));
        if (changed) {
          stats.sourceBoreAnnotations += 1;
          if (existingBoreMm !== null && Math.abs(existingBoreMm - Number(authority.boreMm)) > 1e-6) {
            stats.sourceBoreCorrections += 1;
          }
        }
        if (geometry) stats.stagedBoreAnnotations += 1;
        if (geometry && changed) stagedChanged = true;
      }
      if (authority.diagnostic) diagnostics.push({
        ...authority.diagnostic,
        branchName,
        nodeNumber: childText(node, 'NodeNumber'),
        componentRefNo: childText(node, 'ComponentRefNo'),
        stage: 'staged-geometry',
      });

      if (geometry && stagedChanged) {
        stats.stagedGeometryMatches += 1;
        diagnostics.push({
          type: 'staged-geometry-authority',
          branchName,
          nodeNumber: childText(node, 'NodeNumber'),
          componentRefNo: childText(node, 'ComponentRefNo'),
          stagedType: geometry.stagedType,
          dtxr: geometry.dtxr,
          lengthMm: geometry.lengthMm,
          boreMm: authority.boreMm,
          lengthSource: geometry.lengthMm !== null ? 'staged-component-refno' : '',
          boreSource: authority.source,
        });
      } else if (!geometry && sourceOutsideDiameterMm !== null && authority.boreMm !== null && existingBoreMm !== Number(authority.boreMm)) {
        diagnostics.push({
          type: 'source-bore-authority-correction',
          branchName,
          nodeNumber: childText(node, 'NodeNumber'),
          componentRefNo: childText(node, 'ComponentRefNo'),
          outsideDiameterMm: sourceOutsideDiameterMm,
          previousBoreMm: existingBoreMm,
          boreMm: authority.boreMm,
          boreSource: authority.source,
          message: 'Source OutsideDiameter corrected stale enriched BoreMm without requiring staged geometry.',
        });
      }
    }
  }

  if (shouldSuppressFallbackHighNodeNumbers(options)) {
    stats.fallbackHighNodeNumbersSuppressed = suppressFallbackHighNodeNumbersInDom(document);
    if (stats.fallbackHighNodeNumbersSuppressed > 0) diagnostics.push({
      type: 'fallback-high-node-number-suppressed',
      count: stats.fallbackHighNodeNumbersSuppressed,
      message: 'Generated fallback 10000+ inline node numbers were set back to -1; keeping them is intentionally not user-configurable.',
    });
  }

  return mergeCleanup({
    xmlText: new XMLSerializer().serializeToString(document),
    stats,
    diagnostics,
  }, options);
}
