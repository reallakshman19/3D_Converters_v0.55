/**
 * XML229 source-attested, fail-closed candidate-family compatibility.
 * Ranking is intentionally separate: geometry cannot authorize a semantic mismatch.
 * This module has no ledger, Worker, DOM or native CII dependencies.
 */
const token = value => String(value ?? '').toUpperCase()
  .replace(/[_/\\]+/g, ' ').replace(/[^A-Z0-9 -]+/g, ' ').replace(/\s+/g, ' ').trim();
const NODE_TYPES = Object.freeze({
  VGT: 'GATE', VCH: 'CHECK', VBL: 'BALL', VBV: 'BALL',
  VCV: 'CONTROL', VGL: 'GLOBE', VBF: 'BUTTERFLY',
});
const nodeCode = value => token(value)
  .match(/(?:^|[ -])(VGT|VCH|VBL|VBV|VCV|VGL|VBF)(?=$|[ -]|\d)/)?.[1] ?? null;
const VALVE_WORDS = [
  [/\bGATE\b/, 'GATE'], [/\b(CHECK|SWING|NON RETURN|NRV)\b/, 'CHECK'],
  [/\bBALL\b/, 'BALL'], [/\bGLOBE\b/, 'GLOBE'],
  [/\bBUTTERFLY\b/, 'BUTTERFLY'], [/\bCONTROL\b/, 'CONTROL'],
];
const UNKNOWN = Object.freeze({ family: 'UNKNOWN', subtype: 'UNKNOWN' });

function semanticType(value) {
  const input = token(value);
  if (!input) return null;
  const matched = [...new Set(VALVE_WORDS.filter(([rx]) => rx.test(input)).map(([, subtype]) => subtype))];
  if (matched.length > 1) return { ...UNKNOWN, ambiguous: true };
  // "Flanged Gate Valve" describes a valve with flanged ends, not a flange.
  if (matched.length === 1) return { family: 'VALVE', subtype: matched[0] };
  if (/\b(VALVE|VLV)\b/.test(input)) return { family: 'VALVE', subtype: 'UNSPECIFIED' };
  if (/\b(FLANGE|WELDNECK|WELD NECK|WNFL)\b/.test(input))
    return { family: 'FLANGE', subtype: 'UNSPECIFIED' };
  return null;
}
function componentFamily(value) {
  const name = token(value);
  if (name === 'FLAN' || name === 'FLANGE') return { family: 'FLANGE', subtype: 'UNSPECIFIED' };
  if (name === 'VALV' || name === 'VALVE') return { family: 'VALVE', subtype: 'UNSPECIFIED' };
  // RIGID alone identifies geometry, not a valve or flange.
  return null;
}
const evidence = (origin, result, raw) => ({
  origin, family: result.family, subtype: result.subtype, raw: String(raw ?? ''),
});
function reconcile(hints) {
  const families = new Set(hints.map(item => item.family));
  const subtypes = new Set(hints.filter(item => item.family === 'VALVE' &&
    item.subtype !== 'UNSPECIFIED').map(item => item.subtype));
  const conflict = hints.some(item => item.family === 'UNKNOWN') ||
    families.size > 1 || subtypes.size > 1;
  if (conflict) return { status: 'CONFLICT', ...UNKNOWN, evidence: hints };
  if (!hints.length) return { status: 'UNKNOWN', ...UNKNOWN, evidence: [] };
  const family = hints[0].family;
  return {
    status: 'KNOWN', family,
    subtype: family === 'VALVE' ? [...subtypes][0] || 'UNSPECIFIED' : 'UNSPECIFIED',
    evidence: hints,
  };
}
export function classifySourceFamily(source = {}) {
  const hints = [];
  const code = nodeCode(source?.nodeName);
  if (code) hints.push(evidence('nodeName',
    { family: 'VALVE', subtype: NODE_TYPES[code] }, source.nodeName));
  const declared = componentFamily(source?.componentType);
  if (declared) hints.push(evidence('componentType', declared, source.componentType));
  const dtxr = semanticType(source?.dtxr);
  if (dtxr) hints.push(evidence('dtxr', dtxr, source.dtxr));
  // A RIGID with no typed source anchor cannot gain automatic family authority
  // merely from a derived DTXR string; its custody must be explicitly attested.
  if (hints.length === 1 && hints[0].origin === 'dtxr' &&
      source?.dtxrFamilyAttested !== true)
    return { status: 'UNKNOWN', ...UNKNOWN, evidence: hints };
  return reconcile(hints);
}
export function classifyMasterFamily(candidate = {}) {
  const hints = [];
  for (const field of ['type', 'typeDesc', 'valveType']) {
    const classification = semanticType(candidate?.[field]);
    if (classification) hints.push(evidence('master.' + field, classification, candidate[field]));
  }
  return reconcile(hints);
}
function directMasterCandidate(candidate) {
  const value = Number(candidate?.selectedWeight ?? candidate?.suggestedWeight ?? candidate?.weight);
  return candidate?.preferred === true &&
    candidate.lengthQualified !== false && candidate.ratingExact !== false &&
    !candidate.inferredWeight && !candidate.specialFactorRule &&
    !candidate.flangeWeightFallback && !candidate.fallbackSuggestion &&
    !candidate.zeroFallback && !candidate.oddEntry &&
    Number.isFinite(value) && value > 0 &&
    !/interpolat|extrapolat|factor|fallback|inferred/i.test(String(candidate.weightMethod || ''));
}
/** Never infer source family from a master proposal, rank or numerical score. */
export function evaluateCandidateEligibility(source, candidate) {
  const from = classifySourceFamily(source);
  const master = classifyMasterFamily(candidate);
  const reasons = [];
  if (from.status !== 'KNOWN')
    reasons.push(from.status === 'CONFLICT' ? 'SOURCE_FAMILY_CONFLICT' : 'SOURCE_FAMILY_UNKNOWN');
  if (master.status !== 'KNOWN')
    reasons.push(master.status === 'CONFLICT' ? 'MASTER_FAMILY_CONFLICT' : 'MASTER_FAMILY_UNKNOWN');
  if (from.status === 'KNOWN' && master.status === 'KNOWN') {
    if (from.family !== master.family) reasons.push('FAMILY_MISMATCH');
    if (from.family === 'VALVE' && master.family === 'VALVE' &&
      (from.subtype === 'UNSPECIFIED' || master.subtype === 'UNSPECIFIED' ||
       from.subtype !== master.subtype)) reasons.push('VALVE_SUBTYPE_UNVERIFIED');
  }
  if (!directMasterCandidate(candidate)) reasons.push('DIRECT_MASTER_GEOMETRY_OR_MASS_NOT_QUALIFIED');
  return { qualified: reasons.length === 0, reasons, source: from, master };
}
