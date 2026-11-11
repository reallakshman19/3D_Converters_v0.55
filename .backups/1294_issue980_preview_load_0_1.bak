export * from './xml-cii-adapted-preview-dryrun-core.js?v=20261001-weight-output-2';

import './xml-cii-adapted-authority-migration.js';
import { xmlCiiDryRunPreview as buildCorePreview } from './xml-cii-adapted-preview-dryrun-core.js?v=20261001-weight-output-2';
import { withXmlCiiEffectiveRigidWeightLegacyView } from '../../../converters/xml-cii2019-core/rigid-weight-authority.js?v=20260928-issue776-authority-2';
import { applyPreviewBoreWallAuthority } from './xml-cii-adapted-preview-bore-wall-authority.js';
import { applyPreviewMaterialCodeAuthority } from './xml-cii-adapted-preview-material-authority.js';
import { applyPreviewRatingAuthority, rerankPreviewNodeRows } from './xml-cii-adapted-preview-rating-authority.js?v=20261001-weight-output-2';
import { buildIncrementalPreview } from './xml-cii-adapted-preview-incremental.js';
import { getSourceDocumentContext } from './xml-cii-adapted-source-derived-context.js';
import { preparePreviewLineListCoreConfig } from './xml-cii-adapted-preview-line-index.js?v=20261001-weight-output-2';

const AUTOMATIC_LINE_MATCH_METHODS = new Set(['similar-lineseq', 'similar-linekey']);
const LINE_AUTHORITY_VERSION = 'strict-explicit-or-exact-v1';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function localName(node) {
  return text(node?.localName || node?.nodeName).replace(/^.*:/, '');
}

function childText(parent, name) {
  for (const child of [...(parent?.childNodes || [])]) {
    if (child?.nodeType === 1 && localName(child) === name) return text(child.textContent);
  }
  return '';
}

export function isAutomaticLineNumberMatchMethod(method) {
  return AUTOMATIC_LINE_MATCH_METHODS.has(text(method).toLowerCase());
}

function strictLineListConfig(config = {}) {
  return {
    ...config,
    linelist: {
      ...(config?.linelist || {}),
      masterRows: [],
    },
  };
}

function browserBranchFragments(xmlText, sourceDocument = null) {
  if (typeof XMLSerializer === 'undefined') return [];
  try {
    const document = sourceDocument || (
      typeof DOMParser === 'undefined'
        ? null
        : new DOMParser().parseFromString(String(xmlText ?? ''), 'application/xml')
    );
    if (!document || document.getElementsByTagName('parsererror').length) return [];
    const serializer = new XMLSerializer();
    return [...document.getElementsByTagName('Branch')].map((branch, index) => ({
      index,
      branchName: childText(branch, 'Branchname'),
      xmlText: `<Root>${serializer.serializeToString(branch)}</Root>`,
    }));
  } catch {
    return [];
  }
}

function blockedUnmappedRow(row) {
  return {
    ...row,
    lineKeyMethod: 'none',
    lineKeyConfidence: 0,
    lineKeyProposed: '',
    lineFrom: '',
    lineTo: '',
    lineMiss: true,
    pipingClass: '',
    pipingClassDerived: '',
    pipingClassMethod: 'none',
    pipingClassConfidence: 0,
    pipingClassNeedsReview: true,
    material: '',
    materialSource: 'none',
    materialCode: '',
    materialCodeMethod: 'none',
    materialCodeNeedsReview: true,
    rating: '',
    ratingDerived: '',
    ratingSource: 'none',
    p1: '',
    hydroPressure: '0',
    t1: '',
    t2: '',
    t3: '',
    density: '',
    p1Source: 'none',
    hydroPressureSource: 'default-zero',
    t1Source: 'none',
    t2Source: 'none',
    t3Source: 'none',
    densitySource: 'none',
    wallThickness: '',
    wallThicknessSource: 'none',
    corrosion: '',
    corrosionSource: 'none',
    automaticLineMatchRemoved: true,
    strictLineAuthorityBlocked: true,
  };
}

