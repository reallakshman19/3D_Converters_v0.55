import {
  readXmlCiiExplicitBoreMm,
  resolveXmlCiiBoreMmFromNps,
} from '../../../converters/xml-cii2019-core/nps-bore-resolver.js';

function text(value) { return String(value ?? '').trim(); }
function normalized(value) { return text(value).replace(/³/g, '3').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function tokens(value) { return text(value).toUpperCase().split(/[^A-Z0-9]+/).map((token) => token.trim()).filter(Boolean); }
function isSyntheticHeader(header) { return /^__EMPTY(?:_|$)/i.test(text(header)); }

function headerScore(header, aliases) {
  const headerText = text(header);
  const normalizedHeader = normalized(headerText);
  if (!normalizedHeader) return 0;
  let best = 0;
  for (let index = 0; index < (aliases || []).length; index += 1) {
    const aliasText = text(aliases[index]);
    const normalizedAlias = normalized(aliasText);
    if (!normalizedAlias) continue;
    if (normalizedHeader === normalizedAlias) best = Math.max(best, index === 0 ? 120 : 100);
    else if (normalizedHeader.startsWith(normalizedAlias) || normalizedAlias.startsWith(normalizedHeader)) best = Math.max(best, 78);
    else if (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader)) best = Math.max(best, 68);
    const aliasTokens = tokens(aliasText);
    const headerTokens = tokens(headerText);
    const matches = aliasTokens.filter((token) => headerTokens.includes(token)).length;
    if (aliasTokens.length && matches) best = Math.max(best, Math.round((matches / aliasTokens.length) * 62));
  }
  return best;
}

const LABEL_RULES = Object.freeze({
  lineSeqNo: { aliases: ['line number', 'line no', 'line no.', 'seq', 'sequence', 'lineno'] },
  lineKey1: { aliases: ['service', 'line key', 'key 1', 'key1', 'area'] },
  lineKey2: { aliases: ['line number', 'line no', 'key 2', 'key2'] },
  pipingClass: { aliases: ['piping class', 'piping_class', 'class', 'spec', 'pipe class'] },
  rating: { aliases: ['rating', 'pressure class', 'class rating', 'pressure rating', 'press rating', 'class/rating', 'rating/class'] },
  material: { aliases: ['material', 'material_name', 'material name'] },
  nps: { aliases: ['nps', 'nps in', 'nominal pipe size', 'size nps', 'nominal size'] },
  convertedBore: { aliases: ['bore mm', 'converted bore', 'dn', 'nb', 'nominal bore'] },
  p1: { aliases: ['p1', 'design pr', 'design pressure', 'operating pressure', 'design cond', 'p1 / design pressure', 'pressure max'] },
  t1: { aliases: ['t1', 'design temp', 'design temperature', 'operating temp', 't1 (c)', 't1 (ºc)', 'temp max', 'temp max c', 'temp max ºc'] },
  t2: { aliases: ['t2', 'temp', 'temperature', 't2 (c)', 't2 (ºc)', 'temp. c', 'temp. ºc'] },
  t3: { aliases: ['t3', 'temp min', 'minimum temp', 'min temp', 'temperature min', 'min', 't3 (c)', 't3 (ºc)', 'temp min c', 'temp min ºc'] },
  insThk: { aliases: ['insulation', 'ins thk', 'insthk', 'insulation thickness'] },
  phase: { aliases: ['phase', 'fluid phase', 'medium phase', 'fluid'] },
  hydroPressure: { aliases: ['hydropressure', 'hydro test pressure', 'hydrotest pressure', 'hydro pressure', 'test pressure', 'hydro/test pressure'] },
  from: { aliases: ['from', 'from origin', 'origin', 'from equipment'], exactOnly: true },
  to: { aliases: ['to', 'to destination', 'destination', 'to equipment'], exactOnly: true },
});

