export const HP_PIPING_CLASS_RESULT_EXPORT_VERSION = 'hp-piping-class-result-export/v1';

const CSV_COLUMNS = Object.freeze([
  ['schemaVersion', 'string'],
  ['projectId', 'string'], ['classId', 'string'], ['revision', 'string'],
  ['projectState', 'string'], ['rowType', 'string'], ['reviewPriority', 'string'],
  ['productId', 'string'], ['basisMode', 'string'], ['engineeringState', 'string'],
  ['calculationOk', 'boolean'], ['staticPass', 'boolean'], ['fatigueEvaluated', 'boolean'],
  ['fatigueUsageWithinUnity', 'boolean'],
  ['pressureDesignThicknessMm', 'number'], ['requiredMinimumThicknessMm', 'number'],
  ['requiredNominalThicknessMm', 'number'], ['minimumAsManufacturedThicknessMm', 'number'],
  ['effectiveNetWallMm', 'number'], ['pressureRatingMpa', 'number'],
  ['pressureRatingMargin', 'number'], ['minimumWallMarginMm', 'number'],
  ['nominalWallMm', 'number'], ['minimumAsManufacturedWallMm', 'number'],
  ['beginOfLifeConservativeWallMm', 'number'], ['reservedServiceLossMm', 'number'],
  ['endOfLifeEffectiveWallMm', 'number'], ['measuredCurrentWallMm', 'number'],
  ['futureServiceLossMm', 'number'], ['projectedEndOfLifeWallMm', 'number'],
  ['selectedFatigueWallBasis', 'string'], ['selectedFatigueWallMm', 'number'],
  ['cumulativeUsage', 'number'], ['usageLimit', 'number'], ['evidenceIssueCount', 'integer'],
  ['independentCheckComplete', 'boolean'], ['referenceStatus', 'string'],
  ['governingCycleId', 'string'], ['maximumCycleUsage', 'number'],
  ['cycleId', 'string'], ['locationId', 'string'], ['fromStateId', 'string'], ['toStateId', 'string'],
  ['appliedCycles', 'number'], ['pressureRangeMpa', 'number'], ['coreSaltMpa', 'number'],
  ['userSaltMpa', 'number'], ['saltCrossCheckStatus', 'string'], ['saltRelativeDifference', 'number'],
  ['equivalentAlternatingStressMpa', 'number'], ['permissibleCycles', 'number'],
  ['zeroDamage', 'boolean'], ['cycleUsage', 'number'], ['cycleEvidenceStatus', 'string'],
]);

export const HP_PIPING_CLASS_RESULT_CSV_HEADERS = Object.freeze(CSV_COLUMNS.map(([key]) => key));

function finiteOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function boolOrNull(value) {
  return typeof value === 'boolean' ? value : null;
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function reviewPriority(row) {
  if (row.calculationOk !== true) return 'BLOCKED';
  if (row.staticPass === false) return 'STATIC_FAIL';
  if (row.fatigueEvaluated && row.fatigueUsageWithinUnity === false) return 'FATIGUE_EXCEEDS_UNITY';
  if (row.fatigueEvaluated) return 'FATIGUE_EVALUATED';
  return 'STATIC_ONLY';
}

const PRIORITY_RANK = Object.freeze({
  BLOCKED: 0,
  STATIC_FAIL: 1,
  FATIGUE_EXCEEDS_UNITY: 2,
  FATIGUE_EVALUATED: 3,
  STATIC_ONLY: 4,
});

function governingCycle(cycles) {
  const candidates = (cycles ?? [])
    .filter((cycle) => Number.isFinite(cycle?.usage))
    .sort((a, b) => Number(b.usage) - Number(a.usage) || String(a.cycleId ?? '').localeCompare(String(b.cycleId ?? '')));
  return candidates[0] ?? null;
}

function productRow(product) {
  const staticOut = product?.calculations?.static?.outputs ?? {};
  const wallOut = product?.calculations?.wallState?.outputs ?? {};
  const fatigueOut = product?.calculations?.fatigue?.outputs ?? {};
  const cycles = fatigueOut.cycles ?? [];
  const governing = governingCycle(cycles);
  const row = {
    productId: textOrNull(product?.productId),
    basisMode: textOrNull(product?.basisMode),
    engineeringState: textOrNull(product?.engineeringState),
    calculationOk: product?.calculationOk === true,
    staticPass: boolOrNull(product?.assessment?.staticPass),
    fatigueEvaluated: product?.assessment?.fatigueEvaluated === true,
    fatigueUsageWithinUnity: boolOrNull(product?.assessment?.fatigueUsageWithinUnity),
    pressureDesignThicknessMm: finiteOrNull(staticOut.pressureDesignThicknessMm),
    requiredMinimumThicknessMm: finiteOrNull(staticOut.requiredMinimumThicknessMm),
    requiredNominalThicknessMm: finiteOrNull(staticOut.requiredNominalThicknessMm),
    minimumAsManufacturedThicknessMm: finiteOrNull(staticOut.minimumAsManufacturedThicknessMm),
    effectiveNetWallMm: finiteOrNull(staticOut.effectiveNetWallMm),
    pressureRatingMpa: finiteOrNull(staticOut.pressureRatingMpa),
    pressureRatingMargin: finiteOrNull(staticOut.pressureRatingMargin),
    minimumWallMarginMm: finiteOrNull(staticOut.minimumWallMarginMm),
    nominalWallMm: finiteOrNull(wallOut.nominalWallMm),
    minimumAsManufacturedWallMm: finiteOrNull(wallOut.minimumAsManufacturedWallMm),
    beginOfLifeConservativeWallMm: finiteOrNull(wallOut.beginOfLifeConservativeWallMm),
    reservedServiceLossMm: finiteOrNull(wallOut.reservedServiceLossMm),
    endOfLifeEffectiveWallMm: finiteOrNull(wallOut.endOfLifeEffectiveWallMm),
    measuredCurrentWallMm: finiteOrNull(wallOut.measuredCurrentWallMm),
    futureServiceLossMm: finiteOrNull(wallOut.futureServiceLossMm),
    projectedEndOfLifeWallMm: finiteOrNull(wallOut.projectedEndOfLifeWallMm),
    selectedFatigueWallBasis: textOrNull(product?.selectedFatigueWallBasis),
    selectedFatigueWallMm: finiteOrNull(product?.selectedFatigueWallMm),
    cumulativeUsage: finiteOrNull(product?.assessment?.cumulativeUsage),
    usageLimit: finiteOrNull(fatigueOut.usageLimit),
    evidenceIssueCount: Number.isInteger(fatigueOut.evidenceIssueCount) ? fatigueOut.evidenceIssueCount : null,
    independentCheckComplete: boolOrNull(fatigueOut.independentCheckComplete),
    referenceStatus: textOrNull(fatigueOut.referenceStatus),
    governingCycleId: textOrNull(governing?.cycleId),
    maximumCycleUsage: finiteOrNull(governing?.usage),
  };
  return Object.freeze({ ...row, reviewPriority: reviewPriority(row) });
}

function cycleRow(productId, cycle) {
  return Object.freeze({
    productId: textOrNull(productId),
    cycleId: textOrNull(cycle?.cycleId),
    locationId: textOrNull(cycle?.locationId),
    fromStateId: textOrNull(cycle?.fromStateId),
    toStateId: textOrNull(cycle?.toStateId),
    appliedCycles: finiteOrNull(cycle?.appliedCycles),
    pressureRangeMpa: finiteOrNull(cycle?.pressureRangeMpa),
    coreSaltMpa: finiteOrNull(cycle?.coreSaltMpa),
    userSaltMpa: finiteOrNull(cycle?.userSaltMpa),
    saltCrossCheckStatus: textOrNull(cycle?.saltCrossCheckStatus),
    saltRelativeDifference: finiteOrNull(cycle?.saltRelativeDifference),
    equivalentAlternatingStressMpa: finiteOrNull(cycle?.equivalentAlternatingStressMpa),
    permissibleCycles: finiteOrNull(cycle?.permissibleCycles),
    zeroDamage: boolOrNull(cycle?.zeroDamage),
    cycleUsage: finiteOrNull(cycle?.usage),
    cycleEvidenceStatus: textOrNull(cycle?.evidence?.status),
  });
}

function frozenRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze({ ...row })));
}

