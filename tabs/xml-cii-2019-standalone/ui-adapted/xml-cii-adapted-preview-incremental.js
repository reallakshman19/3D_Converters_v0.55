let cachedPreview = null;
let stats = {
  fullBuilds: 0,
  weightOnlyBuilds: 0,
  branchRowsReused: 0,
  nodeRowsRecomputed: 0,
  materialOnlyBuilds: 0,
  branchRowsRecomputed: 0,
  nodeRowsReused: 0,
};

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableSignature(value) {
  return JSON.stringify(stableValue(value));
}

function configObject(config) {
  return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
}

export function previewNonWeightConfigSignature(config = {}) {
  const source = configObject(config);
  const nonWeight = { ...source };
  delete nonWeight.weight;
  return stableSignature(nonWeight);
}

export function previewWeightConfigSignature(config = {}) {
  return stableSignature(config?.weight && typeof config.weight === 'object' ? config.weight : {});
}

export function previewMaterialMapRowsSignature(config = {}) {
  return stableSignature(Array.isArray(config?.material?.mapRows) ? config.material.mapRows : []);
}

export function previewMaterialInvariantConfigSignature(config = {}) {
  const source = configObject(config);
  const invariant = { ...source };
  delete invariant.weight;
  if (invariant.material && typeof invariant.material === 'object' && !Array.isArray(invariant.material)) {
    invariant.material = { ...invariant.material };
    delete invariant.material.mapRows;
  }
  return stableSignature(invariant);
}

function basisOf(xmlText, stagedJsonText, config) {
  return {
    xmlText: String(xmlText ?? ''),
    stagedJsonText: String(stagedJsonText ?? ''),
    nonWeightConfigSignature: previewNonWeightConfigSignature(config),
    weightConfigSignature: previewWeightConfigSignature(config),
    materialMapRowsSignature: previewMaterialMapRowsSignature(config),
    materialInvariantConfigSignature: previewMaterialInvariantConfigSignature(config),
  };
}

function sameBranchBasis(a, b) {
  return !!a && !!b
    && a.xmlText === b.xmlText
    && a.stagedJsonText === b.stagedJsonText
    && a.nonWeightConfigSignature === b.nonWeightConfigSignature;
}

function sameMaterialBasis(a, b) {
  return !!a && !!b
    && a.xmlText === b.xmlText
    && a.stagedJsonText === b.stagedJsonText
    && a.weightConfigSignature === b.weightConfigSignature
    && a.materialInvariantConfigSignature === b.materialInvariantConfigSignature;
}

function cacheableResult(result) {
  return !!result && Array.isArray(result.branchRows) && Array.isArray(result.nodeRows);
}

function remember(basis, result) {
  cachedPreview = cacheableResult(result) ? { basis, result } : null;
  return result;
}

function emptyStats() {
  return {
    fullBuilds: 0,
    weightOnlyBuilds: 0,
    branchRowsReused: 0,
    nodeRowsRecomputed: 0,
    materialOnlyBuilds: 0,
    branchRowsRecomputed: 0,
    nodeRowsReused: 0,
  };
}

export function resetIncrementalPreviewRuntime() {
  cachedPreview = null;
  stats = emptyStats();
}

export function snapshotIncrementalPreviewRuntime() {
  const snapshot = {
    fullBuilds: stats.fullBuilds,
    weightOnlyBuilds: stats.weightOnlyBuilds,
    branchRowsReused: stats.branchRowsReused,
    nodeRowsRecomputed: stats.nodeRowsRecomputed,
  };
  if (stats.materialOnlyBuilds || stats.branchRowsRecomputed || stats.nodeRowsReused) {
    snapshot.materialOnlyBuilds = stats.materialOnlyBuilds;
    snapshot.branchRowsRecomputed = stats.branchRowsRecomputed;
    snapshot.nodeRowsReused = stats.nodeRowsReused;
  }
  return { ...snapshot, hasCachedPreview: cachedPreview !== null };
}

export function buildIncrementalPreview({
  xmlText,
  stagedJsonText,
  config = {},
  fullBuild,
  rerankWeight,
  reapplyMaterial,
} = {}) {
  if (typeof fullBuild !== 'function') throw new TypeError('fullBuild must be a function');
  const basis = basisOf(xmlText, stagedJsonText, config);
  const previous = cachedPreview;
  const weightChanged = previous?.basis?.weightConfigSignature !== basis.weightConfigSignature;
  const materialMapRowsChanged = previous?.basis?.materialMapRowsSignature !== basis.materialMapRowsSignature;

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

  if (
    previous
    && sameMaterialBasis(previous.basis, basis)
    && materialMapRowsChanged
    && typeof reapplyMaterial === 'function'
  ) {
    try {
      const result = reapplyMaterial(previous.result, config);
      if (!cacheableResult(result)) throw new Error('Material-only Preview callback returned an invalid result.');
      if (result.nodeRows !== previous.result.nodeRows) {
        throw new Error('Material-only Preview callback changed node-row identity.');
      }
      stats.materialOnlyBuilds += 1;
      stats.branchRowsRecomputed += result.branchRows.length;
      stats.nodeRowsReused += result.nodeRows.length;
      return { result: remember(basis, result), mode: 'material-only' };
    } catch {
      // Fail closed to the existing full Preview path.
    }
  }

  const result = fullBuild();
  stats.fullBuilds += 1;
  return { result: remember(basis, result), mode: 'full' };
}
