import { collectXmlCiiWeightMatchBasisRows, applyXmlCiiRigidWeightOverrides } from '../../converters/xml-cii2019-core/weight-match-model.js?v=20261006-p2810042-weight-review-1';
import { buildXmlCiiValidatedRigidWeightLegacyView } from '../../converters/xml-cii2019-core/rigid-weight-authority.js';
import { readXmlCiiPreviewRatingSnapshot, resolveXmlCiiPreviewRating, resolveXmlCiiWeightMatchRating } from '../../converters/xml-cii2019-core/preview-rating-snapshot.js?v=20261001-weight-rating-1';

// Saved values are released after geometry preparation and basis validation.
// The enrichment parser only understands the legacy bucket and must never
// write a stale Match1 into XML before its provenance has been checked.
export function deferStandaloneRigidWeights(config = {}) {
  const overrides = { ...(config.overrides || {}) };
  for (const key of ['rigidWeight', 'rigidWeightMatch1', 'rigidWeightMatch1Provenance', 'rigidWeightFinal']) delete overrides[key];
  return { ...config, overrides };
}

function ratingBasis(row, config, snapshot) {
  const preview = resolveXmlCiiPreviewRating(row, snapshot);
  const rating = resolveXmlCiiWeightMatchRating(row, { config, snapshot, mode: 'preview' });
  const bore = Number(preview?.record?.sizeMm);
  return {
    ...row,
    lineKey: preview?.record?.lineKey || row.lineKey || '',
    requestedPipingClass: preview?.record?.pipingClass || row.requestedPipingClass || '',
    resolvedPipingClass: preview?.record?.pipingClass || row.resolvedPipingClass || '',
    boreMm: Number.isFinite(bore) && bore > 0 ? bore : row.boreMm,
    rating: rating.rating,
    ratingSource: rating.source,
    dtxrRating: rating.dtxrRating,
  };
}

export function prepareStandaloneRigidWeightAuthority(parity, xmlText, stagedJsonText, config, options = {}, snapshot = readXmlCiiPreviewRatingSnapshot()) {
  const geometry = parity.prepareXmlCiiWeightMatchGeometry(xmlText, stagedJsonText, {
    ...options, dryRun: true, skipAutoWeightMatch: true,
    supportConfigJson: JSON.stringify(deferStandaloneRigidWeights(config)),
  });
  const basisConfig = { ...geometry.config, ...config, overrides: { ...(config.overrides || {}) } };
  const basisRows = collectXmlCiiWeightMatchBasisRows(geometry.xmlText, stagedJsonText, basisConfig)
    .map((row) => ratingBasis(row, basisConfig, snapshot));
  const validated = buildXmlCiiValidatedRigidWeightLegacyView(basisConfig, basisRows);
  return { ...validated, basisRows, config: {
    ...validated.config,
    overrides: { ...validated.config.overrides, rigidWeightMatch1: validated.validation.validWeights },
  } };
}

export function applyStandaloneAcceptedRigidWeights(xmlText, authority) {
  const weights = authority.config.overrides?.rigidWeight || {};
  const result = applyXmlCiiRigidWeightOverrides(xmlText, weights);
  const written = new Set(result.appliedRows.map((row) => row.key));
  const missing = authority.basisRows.filter((row) => Number(weights[row.key]) > 0
    && !written.has(row.key));
  if (missing.length) throw new Error(`Accepted weight has no output node after geometry preparation: ${missing.map((row) => row.key).join(', ')}. Review the component geometry before exporting.`);
  const expectedEntries = result.appliedRows.map((row) => ({
    scope: 'node', branchName: row.branchName, nodeNumber: row.nodeNumber, nodeKey: row.key,
    path: ['Weight'], field: 'weight', expected: String(row.weight), kind: 'number', source: 'accepted-weight',
  }));
  return { ...result, expectedEntries };
}
