import { perfAddMs, perfCount, perfNow } from './xml-cii-adapted-perf.js';

let cachedSourceText = null;
let cachedContext = null;

function emptyContext() {
  return Object.freeze({ sourceText: '', document: null, error: null });
}

function parseSourceDocument(sourceText) {
  const started = perfNow();
  try {
    const document = new DOMParser().parseFromString(sourceText, 'application/xml');
    perfCount('sourceParseCount');
    perfAddMs('sourceParseMs', perfNow() - started);
    return Object.freeze({ sourceText, document, error: null });
  } catch (error) {
    perfCount('sourceParseCount');
    perfAddMs('sourceParseMs', perfNow() - started);
    return Object.freeze({ sourceText, document: null, error });
  }
}

export function getSourceDocumentContext(sourceText) {
  const source = String(sourceText ?? '');
  if (!source) {
    resetSourceDocumentContextCache();
    return emptyContext();
  }
  if (cachedContext && cachedSourceText === source) {
    perfCount('sourceParseCacheHitCount');
    return cachedContext;
  }
  const next = parseSourceDocument(source);
  cachedSourceText = source;
  cachedContext = next;
  return next;
}

export function resetSourceDocumentContextCache() {
  cachedSourceText = null;
  cachedContext = null;
}
