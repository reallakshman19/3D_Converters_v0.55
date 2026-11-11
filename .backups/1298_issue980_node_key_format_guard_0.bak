import {
  buildExactClassWallIndex,
  buildStagedBranchWallEvidenceIndex,
  collectXmlBranchWallEvidence,
  childText,
  children,
  exactClassWallFromIndex,
  stagedBranchWallEvidenceFromIndex,
  resolveBranchNominalBore,
  text,
} from './xml-cii-adapted-preview-wall-evidence.js';
import {
  resolveXmlCiiWallThicknessWithEvidence,
} from '../../../converters/xml-cii2019-core/dtxr-wall-evidence-ledger.js';
import {
  resolveXmlCiiBoreAuthority,
} from '../../../converters/xml-cii2019-core/bore-authority.js';
import {
  buildXmlCiiStagedGeometryIndex,
  resolveXmlCiiStagedGeometryForNode,
} from '../../../converters/xml-cii2019-core/staged-geometry-authority.js?v=20261006-p2810042-bore-1';
import {
  buildStandaloneBoreTraceValidationIndex,
} from '../xml-cii-resolver-json-trace.js';

function norm(value) {
  return text(value).toUpperCase().replace(/\s+/g, '');
}

function normalizedRef(value) {
  return text(value).replace(/^=/, '').replace(/\s+/g, '').toUpperCase();
}

function classSizeKey(row, boreMm) {
  const pipingClass = norm(row?.pipingClass || row?.pipingClassDerived);
  return pipingClass && Number.isFinite(Number(boreMm))
    ? `PC:${pipingClass}|DN:${Math.round(Number(boreMm))}`
    : row?.wallThicknessKey;
}

function branchEvidence(branch, branchName, stagedIndex) {
  return [
    ...stagedBranchWallEvidenceFromIndex(stagedIndex, branchName),
    ...collectXmlBranchWallEvidence(branch),
  ];
}

function wallAuthorityForBore({
  boreMm,
  evidence,
  classWallIndex,
  pipingClass,
  config,
}) {
  if (!Number.isFinite(Number(boreMm)) || Number(boreMm) <= 0) {
    return { authority: null, dtxr: null, classWall: null };
  }
  const dtxr = resolveXmlCiiWallThicknessWithEvidence({
    boreMm,
    dtxrValues: evidence,
    config,
  });
  const classWall = exactClassWallFromIndex(
    classWallIndex, pipingClass, boreMm,
  );
  const authority = dtxr?.evidenceKind === 'DIRECT_WALL'
    ? dtxr
    : (classWall || dtxr);
  return { authority, dtxr, classWall };
}

function withWallEvidenceFields(result, dtxr) {
  result.dtxrWallThickness = dtxr?.wallThicknessMm || '';
  result.dtxrWallSchedule = dtxr?.schedule || '';
  result.dtxrWallSource = dtxr?.source || '';
  result.dtxrWallDtxr = dtxr?.dtxr || '';
  result.dtxrWallEvidenceKind = dtxr?.evidenceKind || '';
  result.dtxrWallComponentType = dtxr?.componentType || '';
  result.dtxrWallComponentRefNo = dtxr?.componentRefNo || '';
  result.dtxrWallEvidenceBoreMm = dtxr?.evidenceBoreMm || '';
  result.dtxrWallEvidenceSource = dtxr?.evidenceSource || '';
  result.dtxrWallNps = dtxr?.nps || '';
  result.dtxrWallProvenance = dtxr?.provenance || null;
  result.dtxrWallEvidenceSchema = dtxr?.evidenceSchema || '';
  result.dtxrWallSelectionPolicy = dtxr?.selectionPolicy || '';
  result.dtxrWallSelectedEvidence = dtxr?.selectedEvidence || null;
  result.dtxrWallEvidenceRecords = dtxr?.evidenceRecords || [];
  result.dtxrWallEvidenceCount = dtxr?.evidenceCount || 0;
  result.dtxrWallEligibleEvidenceCount = dtxr?.eligibleEvidenceCount || 0;
  result.dtxrWallRejectedEvidenceCount = dtxr?.rejectedEvidenceCount || 0;
  return result;
}