export function buildHpPipingClassResultExport(result = {}) {
  if (!result?.ok) throw new TypeError('A completed HP Piping Class review result is required for export.');
  const products = (result.products ?? []).map(productRow);
  const cycles = [];
  for (const product of result.products ?? []) {
    for (const cycle of product?.calculations?.fatigue?.outputs?.cycles ?? []) {
      cycles.push(cycleRow(product.productId, cycle));
    }
  }
  return Object.freeze({
    schemaVersion: HP_PIPING_CLASS_RESULT_EXPORT_VERSION,
    projectIdentity: Object.freeze({
      projectId: textOrNull(result?.projectIdentity?.projectId),
      classId: textOrNull(result?.projectIdentity?.classId),
      revision: textOrNull(result?.projectIdentity?.revision),
    }),
    projectState: textOrNull(result.projectState),
    orchestratorVersion: textOrNull(result.orchestratorVersion),
    projectVersion: textOrNull(result.projectVersion),
    authority: Object.freeze(clone(result.authority ?? {})),
    summary: Object.freeze(clone(result.summary ?? {})),
    productRows: frozenRows(products),
    cycleRows: frozenRows(cycles),
  });
}

function numericDescending(a, b, key) {
  const av = Number.isFinite(a[key]) ? a[key] : -Infinity;
  const bv = Number.isFinite(b[key]) ? b[key] : -Infinity;
  return bv - av;
}

function numericAscending(a, b, key) {
  const av = Number.isFinite(a[key]) ? a[key] : Infinity;
  const bv = Number.isFinite(b[key]) ? b[key] : Infinity;
  return av - bv;
}

export function sortHpPipingClassResultRows(rows = [], sortBy = 'reviewPriority') {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sortBy === 'productId') return String(a.productId ?? '').localeCompare(String(b.productId ?? ''));
    if (sortBy === 'cumulativeUsage') {
      return numericDescending(a, b, 'cumulativeUsage') || String(a.productId ?? '').localeCompare(String(b.productId ?? ''));
    }
    if (sortBy === 'pressureRatingMargin') {
      return numericAscending(a, b, 'pressureRatingMargin') || String(a.productId ?? '').localeCompare(String(b.productId ?? ''));
    }
    return (PRIORITY_RANK[a.reviewPriority] ?? 99) - (PRIORITY_RANK[b.reviewPriority] ?? 99)
      || numericDescending(a, b, 'cumulativeUsage')
      || numericAscending(a, b, 'pressureRatingMargin')
      || String(a.productId ?? '').localeCompare(String(b.productId ?? ''));
  });
  return Object.freeze(copy);
}

