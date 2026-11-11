const LINE_LIST_SAMPLE_ROWS = 25;

function text(value) {
  return String(value ?? '').trim();
}

function canonicalSheetName(value) {
  return text(value).toLowerCase().replace(/\s+/g, ' ');
}

function countPopulated(rows, fields) {
  let count = 0;
  for (const row of Array.isArray(rows) ? rows : []) {
    if (fields.some((field) => text(row?.[field]) !== '')) count += 1;
  }
  return count;
}

function fieldPresent(rows, fields) {
  return countPopulated(rows, fields) > 0;
}

export function scoreLineListSemanticSample(prepared = {}) {
  const rows = Array.isArray(prepared?.rows) ? prepared.rows : [];
  if (!rows.length) return { eligible: false, score: 0, sampledRows: 0, evidence: [] };

  const evidence = [];
  let score = 0;
  const lineIdentity = fieldPresent(rows, ['lineNoKey', 'lineNo', 'lineKey', 'lineSeqNo', 'lineKey1', 'lineKey2']);
  const pipingClass = fieldPresent(rows, ['pipingClass']);
  const convertedBore = fieldPresent(rows, ['convertedBore']);
  const pressure = fieldPresent(rows, ['p1']);
  const temperature = fieldPresent(rows, ['t1', 't2', 't3']);
  const material = fieldPresent(rows, ['material']);
  const rating = fieldPresent(rows, ['rating']);
  const equipment = fieldPresent(rows, ['from', 'to']);
  const density = fieldPresent(rows, ['density', 'densityMixed', 'densityGas', 'densityLiquid', 'phase']);
  const hydro = fieldPresent(rows, ['hydroPressure']);

  const add = (present, points, label) => {
    if (!present) return;
    score += points;
    evidence.push(label);
  };

  add(lineIdentity, 12, 'line-identity');
  add(pipingClass, 10, 'piping-class');
  add(convertedBore, 6, 'bore');
  add(pressure, 4, 'pressure');
  add(temperature, 4, 'temperature');
  add(material, 3, 'material');
  add(rating, 3, 'rating');
  add(equipment, 2, 'equipment');
  add(density, 2, 'density');
  add(hydro, 2, 'hydro-pressure');

  const engineeringCompanion = pipingClass || convertedBore || pressure || temperature || material || rating;
  return {
    eligible: lineIdentity && engineeringCompanion && score >= 16,
    score,
    sampledRows: rows.length,
    evidence,
  };
}

function namePriority(sheetNames) {
  const names = Array.isArray(sheetNames) ? sheetNames : [];
  const exact = names.find((name) => canonicalSheetName(name) === 'linelist');
  if (exact) return { sheetName: exact, basis: 'exact-name', score: 1000, sampledRows: 0, evidence: ['linelist'] };
  const alias = names.find((name) => ['line list', 'line-list'].includes(canonicalSheetName(name)));
  if (alias) return { sheetName: alias, basis: 'alias-name', score: 900, sampledRows: 0, evidence: [canonicalSheetName(alias)] };
  return null;
}

export function suggestWorkbookSheet({
  masterKey,
  sheetNames,
  sampleSheet,
  prepareDataset,
  currentMap = {},
  config = {},
  fieldMapOverride = null,
  sampleRows = LINE_LIST_SAMPLE_ROWS,
} = {}) {
  const names = Array.isArray(sheetNames) ? sheetNames.filter((name) => text(name)) : [];
  const firstSheet = names[0] || '';
  if (!firstSheet) return { sheetName: '', basis: 'no-sheets', score: 0, sampledRows: 0, evidence: [] };
  if (masterKey !== 'lineList') {
    return { sheetName: firstSheet, basis: 'first-sheet-non-linelist', score: 0, sampledRows: 0, evidence: [] };
  }

  const named = namePriority(names);
  if (named) return named;
  if (typeof sampleSheet !== 'function' || typeof prepareDataset !== 'function') {
    return { sheetName: firstSheet, basis: 'first-sheet-fallback', score: 0, sampledRows: 0, evidence: [] };
  }

  let best = null;
  for (let index = 0; index < names.length; index += 1) {
    const sheetName = names[index];
    try {
      const rawRows = sampleSheet(sheetName, sampleRows);
      const bounded = Array.isArray(rawRows) ? rawRows.slice(0, sampleRows) : [];
      const prepared = prepareDataset(masterKey, bounded, currentMap, config, fieldMapOverride);
      const semantic = scoreLineListSemanticSample(prepared);
      const candidate = { sheetName, basis: 'semantic-sample', workbookIndex: index, ...semantic };
      if (!candidate.eligible) continue;
      if (!best || candidate.score > best.score || (candidate.score === best.score && candidate.workbookIndex < best.workbookIndex)) {
        best = candidate;
      }
    } catch {
      // One malformed/unreadable candidate must not block deterministic fallback.
    }
  }

  if (best) {
    const { workbookIndex, eligible, ...result } = best;
    return result;
  }
  return { sheetName: firstSheet, basis: 'first-sheet-fallback', score: 0, sampledRows: 0, evidence: [] };
}

export { LINE_LIST_SAMPLE_ROWS };