function canonicalWords(value) {
  return text(value).replace(/³/g, '3').toLowerCase().replace(/[_()[\]/|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function semanticProfile(header, rawRows) {
  const cells = [];
  for (let index = 0; index < Math.min(4, rawRows.length); index += 1) {
    const value = text(rawRows[index]?.[header]);
    if (value && value.length <= 80) cells.push({ index, value, words: canonicalWords(value) });
  }
  const wordSet = new Set(cells.flatMap((cell) => cell.words.split(/[^a-z0-9]+/).filter(Boolean)));
  const hasDensityWord = wordSet.has('density');
  const hasDensityUnit = cells.some((cell) => /KGM3|KGCM3/.test(normalized(cell.value)));
  return { cells, wordSet, hasDensityWord, hasDensityUnit };
}

function densityHintScore(fieldName, profile) {
  const qualifierByField = { densityGas: 'gas', densityLiquid: 'liquid', densityMixed: 'mixed' };
  const qualifiers = new Set(['gas', 'liquid', 'liq', 'mixed']);
  if (fieldName === 'density') {
    if (!profile.hasDensityWord) return 0;
    if ([...qualifiers].some((token) => profile.wordSet.has(token))) return 0;
    const row = profile.cells.find((cell) => cell.words === 'density' || cell.words === 'fluid density');
    return row ? (row.index === 0 ? 150 : 130) : 110;
  }
  const qualifier = qualifierByField[fieldName];
  if (!qualifier) return 0;
  const present = qualifier === 'liquid'
    ? profile.wordSet.has('liquid') || profile.wordSet.has('liq')
    : profile.wordSet.has(qualifier);
  if (!present || (!profile.hasDensityWord && !profile.hasDensityUnit)) return 0;
  const row = profile.cells.find((cell) => cell.words.includes(qualifier) || (qualifier === 'liquid' && cell.words.includes('liq')));
  return row ? (row.index === 0 ? 165 : 150) : 140;
}

function labelRuleScore(fieldName, profile) {
  if (fieldName === 'density' || fieldName === 'densityGas' || fieldName === 'densityLiquid' || fieldName === 'densityMixed') {
    return densityHintScore(fieldName, profile);
  }
  const rule = LABEL_RULES[fieldName];
  if (!rule) return 0;
  let best = 0;
  for (const cell of profile.cells) {
    for (const alias of rule.aliases) {
      const expected = canonicalWords(alias);
      const exact = cell.words === expected;
      if (rule.exactOnly && !exact) continue;
      if (!exact && !cell.words.includes(expected) && !expected.includes(cell.words)) continue;
      const position = cell.index === 0 ? 110 : cell.index === 1 ? 90 : 75;
      best = Math.max(best, position + (exact ? 30 : Math.min(expected.length, 30)));
    }
  }
  return best;
}

function labelHints(header, rawRows) {
  if (!isSyntheticHeader(header)) return {};
  const profile = semanticProfile(header, rawRows);
  const scores = {};
  for (const fieldName of [...Object.keys(LABEL_RULES), 'density', 'densityGas', 'densityLiquid', 'densityMixed']) {
    const score = labelRuleScore(fieldName, profile);
    if (score) scores[fieldName] = score;
  }
  return scores;
}

function sampledValues(header, rawRows) {
  const values = [];
  for (const row of rawRows) {
    if (values.length >= 8) break;
    const value = text(row?.[header]);
    if (value && value !== header) values.push(value);
  }
  return values;
}

function dataValueScore(header, fieldName, rawRows) {
  if (!isSyntheticHeader(header)) return 0;
  const values = sampledValues(header, rawRows);
  if (!values.length) return 0;
  const inRange = (value, low, high) => {
    const numeric = Number(String(value).replace(/"$/, ''));
    return Number.isFinite(numeric) && numeric >= low && numeric <= high;
  };
  const pass = (test) => values.filter(test).length / values.length;
  switch (fieldName) {
    case 'lineSeqNo': return Math.round(pass((value) => /^\d[A-Z0-9]{3,11}$/i.test(value)) * 70);
    case 'lineKey1': return Math.round(pass((value) => /^[A-Z]{1,6}$/.test(value)) * 72);
    case 'lineKey2': return Math.round(pass((value) => /^\d{5,10}$/.test(value)) * 72);
    case 'pipingClass': return Math.round(pass((value) => /^[A-Z0-9]{1,4}[/-]?[A-Z0-9]{0,6}$/i.test(value) && value.length >= 2 && value.length <= 10 && Number.isNaN(Number(value))) * 68);
    case 'material': return Math.round(pass((value) => /^[A-Z]{1,4}[A-Z0-9]{0,8}$/i.test(value) && Number.isNaN(Number(value)) && value.length >= 2) * 65);
    case 'nps': return Math.round(pass((value) => inRange(value, 0.25, 80)) * 68);
    case 'convertedBore': return Math.round(pass((value) => inRange(value, 6, 2000)) * 65);
    case 'p1': return Math.round(pass((value) => inRange(value, 0, 100000)) * 62);
    case 't1':
    case 't2':
    case 't3': return Math.round(pass((value) => inRange(value, -200, 800)) * 62);
    case 'insThk': return Math.round(pass((value) => inRange(value, 0, 500)) * 60);
    case 'densityMixed':
    case 'densityGas':
    case 'densityLiquid': return Math.round(pass((value) => inRange(value, 0.01, 2000)) * 60);
    case 'phase': {
      const phases = new Set(['g', 'l', 'm', 'gas', 'liquid', 'mixed', '2p', 'liq', 'vap', 'vapour', 'vapor', 'hc']);
      const rate = pass((value) => phases.has(value.toLowerCase()));
      return rate >= 0.8 ? Math.round(rate * 75) : 0;
    }
    case 'rating': {
      const known = new Set(['150', '300', '600', '900', '1500', '2500']);
      return Math.round(pass((value) => known.has(value.replace(/cl|pn|#/gi, '').trim()) || /^(cl|pn)?\s*(\d{2,4})$/i.test(value)) * 62);
    }
    default: return 0;
  }
}

function preparePipingClassBoreColumns(headers, fields, rawRows) {
  const working = [...(headers || [])];
  const isPipingClass = fields.some((field) => field.name === 'nps') && fields.some((field) => field.name === 'convertedBore');
  if (!isPipingClass || !rawRows.length) return working;
  const npsField = fields.find((field) => field.name === 'nps');
  const best = working.map((header) => ({ header, score: headerScore(header, npsField?.aliases || []) })).sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 60) return working;
  for (const row of rawRows) {
    const rawNps = text(row?.[best.header]);
    if (rawNps && !text(row['NPS (in)'])) row['NPS (in)'] = rawNps;
    const derived = readXmlCiiExplicitBoreMm(row) ?? resolveXmlCiiBoreMmFromNps(rawNps);
    if (derived != null) row['Bore (mm)'] = derived;
  }
  if (!working.includes('NPS (in)')) working.push('NPS (in)');
  if (!working.includes('Bore (mm)')) working.push('Bore (mm)');
  return working;
}

function claimBest(field, headers, claimed, scoreOf) {
  let bestHeader = '';
  let bestScore = 0;
  for (const header of headers) {
    const shareLineNumber = field.name === 'lineKey2' && claimed.get(header) === 'lineSeqNo';
    if (claimed.has(header) && !shareLineNumber) continue;
    const score = scoreOf(header, field);
    if (score > bestScore) { bestHeader = header; bestScore = score; }
  }
  if (bestHeader && bestScore >= 60) {
    claimed.set(bestHeader, field.name);
    return bestHeader;
  }
  return '';
}

export function fuzzyAutoMapFields(headers, fields, rawRows) {
  const safeRows = Array.isArray(rawRows) ? rawRows : [];
  const working = preparePipingClassBoreColumns(headers, fields, safeRows);
  const mapped = {};
  const claimed = new Map();
  const hints = Object.fromEntries(working.map((header) => [header, labelHints(header, safeRows)]));

  for (const field of fields) {
    mapped[field.name] = claimBest(field, working, claimed, (header) => hints[header]?.[field.name] || 0);
  }
  for (const field of fields) {
    if (mapped[field.name]) continue;
    mapped[field.name] = claimBest(field, working, claimed, (header) => isSyntheticHeader(header) ? 0 : headerScore(header, field.aliases));
  }
  for (const field of fields) {
    if (mapped[field.name]) continue;
    mapped[field.name] = claimBest(field, working, claimed, (header) => dataValueScore(header, field.name, safeRows));
  }
  return mapped;
}