export function buildStrictLineAuthorityCorePreview(
  xmlText,
  config = {},
  stagedJsonText = '',
  runtime = {},
) {
  const build = typeof runtime.buildCorePreview === 'function'
    ? runtime.buildCorePreview
    : buildCorePreview;
  const fragmentBuilder = typeof runtime.branchFragments === 'function'
    ? runtime.branchFragments
    : browserBranchFragments;
  const sourceDocument = runtime.sourceDocument || null;
  const preparedLineList = preparePreviewLineListCoreConfig(sourceDocument, config);
  const coreConfig = preparedLineList?.config || config;
  const coreResult = build(xmlText, coreConfig, stagedJsonText, { sourceDocument }) || {};
  const branchRows = Array.isArray(coreResult.branchRows)
    ? coreResult.branchRows.map((row) => ({ ...row }))
    : [];
  let nodeRows = Array.isArray(coreResult.nodeRows)
    ? coreResult.nodeRows.map((row) => ({ ...row }))
    : [];
  const automaticIndexes = branchRows
    .map((row, index) => (isAutomaticLineNumberMatchMethod(row?.lineKeyMethod) ? index : -1))
    .filter((index) => index >= 0);
  if (!automaticIndexes.length) return { ...coreResult, branchRows, nodeRows };

  const fragments = fragmentBuilder(xmlText, sourceDocument) || [];
  const strictConfig = strictLineListConfig(config);
  for (const index of automaticIndexes) {
    const original = branchRows[index];
    const fragment = fragments[index];
    let replacement = null;
    let replacementNodes = [];
    if (fragment?.xmlText) {
      const rebuilt = build(fragment.xmlText, strictConfig, stagedJsonText) || {};
      replacement = Array.isArray(rebuilt.branchRows) ? rebuilt.branchRows[0] : null;
      replacementNodes = Array.isArray(rebuilt.nodeRows) ? rebuilt.nodeRows : [];
    }
    branchRows[index] = replacement
      ? {
        ...replacement,
        lineKeyMethod: 'none',
        lineKeyConfidence: 0,
        lineKeyProposed: '',
        lineMiss: true,
        automaticLineMatchRemoved: true,
        strictLineAuthorityBlocked: false,
      }
      : blockedUnmappedRow(original);
    const branchName = text(original?.branchName);
    if (branchName) nodeRows = nodeRows.filter((row) => text(row?.branchName) !== branchName);
    if (replacementNodes.length) nodeRows.push(...replacementNodes);
  }
  return {
    ...coreResult,
    branchRows,
    nodeRows,
    strictLineAuthority: {
      version: LINE_AUTHORITY_VERSION,
      automaticMatchesRemoved: automaticIndexes.length,
    },
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  import('../../xml-cii-effective-class-shard-hydrator.js')
    .then(({ installXmlCiiEffectiveClassShardHydrator }) => installXmlCiiEffectiveClassShardHydrator())
    .catch((error) => console.error('Failed to install XML→CII effective-class shard hydrator:', error));
}

function buildFullDryRunPreview(xmlText, config, stagedJsonText) {
  const previewConfig = withXmlCiiEffectiveRigidWeightLegacyView(config);
  const sourceDocument = getSourceDocumentContext(xmlText).document;
  const coreResult = buildStrictLineAuthorityCorePreview(
    xmlText, previewConfig, stagedJsonText, { sourceDocument },
  );
  const wallResult = applyPreviewBoreWallAuthority({
    xmlText, config: previewConfig, stagedJsonText, result: coreResult, sourceDocument,
  });
  const materialResult = applyPreviewMaterialCodeAuthority({ config: previewConfig, result: wallResult });
  return applyPreviewRatingAuthority({
    xmlText, config: previewConfig, stagedJsonText, result: materialResult, sourceDocument,
  });
}

export function xmlCiiDryRunPreview(xmlText, config, stagedJsonText) {
  const previewConfig = withXmlCiiEffectiveRigidWeightLegacyView(config);
  return buildIncrementalPreview({
    xmlText,
    stagedJsonText,
    config: previewConfig,
    fullBuild: () => buildFullDryRunPreview(xmlText, previewConfig, stagedJsonText),
    rerankWeight: (nodeRows, branchRows, nextConfig) => rerankPreviewNodeRows(
      nodeRows,
      branchRows,
      withXmlCiiEffectiveRigidWeightLegacyView(nextConfig),
    ),
    reapplyMaterial: (previousResult, nextConfig) => applyPreviewMaterialCodeAuthority({
      config: withXmlCiiEffectiveRigidWeightLegacyView(nextConfig),
      result: previousResult,
    }),
  }).result;
}
