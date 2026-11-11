import { installWeightBasisXmlDom } from './weight-basis-xml-dom.js?v=20260930-issue781-weight-basis-worker-1';

let modulesPromise = null;

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function truthy(value) {
  if (value === true) return true;
  if (value === false || value == null) return false;
  return /^(1|true|yes|on)$/i.test(text(value).trim());
}

async function basisModules() {
  if (!modulesPromise) {
    installWeightBasisXmlDom(globalThis);
    modulesPromise = Promise.all([
      import('../../model-converters/converters/xmltocii2019_helper/enrichment-run-parity.js?v=20260930-issue781-weight-basis-worker-1'),
      import('../../../converters/xml-cii2019-core/staged-geometry-authority.js?v=20260930-issue781-weight-basis-worker-1'),
      import('../../../converters/xml-cii2019-core/weight-match-model.js?v=20260930-issue781-weight-basis-worker-1'),
      import('../../../converters/xml-cii2019-core/rigid-weight-authority.js?v=20260930-issue781-weight-basis-worker-1'),
      import('../../../converters/xml-cii2019-core/preview-rating-snapshot.js?v=20260930-issue781-weight-basis-worker-1'),
    ]);
  }
  return modulesPromise;
}

function geometryOptions(config) {
  const split = truthy(config?.splitCondensedValveFlange)
    || truthy(config?.split_condensed_valve_flange);
  return {
    dryRun: true,
    skipAutoWeightMatch: true,
    supportConfigJson: JSON.stringify(config || {}),
    splitCondensedValveFlange: split,
    split_condensed_valve_flange: split,
    condenseRigidXsd: truthy(config?.condenseRigidXsd) || truthy(config?.condense_rigid_xsd),
  };
}

function reattachMasterRows(preparedConfig, hydratedConfig) {
  const out = { ...(preparedConfig || {}) };
  const specs = [
    ['linelist', 'masterRows'],
    ['pipingClass', 'masterRows'],
    ['material', 'mapRows'],
  ];
  for (const [sectionName, rowsKey] of specs) {
    const hydrated = plainObject(hydratedConfig?.[sectionName]);
    const prepared = plainObject(out?.[sectionName]);
    out[sectionName] = { ...hydrated, ...prepared };
    if (Array.isArray(hydrated[rowsKey])) out[sectionName][rowsKey] = hydrated[rowsKey];
  }
  out.weight = { ...plainObject(hydratedConfig?.weight), ...plainObject(out.weight) };
  out.overrides = {
    ...plainObject(out.overrides),
    ...plainObject(hydratedConfig?.overrides),
  };
  return out;
}

function withRatingAuthority(row, mode, snapshot, ratingApi) {
  const preview = ratingApi.resolveXmlCiiPreviewRating(row, snapshot);
  const resolved = ratingApi.resolveXmlCiiWeightMatchRating(row, { mode, snapshot });
  const previewBore = Number(preview?.record?.sizeMm);
  return {
    ...row,
    lineKey: row?.lineKey || preview?.record?.lineKey || '',
    requestedPipingClass: row?.requestedPipingClass || preview?.record?.pipingClass || '',
    resolvedPipingClass: row?.resolvedPipingClass || preview?.record?.pipingClass || '',
    boreMm: Number.isFinite(previewBore) && previewBore > 0 ? previewBore : row?.boreMm,
    rating: resolved.rating,
    ratingSource: resolved.source,
    dtxrRating: resolved.dtxrRating,
    ratingMode: resolved.mode,
    ratingSnapshotRevision: resolved.snapshotRevision || '',
  };
}

function positive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function effectiveWeightForRow(row, config) {
  const bucket = plainObject(config?.overrides?.rigidWeight);
  const keys = [
    row?.key,
    row?.branchName && row?.nodeNumber ? `${row.branchName}::${row.nodeNumber}` : '',
    row?.nodeNumber,
  ].filter(Boolean);
  for (const key of keys) {
    const value = positive(bucket[key]);
    if (value !== null) return value;
  }
  return null;
}

function applyValidatedWeight(row, config) {
  const overrideWeight = effectiveWeightForRow(row, config);
  const sourceWeight = Number(row?.originalWeight);
  const hasSource = Number.isFinite(sourceWeight) && sourceWeight > 0;
  const weight = overrideWeight ?? (Number.isFinite(sourceWeight) ? sourceWeight : null);
  const mapped = overrideWeight !== null || hasSource;
  return {
    ...row,
    overrideWeight,
    weight,
    weightSource: overrideWeight !== null ? 'override' : (hasSource ? 'xml-weight' : 'unresolved'),
    mapped,
    status: mapped ? 'mapped' : 'unresolved',
  };
}

function progress(callback, stage, detail = {}) {
  callback?.({ stage, ...detail });
}

export async function prepareXmlCiiWeightBasis({
  xmlText,
  stagedJsonText,
  config = {},
  geometryConfig = config,
  ratingMode = 'preview',
  previewRatingSnapshot = {},
  onProgress = null,
} = {}) {
  progress(onProgress, 'loading-runtime');
  const [enrichment, geometryApi, weightModel, rigidAuthority, ratingApi] = await basisModules();

  progress(onProgress, 'preparing-geometry');
  const prepared = enrichment.prepareXmlCiiWeightMatchGeometry(
    text(xmlText),
    text(stagedJsonText),
    geometryOptions(geometryConfig),
  );
  const preparedConfig = reattachMasterRows(prepared.config || geometryConfig, config);

  progress(onProgress, 'applying-staged-geometry');
  const geometry = geometryApi.applyXmlCiiStagedGeometryAuthority(
    prepared.xmlText || text(xmlText),
    text(stagedJsonText),
    { config: preparedConfig },
  );

  progress(onProgress, 'collecting-weight-basis');
  const basisRows = weightModel.collectXmlCiiWeightMatchBasisRows(
    geometry.xmlText,
    text(stagedJsonText),
    preparedConfig,
  ).map((row) => withRatingAuthority(
    row,
    ratingMode,
    previewRatingSnapshot,
    ratingApi,
  ));

  progress(onProgress, 'validating-match1', { issueCount: basisRows.length });
  const validated = rigidAuthority.buildXmlCiiValidatedRigidWeightLegacyView(
    preparedConfig,
    basisRows,
  );
  const issues = basisRows.map((row) => applyValidatedWeight(row, validated.config));

  return {
    issues,
    match1Validation: validated.validation,
    effectiveRigidWeight: { ...plainObject(validated.config?.overrides?.rigidWeight) },
    stats: {
      issueCount: issues.length,
      geometry: { ...(geometry.stats || {}) },
      preparation: { ...(prepared.stats || {}) },
    },
  };
}
