/**
 * The GC-PW source/master InputBasis is immutable custody. Legacy original
 * Preview enrichment and source cleanup need disposable computation views.
 * The full source-bound original XML/JSON and master attestation stays active.
 * This is not a separate Preview, Weight Match, or native CII route.
 */
export function isolatedOriginalPreviewWorkConfig(config={}) {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    throw new TypeError('Original Preview work config must be a JSON object');
  if (typeof structuredClone !== 'function')
    throw new Error('Structured clone is required for source-bound Preview isolation');
  return structuredClone(config);
}