function correctedRow(row, branch, indexes, config) {
  const boreMm = resolveBranchNominalBore(row.branchName, row.sizeMm, config);
  const evidence = branchEvidence(branch, row.branchName, indexes.stagedWall);
  const { authority, dtxr } = wallAuthorityForBore({
    boreMm,
    evidence,
    classWallIndex: indexes.classWall,
    pipingClass: row.pipingClass || row.pipingClassDerived,
    config,
  });
  const result = {
    ...row,
    sizeMm: boreMm,
    size: boreMm ? `${boreMm}mm` : row.size,
    wallThicknessKey: classSizeKey(row, boreMm),
  };
  if (authority) {
    result.wallThickness = Number(authority.wallThicknessMm.toPrecision(6)).toString();
    result.wallThicknessSource = authority.source;
  }
  return withWallEvidenceFields(result, dtxr);
}

function parseXml(xmlText) {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const document = new DOMParser().parseFromString(text(xmlText), 'application/xml');
    return document.getElementsByTagName('parsererror').length ? null : document;
  } catch {
    return null;
  }
}

function sourceDocumentOrParse(xmlText, sourceDocument = null) {
  if (sourceDocument) {
    return sourceDocument.getElementsByTagName('parsererror').length ? null : sourceDocument;
  }
  return parseXml(xmlText);
}

function branchOccurrences(document) {
  return [...document.getElementsByTagName('Branch')];
}

function nodeAuthorityKey({
  branchName,
  nodeNumber,
  componentRefNo,
  endpoint,
}) {
  return [
    text(branchName),
    text(nodeNumber),
    normalizedRef(componentRefNo),
    text(endpoint),
  ].join('::');
}

function nodeTraceText(node, stagedGeometry) {
  const xmlTrace = [
    'DTXR',
    'DTXR_POS',
    'TEEDESC_POS',
    'DTXR_PS',
  ].map((name) => childText(node, name)).find((value) => text(value));
  return text(xmlTrace || stagedGeometry?.dtxr || '');
}

function buildNodeBoreWallRows({
  document,
  xmlText,
  stagedJsonText,
  correctedBranchRows,
  indexes,
  config,
}) {
  const branchRows = correctedBranchRows || [];
  const rows = [];
  const diagnostics = [];
  let traceIndex = null;
  let xmlIndex = 0;
  const traceValidationFor = (index) => {
    if (!(traceIndex instanceof Map)) {
      traceIndex = buildStandaloneBoreTraceValidationIndex(
        xmlText,
        stagedJsonText,
        config,
      );
    }
    return traceIndex.get(Number(index)) || null;
  };

  for (const [branchOccurrenceIndex, branch] of branchOccurrences(document).entries()) {
    const branchName = childText(branch, 'Branchname');
    const branchRow = branchRows[branchOccurrenceIndex];
    if (!branchRow || text(branchRow.branchName) !== branchName) {
      throw new Error('Combined Preview bore/wall branch occurrence drift; conversion blocked.');
    }
    const pipingClass = branchRow?.pipingClass || branchRow?.pipingClassDerived || '';
    const evidence = branchEvidence(branch, branchName, indexes.stagedWall);

    for (const node of children(branch, 'Node')) {
      xmlIndex += 1;
      const stagedGeometry = resolveXmlCiiStagedGeometryForNode(
        node, indexes.stagedGeometry,
      );
      const boreArgs = {
        xmlOutsideDiameterMm: childText(node, 'OutsideDiameter')
          || childText(node, 'OuterDiameter')
          || childText(node, 'OD'),
        xmlBoreMm: childText(node, 'BoreMm') || childText(node, 'Bore'),
        stagedBoreMm: stagedGeometry?.boreMm,
        branchName,
        fallbackBoreMm: branchRow?.sizeMm,
        config,
      };
      const initialBore = resolveXmlCiiBoreAuthority(boreArgs);
      const traceValidation = initialBore.fallbackUsed
        ? traceValidationFor(xmlIndex)
        : null;
      const bore = traceValidation
        ? resolveXmlCiiBoreAuthority({
            ...boreArgs,
            validationTraceBoreMm: traceValidation.boreMm,
            validationTraceStatus: traceValidation.status,
            validationTraceSource: traceValidation.source,
            validationTraceText: nodeTraceText(node, stagedGeometry),
          })
        : initialBore;
      const { authority, dtxr } = wallAuthorityForBore({
        boreMm: bore.boreMm,
        evidence,
        classWallIndex: indexes.classWall,
        pipingClass,
        config,
      });

      const row = withWallEvidenceFields({
        key: nodeAuthorityKey({
          branchName,
          nodeNumber: childText(node, 'NodeNumber'),
          componentRefNo: childText(node, 'ComponentRefNo'),
          endpoint: childText(node, 'Endpoint'),
        }),
        branchName,
        nodeNumber: childText(node, 'NodeNumber'),
        componentType: childText(node, 'ComponentType'),
        componentRefNo: childText(node, 'ComponentRefNo'),
        endpoint: childText(node, 'Endpoint'),
        pipingClass,
        boreMm: bore.boreMm,
        boreSource: bore.source,
        boreFallbackUsed: bore.fallbackUsed,
        boreTraceMismatch: bore.traceMismatch,
        boreNeedsReview: bore.needsReview,
        boreValidationTraceMm: bore.validationTraceBoreMm,
        boreTraceStatus: bore.validationTraceStatus || '',
        boreTraceSource: bore.validationTraceSource || '',
        wallThickness: authority?.wallThicknessMm != null
          ? Number(authority.wallThicknessMm.toPrecision(6)).toString()
          : '',
        wallThicknessSource: authority?.source || '',
        wallThicknessKey: classSizeKey({ pipingClass }, bore.boreMm),
      }, dtxr);
      rows.push(row);

      if (bore.diagnostic) {
        diagnostics.push({
          ...bore.diagnostic,
          branchName,
          nodeNumber: row.nodeNumber,
          componentType: row.componentType,
          componentRefNo: row.componentRefNo,
          endpoint: row.endpoint,
          stage: 'preview-node-bore-wall-authority',
        });
      }
    }
  }
  return { rows, diagnostics };
}

