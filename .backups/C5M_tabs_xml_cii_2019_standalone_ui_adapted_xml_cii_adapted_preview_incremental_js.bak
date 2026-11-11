let cachedPreview = null;
let stats = { fullBuilds: 0, weightOnlyBuilds: 0, branchRowsReused: 0, nodeRowsRecomputed: 0 };

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableSignature(value) {
  return JSON.stringify(stableValue(value));
}

export function previewNonWeightConfigSignature(config = {}) {
  const source = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  const nonWeight = { ...source };
  delete nonWeight.weight;
  return stableSignature(nonWeight);
}

export function previewWeightConfigSignature(config = {}) {
  return stableSignature(config?.weight && typeof config.weight === 'object' ? config.weight : {});
}

function basisOf(xmlText, stagedJsonText, config) {
  return {
    xmlText: String(xmlText ?? ''),
    stagedJsonText: String(stagedJsonText ?? ''),
    nonWeightConfigSignature: previewNonWeightConfigSignature(config),
    weightConfigSignature: previewWeightConfigSignature(config),
  };
}

function sameBranchBasis(a, b) {
  return !!a && !!b
    && a.xmlText === b.xmlText
    && a.stagedJsonText === b.stagedJsonText
    && a.nonWeightConfigSignature === b.nonWeightConfigSignature;
}

function cacheableResult(result) {
  return !!result && Array.isArray(result.branchRows) && Array.isArray(result.nodeRows);
}

function remember(basis, result) {
  cachedPreview = cacheableResult(result) ? { basis, result } : null;
  return result;
}

export function resetIncrementalPreviewRuntime() {
  cachedPreview = null;
  stats = { fullBuilds: 0, weightOnlyBuilds: 0, branchRowsReused: 0, nodeRowsRecomputed: 0 };
}

export function snapshotIncrementalPreviewRuntime() {
  return { ...stats, hasCachedPreview: cachedPreview !== null };
}

export function buildIncrementalPreview({
  xmlText,
  stagedJsonText,
  config = {},
  fullBuild,
  rerankWeight,
} = {}) {
  if (typeof fullBuild !== 'function') throw new TypeError('fullBuild must be a function');
  const basis = basisOf(xmlText, stagedJsonText, config);
  const previous = cachedPreview;
  const weightChanged = previous?.basis?.weightConfigSignature !== basis.weightConfigSignature;

  if (previous && sameBranchBasis(previous.basis, basis) && weightChanged && typeof rerankWeight === 'function') {
    try {
      const nodeRows = rerankWeight(previous.result.nodeRows, previous.result.branchRows, config);
      const result = { ...previous.result, branchRows: previous.result.branchRows, nodeRows };
      stats.weightOnlyBuilds += 1;
      stats.branchRowsReused += previous.result.branchRows.length;
      stats.nodeRowsRecomputed += Array.isArray(nodeRows) ? nodeRows.length : 0;
      return { result: remember(basis, result), mode: 'weight-only' };
    } catch {
      // Fail closed to the existing full Preview path.
    }
  }

  const result = fullBuild();
  stats.fullBuilds += 1;
  return { result: remember(basis, result), mode: 'full' };
}
