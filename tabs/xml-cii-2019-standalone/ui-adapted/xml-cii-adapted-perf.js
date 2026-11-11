const METRIC_NAMES = Object.freeze([
  'configParseCount',
  'masterImportCount',
  'masterPersistCommitCount',
  'masterStorageWriteCount',
  'masterRowsNormalized',
  'masterMappingDraftChanges',
  'masterMappingApplyCount',
  'masterPartialDomUpdateCount',
  'masterRequestedFullRenderCount',
  'workspaceFullRenderCount',
  'workspacePartialRenderCount',
  'sourceParseCount',
  'sourceParseCacheHitCount',
  'masterArrayBufferMs',
  'masterXlsxReadMs',
  'masterSheetToJsonMs',
  'masterNormalizeMs',
  'masterPersistMs',
  'sourceParseMs',
]);

function emptyMetrics() {
  return Object.fromEntries(METRIC_NAMES.map((name) => [name, 0]));
}

let metrics = emptyMetrics();

export function xmlCiiPerfEnabled() {
  if (globalThis.__XML_CII_PERF__ === true) return true;
  try {
    return typeof location !== 'undefined' && new URLSearchParams(location.search || '').get('perf') === '1';
  } catch {
    return false;
  }
}

export function perfCount(name, delta = 1) {
  if (!xmlCiiPerfEnabled()) return;
  metrics[name] = Number(metrics[name] || 0) + Number(delta || 0);
}

export function perfAddMs(name, milliseconds) {
  if (!xmlCiiPerfEnabled()) return;
  const value = Number(milliseconds || 0);
  if (Number.isFinite(value) && value >= 0) metrics[name] = Number(metrics[name] || 0) + value;
}

export function perfNow() {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now();
  } catch {}
  return Date.now();
}

export function requestMeasuredFullRender(render) {
  perfCount('masterRequestedFullRenderCount');
  return render();
}

export function snapshotXmlCiiPerfMetrics() {
  return { ...metrics };
}

export function resetXmlCiiPerfMetrics() {
  metrics = emptyMetrics();
  return snapshotXmlCiiPerfMetrics();
}

export const XML_CII_PERF_METRICS = METRIC_NAMES;