function correctNodeRows(nodeRows, nodeBoreWallRows) {
  const byKey = new Map();
  const contestedKeys = new Set((nodeRows || []).map((row) => row.key));
  for (const item of nodeBoreWallRows || []) {
    const existing = byKey.get(item.key);
    if (existing && contestedKeys.has(item.key)
      && ['boreMm', 'wallThickness', 'pipingClass'].some((field) => text(existing[field]) !== text(item[field]))) {
      throw new Error('Combined Preview duplicate node key has conflicting bore/wall authority; conversion blocked.');
    }
    byKey.set(item.key, item);
  }
  return (nodeRows || []).map((row) => {
    const key = nodeAuthorityKey(row);
    const authority = byKey.get(key);
    if (!authority) return row;
    return {
      ...row,
      boreMm: authority.boreMm,
      boreSource: authority.boreSource,
      boreFallbackUsed: authority.boreFallbackUsed,
      boreTraceMismatch: authority.boreTraceMismatch,
      boreNeedsReview: authority.boreNeedsReview,
      boreValidationTraceMm: authority.boreValidationTraceMm,
      boreTraceStatus: authority.boreTraceStatus,
      boreTraceSource: authority.boreTraceSource,
      wallThickness: authority.wallThickness,
      wallThicknessSource: authority.wallThicknessSource,
      wallThicknessKey: authority.wallThicknessKey,
    };
  });
}

export function applyPreviewBoreWallAuthority({
  xmlText, stagedJsonText, config = {}, result, sourceDocument = null,
}) {
  if (!result || !Array.isArray(result.branchRows)) return result;
  const document = sourceDocumentOrParse(xmlText, sourceDocument);
  if (!document) return result;
  const branches = branchOccurrences(document);
  if (branches.length !== result.branchRows.length) {
    throw new Error('Combined Preview branch population drift; conversion blocked.');
  }
  const indexes = {
    stagedWall: buildStagedBranchWallEvidenceIndex(stagedJsonText),
    stagedGeometry: buildXmlCiiStagedGeometryIndex(stagedJsonText),
    classWall: buildExactClassWallIndex(config),
  };
  const branchRows = result.branchRows.map((row, index) => {
    if (text(row.branchName) !== childText(branches[index], 'Branchname')) {
      throw new Error('Combined Preview branch order drift; conversion blocked.');
    }
    return correctedRow(row, branches[index], indexes, config);
  });
  const nodeAuthority = buildNodeBoreWallRows({
    document,
    xmlText,
    stagedJsonText,
    correctedBranchRows: branchRows,
    indexes,
    config,
  });
  return {
    ...result,
    branchRows,
    nodeRows: correctNodeRows(result.nodeRows, nodeAuthority.rows),
    nodeBoreWallRows: nodeAuthority.rows,
    boreAuthorityDiagnostics: nodeAuthority.diagnostics,
  };
}
