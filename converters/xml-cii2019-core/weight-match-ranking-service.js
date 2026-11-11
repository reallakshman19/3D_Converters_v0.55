import { applyXmlCiiFlangeWeightFallbackToIssue } from './flange-weight-fallback.js';
import { resolveXmlCiiWeightMatchRating } from './preview-rating-snapshot.js?v=20261001-weight-rating-1';
import { formatValveHint, rankXmlCiiWeightCandidates } from './weight-valve-hints.js';

function clean(value) { return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim(); }
function emptyRanking() { return { nodeHint: null, semanticSource: null, candidates: [], rejectedCandidates: [] }; }

export function rankXmlCiiWeightIssue(row, config, options = {}) {
  const ratingMode = options.ratingMode || 'preview';
  const snapshot = options.snapshot || {};
  const authority = resolveXmlCiiWeightMatchRating(row, { mode: ratingMode, snapshot, config });
  const rating = authority.rating;
  const ranking = rating
    ? rankXmlCiiWeightCandidates({
        boreMm: row?.boreMm,
        rating,
        lengthMm: row?.lengthMm,
        nodeName: row?.nodeName,
        componentType: row?.componentType,
        componentRefNo: row?.componentRefNo,
        dtxr: row?.dtxr,
      }, config, { includeRejected: true })
    : emptyRanking();
  const derivedValveHint = formatValveHint(ranking.nodeHint) || (() => {
    const best = ranking.candidates?.[0];
    if (best?.specialFactorRule && best?.specialFactorCode) return (best.typeDesc || '').split(':')[0].trim() || best.specialFactorCode;
    const semantic = ranking.semanticSource;
    return semantic?.matches?.[0] ? `${semantic.matches[0].label} (keyword)` : '';
  })();
  const ranked = {
    ...row,
    rating,
    ratingSource: authority.source,
    ratingMode: authority.mode,
    previewRatingSnapshotRevision: authority.snapshotRevision,
    dtxrRating: authority.dtxrRating,
    valveHint: derivedValveHint,
    nodeHint: ranking.nodeHint,
    candidates: (ranking.candidates || []).slice(0, 5),
    rejectedCandidates: (ranking.rejectedCandidates || []).slice(0, 3),
    ranking,
  };
  return applyXmlCiiFlangeWeightFallbackToIssue(ranked, config);
}

export function rankXmlCiiWeightIssues(rows, config, options = {}) {
  return (Array.isArray(rows) ? rows : []).map((row) => rankXmlCiiWeightIssue(row, config, options));
}
