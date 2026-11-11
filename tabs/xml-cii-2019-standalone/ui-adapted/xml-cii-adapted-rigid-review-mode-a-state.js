import { withXmlCiiRigidWeightFinal } from '../../../converters/xml-cii2019-core/rigid-weight-authority.js?v=20260928-issue776-authority-2';

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseConfig(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function object(parent, key) {
  if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
  return parent[key];
}

export function modeARigidReviewIdentity(sourceId, issueKey) {
  return `${text(sourceId)}::${text(issueKey)}`;
}

export function flattenModeARigidReviewEntries(entries = []) {
  const rows = [];
  for (const entry of entries || []) {
    for (const issue of entry?.issues || []) {
      rows.push({
        ...issue,
        sourceId: entry.sourceId,
        fileName: entry.fileName,
        alias: entry.alias || '',
        reviewId: modeARigidReviewIdentity(entry.sourceId, issue.key),
      });
    }
  }
  return rows;
}

export function applyModeAConsolidatedRigidReviewUpdates(state = {}, updates = {}) {
  const batch = state.sourceBatch || {};
  const sources = (batch.sources || []).map((source) => {
    const patch = updates?.[source.sourceId];
    if (!patch) return source;
    let config = parseConfig(source.supportConfigJson || '{}');
    const overrides = object(config, 'overrides');
    const ratings = patch.ratingsByKey && typeof patch.ratingsByKey === 'object' ? patch.ratingsByKey : {};
    const weights = patch.weightsByKey && typeof patch.weightsByKey === 'object' ? patch.weightsByKey : {};
    if (Object.keys(ratings).length) {
      const bucket = object(overrides, 'rating');
      for (const [key, value] of Object.entries(ratings)) if (text(key) && text(value)) bucket[key] = text(value);
    }
    if (Object.keys(weights).length) config = withXmlCiiRigidWeightFinal(config, weights);
    return { ...source, supportConfigJson: JSON.stringify(config, null, 2) };
  });
  const active = sources.find((source) => source.sourceId === batch.activeSourceId) || null;
  return {
    ...state,
    supportConfigJson: active?.supportConfigJson || state.supportConfigJson,
    sourceBatch: { ...batch, sources },
  };
}
