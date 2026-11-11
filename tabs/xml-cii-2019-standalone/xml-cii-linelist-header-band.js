const DEFAULT_BAND_ROWS = 16;

function text(value) { return String(value ?? '').trim(); }
function canon(value) {
  return text(value).replace(/º/g, '°').replace(/³/g, '3').toLowerCase()
    .replace(/[_()[\]/|]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function columnKeys(rows) {
  const seen = new Set(); const keys = [];
  for (const row of Array.isArray(rows) ? rows : []) for (const key of Object.keys(row || {})) {
    if (key === '_rowIndex' || seen.has(key)) continue;
    seen.add(key); keys.push(key);
  }
  return keys;
}
function profileColumn(key, rows, bandRows) {
  const cells = []; const safe = Array.isArray(rows) ? rows : [];
  for (let index = 0; index < Math.min(bandRows, safe.length); index += 1) {
    const raw = text(safe[index]?.[key]); if (raw) cells.push({ index, raw, value: canon(raw) });
  }
  return { key, cells, phrases: cells.map((cell) => cell.value) };
}
function hasPhrase(profile, pattern) { return profile.phrases.some((value) => pattern.test(value)); }
function firstIndex(profile, pattern) { const match = profile.cells.find((cell) => pattern.test(cell.value)); return match ? match.index : 99; }
function hasDensityUnit(profile) { return hasPhrase(profile, /\bkg\s*m3\b|\bkg\s*cm3\b|\bkgm3\b|\bkgcm3\b/); }
function scoreLabel(profile, patterns, bonus = 0) {
  let score = 0;
  for (const [pattern, points] of patterns) if (hasPhrase(profile, pattern)) {
    score = Math.max(score, points - Math.min(30, firstIndex(profile, pattern) * 3));
  }
  return score ? score + bonus : 0;
}
function numericRate(profile, predicate) {
  const values = profile.cells.map((cell) => cell.raw.replace(/,/g, '').replace(/"$/, '').trim())
    .filter((value) => /^[-+]?\d+(?:\.\d+)?$/.test(value));
  if (!values.length) return 0;
  return values.filter((value) => predicate(Number(value))).length / values.length;
}
function fieldScore(field, profile) {
  switch (field) {
    case 'lineKey1': return scoreLabel(profile, [[/^service$/i, 210], [/\bkey\s*1\b/i, 190], [/\bline\s*key\b/i, 170]]);
    case 'lineKey2': return scoreLabel(profile, [[/^line\s*(number|no\.?)$/i, 220], [/\bkey\s*2\b/i, 190]]);
    case 'lineSeqNo': return scoreLabel(profile, [[/\bline\s*(sequence|seq)(?:\s*(number|no\.?))?\b/i, 220], [/^sequence(?:\s*(number|no\.?))?$/i, 200], [/^seq(?:\s*(number|no\.?))?$/i, 195]]);
    case 'pipingClass': return scoreLabel(profile, [[/\bpiping\s*class\b/i, 230], [/\bpipe\s*class\b/i, 220], [/\bpiping\s*spec\b/i, 205], [/\bpipe\s*spec\b/i, 200]]) + Math.round(numericRate(profile, (value) => value >= 1000 && value <= 999999) * 25);
    case 'material': return scoreLabel(profile, [[/^material$/i, 220], [/\bmaterial\b/i, 170]], hasPhrase(profile, /insulation\s+material|material\s+code/) ? -180 : 0);
    case 'convertedBore': return scoreLabel(profile, [[/\bnominal\s+pipe\s+size\b/i, 230], [/\bnominal\s+bore\b/i, 215], [/^nps$/i, 210], [/^bore$/i, 190]]) + (hasPhrase(profile, /^inch(?:es)?$|^in\.?$/i) ? 30 : 0);
    case 'p1': if (hasPhrase(profile, /test\s+pressure|hydro/)) return 0; return scoreLabel(profile, [[/\bpressure\s+max\b/i, 230], [/\bdesign\s+pressure\b/i, 225], [/^p1$/i, 210]]) + (hasPhrase(profile, /design\s+conditions?/) ? 20 : 0);
    case 'hydroPressure': return scoreLabel(profile, [[/\bhydro(?:static)?\s*(test\s*)?pressure\b/i, 235], [/\btest\s+pressure\b/i, 225], [/\bpressure\s+test\b/i, 215]]);
    case 't1': return scoreLabel(profile, [[/\btemp(?:erature)?\.?\s*max\b/i, 230], [/\bdesign\s+temp(?:erature)?\b/i, 220], [/^t1$/i, 210]]);
    case 't2': if (hasPhrase(profile, /\b(max|min)\b/)) return 0; return scoreLabel(profile, [[/^temp\.?$/i, 205], [/^temperature$/i, 205], [/\boperating\s+temp(?:erature)?\b/i, 215], [/^t2$/i, 210]]);
    case 't3': return scoreLabel(profile, [[/\btemp(?:erature)?\.?\s*min\b/i, 230], [/\bminimum\s+temp(?:erature)?\b/i, 220], [/^t3$/i, 210]]);
    case 'insThk': return scoreLabel(profile, [[/\binsulation\s+thickness\b/i, 230], [/\bins(?:ulation)?\s+thk\b/i, 215]]);
    case 'phase': return scoreLabel(profile, [[/^fluid$/i, 220], [/^phase$/i, 215], [/\bfluid\s+phase\b/i, 230]]);
    case 'from': return scoreLabel(profile, [[/^from$/i, 240], [/^from\s+equipment$/i, 225], [/^origin$/i, 205]]);
    case 'to': return scoreLabel(profile, [[/^to$/i, 240], [/^to\s+equipment$/i, 225], [/^destination$/i, 205]]);
    case 'densityGas': return hasPhrase(profile, /^gas$/i) && (hasPhrase(profile, /^density$/i) || hasDensityUnit(profile)) ? 235 - Math.min(24, firstIndex(profile, /^gas$/i) * 2) : 0;
    case 'densityLiquid': return hasPhrase(profile, /^(liquid|liq)$/i) && (hasPhrase(profile, /^density$/i) || hasDensityUnit(profile)) ? 235 - Math.min(24, firstIndex(profile, /^(liquid|liq)$/i) * 2) : 0;
    case 'densityMixed': return hasPhrase(profile, /^mixed$/i) && (hasPhrase(profile, /^density$/i) || hasDensityUnit(profile)) ? 235 - Math.min(24, firstIndex(profile, /^mixed$/i) * 2) : 0;
    case 'density': if (!hasPhrase(profile, /^density$|^fluid\s+density$/i) || !hasDensityUnit(profile) || hasPhrase(profile, /^(gas|liquid|liq|mixed)$/i)) return 0; return 205;
    default: return 0;
  }
}
function bestColumn(field, profiles, claimed) {
  let best = null;
  for (const profile of profiles) {
    if (claimed.has(profile.key)) continue;
    const score = fieldScore(field, profile);
    if (score >= 180 && (!best || score > best.score)) best = { key: profile.key, score };
  }
  return best;
}
export function detectLineListHeaderBand(rows, options = {}) {
  const bandRows = Math.max(8, Math.min(24, Number(options.bandRows) || DEFAULT_BAND_ROWS));
  const profiles = columnKeys(rows).map((key) => profileColumn(key, rows, bandRows));
  const fieldMap = {}; const claimed = new Set();
  const order = ['lineKey1', 'lineKey2', 'pipingClass', 'material', 'convertedBore', 'p1', 'hydroPressure', 't1', 't2', 't3', 'insThk', 'densityGas', 'densityLiquid', 'densityMixed', 'density', 'phase', 'from', 'to', 'lineSeqNo'];
  for (const field of order) {
    const best = bestColumn(field, profiles, claimed); if (!best) continue;
    fieldMap[field] = best.key; claimed.add(best.key);
  }
  if (fieldMap.lineKey1 && fieldMap.lineKey2 && !fieldMap.lineSeqNo) fieldMap.lineSeqNo = '';
  if ((fieldMap.densityGas || fieldMap.densityLiquid || fieldMap.densityMixed) && !fieldMap.density) fieldMap.density = '';
  return { fieldMap, bandRows };
}
export function refineLineListFieldMap(rows, candidateMap = {}, config = null) {
  const result = { ...(candidateMap || {}) };
  const explicit = new Set(Object.entries(config?.customMappingAliases || {}).filter(([, value]) => !!value).map(([field]) => field));
  const band = detectLineListHeaderBand(rows);
  for (const [field, key] of Object.entries(band.fieldMap)) if (!explicit.has(field)) result[field] = key;
  return result;
}
export { DEFAULT_BAND_ROWS };