export function filterHpPipingClassResultRows(rows = [], filter = 'all') {
  const normalized = String(filter ?? 'all');
  const filtered = rows.filter((row) => {
    if (normalized === 'all') return true;
    if (normalized === 'needsAttention') return ['BLOCKED', 'STATIC_FAIL', 'FATIGUE_EXCEEDS_UNITY'].includes(row.reviewPriority);
    if (normalized === 'blocked') return row.reviewPriority === 'BLOCKED';
    if (normalized === 'staticFail') return row.reviewPriority === 'STATIC_FAIL';
    if (normalized === 'fatigueExceeds') return row.reviewPriority === 'FATIGUE_EXCEEDS_UNITY';
    if (normalized === 'fatigueEvaluated') return row.fatigueEvaluated === true;
    if (normalized === 'staticOnly') return row.reviewPriority === 'STATIC_ONLY';
    return true;
  });
  return Object.freeze(filtered);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvScalar(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return String(value);
}

function csvLongRows(bundle) {
  const cyclesByProduct = new Map();
  for (const cycle of bundle.cycleRows) {
    const rows = cyclesByProduct.get(cycle.productId) ?? [];
    rows.push(cycle);
    cyclesByProduct.set(cycle.productId, rows);
  }
  const rows = [];
  for (const product of bundle.productRows) {
    const cycles = cyclesByProduct.get(product.productId) ?? [];
    const base = {
      schemaVersion: bundle.schemaVersion,
      projectId: bundle.projectIdentity.projectId,
      classId: bundle.projectIdentity.classId,
      revision: bundle.projectIdentity.revision,
      projectState: bundle.projectState,
      ...product,
    };
    if (!cycles.length) rows.push({ ...base, rowType: 'PRODUCT' });
    else cycles.forEach((cycle) => rows.push({ ...base, ...cycle, rowType: 'PRODUCT_CYCLE' }));
  }
  return rows;
}

export function serializeHpPipingClassResultCsv(bundle) {
  if (bundle?.schemaVersion !== HP_PIPING_CLASS_RESULT_EXPORT_VERSION) throw new TypeError('Unsupported HP result export schema.');
  const lines = [HP_PIPING_CLASS_RESULT_CSV_HEADERS.map(csvEscape).join(',')];
  for (const row of csvLongRows(bundle)) {
    lines.push(HP_PIPING_CLASS_RESULT_CSV_HEADERS.map((key) => csvEscape(csvScalar(row[key]))).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

function parseCsvRecords(text) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  const source = String(text ?? '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') { record.push(field); field = ''; }
    else if (char === '\n') {
      record.push(field.replace(/\r$/, ''));
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new TypeError('CSV contains an unterminated quoted field.');
  if (field !== '' || record.length) {
    record.push(field.replace(/\r$/, ''));
    if (record.some((value) => value !== '')) records.push(record);
  }
  return records;
}

function parseTyped(value, type) {
  if (value === '') return null;
  if (type === 'boolean') {
    if (value === 'TRUE') return true;
    if (value === 'FALSE') return false;
    throw new TypeError(`Invalid boolean value ${value}.`);
  }
  if (type === 'number' || type === 'integer') {
    const number = Number(value);
    if (!Number.isFinite(number) || (type === 'integer' && !Number.isInteger(number))) {
      throw new TypeError(`Invalid ${type} value ${value}.`);
    }
    return number;
  }
  return value;
}

export function parseHpPipingClassResultCsv(text) {
  const records = parseCsvRecords(text);
  if (!records.length) throw new TypeError('Result CSV is empty.');
  const headers = records[0];
  if (headers.length !== CSV_COLUMNS.length || headers.some((header, index) => header !== CSV_COLUMNS[index][0])) {
    throw new TypeError('Result CSV header does not match the canonical export contract.');
  }
  return Object.freeze(records.slice(1).map((record, rowIndex) => {
    if (record.length !== CSV_COLUMNS.length) throw new TypeError(`Result CSV row ${rowIndex + 2} has ${record.length} columns; expected ${CSV_COLUMNS.length}.`);
    const row = {};
    CSV_COLUMNS.forEach(([key, type], index) => { row[key] = parseTyped(record[index], type); });
    if (row.schemaVersion !== HP_PIPING_CLASS_RESULT_EXPORT_VERSION) throw new TypeError(`Unsupported result CSV schema ${row.schemaVersion}.`);
    return Object.freeze(row);
  }));
}

export function serializeHpPipingClassResultJson(bundle) {
  if (bundle?.schemaVersion !== HP_PIPING_CLASS_RESULT_EXPORT_VERSION) throw new TypeError('Unsupported HP result export schema.');
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

export function parseHpPipingClassResultJson(text) {
  const parsed = JSON.parse(String(text ?? ''));
  if (parsed?.schemaVersion !== HP_PIPING_CLASS_RESULT_EXPORT_VERSION) throw new TypeError('Unsupported HP result export schema.');
  if (!Array.isArray(parsed.productRows) || !Array.isArray(parsed.cycleRows)) throw new TypeError('HP result export must contain productRows[] and cycleRows[].');
  return parsed;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function verifyHpPipingClassResultRoundTrip(bundle) {
  const jsonText = serializeHpPipingClassResultJson(bundle);
  const jsonParsed = parseHpPipingClassResultJson(jsonText);
  const csvText = serializeHpPipingClassResultCsv(bundle);
  const csvParsed = parseHpPipingClassResultCsv(csvText);
  const expectedCsvRows = csvLongRows(bundle).map((row) => {
    const normalized = {};
    CSV_COLUMNS.forEach(([key, type]) => { normalized[key] = parseTyped(csvScalar(row[key]), type); });
    return normalized;
  });
  const jsonOk = sameJson(jsonParsed, JSON.parse(JSON.stringify(bundle)));
  const csvOk = sameJson(csvParsed, expectedCsvRows);
  return Object.freeze({
    ok: jsonOk && csvOk,
    jsonOk,
    csvOk,
    productRowCount: bundle.productRows.length,
    cycleRowCount: bundle.cycleRows.length,
    csvRowCount: csvParsed.length,
  });
}
