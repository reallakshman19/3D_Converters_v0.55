import {
  ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA,
  ENERGY_INSTITUTE_EIT_SCHEMA,
  assertEnergyInstituteEitV5Document,
  cloneEitValue,
  createEitError,
  deepFreezeEitValue,
} from './contract.js';
import { getEnergyInstituteEitModule, listEnergyInstituteEitModules } from './module-registry.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function declaredCodes(line) {
  return [...new Set(String(line?.modules ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean))];
}

function parseDetail(raw) {
  if (raw === undefined || raw === null || raw === '') {
    return { parseState: 'EMPTY', parsed: [], recordCount: 0 };
  }
  let parsed = raw;
  try {
    if (typeof raw === 'string') parsed = JSON.parse(raw);
  } catch (error) {
    return { parseState: 'MALFORMED', parsed: null, recordCount: null, message: String(error?.message || error) };
  }
  if (!Array.isArray(parsed)) {
    return { parseState: 'MALFORMED', parsed: null, recordCount: null, message: 'Module detail payload must decode to an array.' };
  }
  return { parseState: parsed.length ? 'PARSED' : 'EMPTY', parsed: cloneEitValue(parsed), recordCount: parsed.length };
}

function resultPresent(raw) {
  return raw !== undefined && raw !== null && raw !== '';
}

function moduleCandidates(line, declared) {
  const candidates = new Set(declared);
  for (const definition of listEnergyInstituteEitModules()) {
    if (hasOwn(line, definition.resultField) || hasOwn(line, definition.detailField)) candidates.add(definition.code);
  }
  return [...candidates].sort();
}

function modulePayload(line, code, declared) {
  const definition = getEnergyInstituteEitModule(code);
  if (!definition) {
    return {
      code, known: false, declaredInModules: declared.includes(code), resultFieldPresent: false,
      detailFieldPresent: false, resultPresent: false, dataPresent: false, parseState: 'UNKNOWN_SCHEMA',
      rawResult: null, rawData: null, parsedData: null,
    };
  }
  const rawResult = hasOwn(line, definition.resultField) ? line[definition.resultField] : undefined;
  const rawData = hasOwn(line, definition.detailField) ? line[definition.detailField] : undefined;
  const detail = parseDetail(rawData);
  return {
    code,
    known: true,
    mechanismId: definition.mechanismId,
    declaredInModules: declared.includes(code),
    resultFieldPresent: hasOwn(line, definition.resultField),
    detailFieldPresent: hasOwn(line, definition.detailField),
    resultPresent: resultPresent(rawResult),
    dataPresent: detail.recordCount > 0,
    parseState: detail.parseState,
    rawResult: cloneEitValue(rawResult ?? null),
    rawData: cloneEitValue(rawData ?? null),
    parsedData: detail.parsed,
    detailRecordCount: detail.recordCount,
    parseMessage: detail.message ?? null,
  };
}

function parseLine(line, index) {
  if (!line || typeof line !== 'object' || Array.isArray(line)) {
    throw createEitError('EIT_LINE_INVALID', `lines[${index}] must be an object.`, { index });
  }
  const declared = declaredCodes(line);
  const modules = moduleCandidates(line, declared).map((code) => modulePayload(line, code, declared));
  return {
    lineIndex: index,
    rid: line.rid ?? null,
    pnid: line.pnid ?? null,
    lineReference: line.lref ?? null,
    lineDescription: line.ldesc ?? null,
    pipeIndex: line.pi ?? null,
    streamIndex: line.si ?? null,
    declaredModules: declared,
    unknownDeclaredModules: declared.filter((code) => !getEnergyInstituteEitModule(code)),
    modules,
    historicalMaxLof: hasOwn(line, 'maxLof') ? cloneEitValue(line.maxLof) : null,
  };
}

function moduleSummary(lines) {
  const summary = new Map();
  for (const line of lines) {
    for (const payload of line.modules) {
      const current = summary.get(payload.code) ?? {
        code: payload.code, known: payload.known, mechanismId: payload.mechanismId ?? null,
        lineCount: 0, declaredCount: 0, resultCount: 0, dataCount: 0, malformedCount: 0,
      };
      current.lineCount += 1;
      if (payload.declaredInModules) current.declaredCount += 1;
      if (payload.resultPresent) current.resultCount += 1;
      if (payload.dataPresent) current.dataCount += 1;
      if (payload.parseState === 'MALFORMED') current.malformedCount += 1;
      summary.set(payload.code, current);
    }
  }
  return [...summary.values()].sort((left, right) => left.code.localeCompare(right.code));
}

export function parseEnergyInstituteEitDocument(value, { sourceName = 'imported.eit' } = {}) {
  const document = assertEnergyInstituteEitV5Document(value);
  const lines = document.lines.map(parseLine);
  return deepFreezeEitValue({
    schema: ENERGY_INSTITUTE_EIT_IMPORT_SCHEMA,
    sourceSchema: ENERGY_INSTITUTE_EIT_SCHEMA,
    sourceName: String(sourceName),
    options: cloneEitValue(document.options),
    lines,
    pipes: cloneEitValue(document.pipes),
    streams: cloneEitValue(document.streams),
    mats: cloneEitValue(document.mats ?? []),
    moduleSummary: moduleSummary(lines),
    originalDocument: cloneEitValue(document),
    authority: {
      importedResultsAreCurrentEngineeringAuthority: false,
      importedResultsDisposition: 'HISTORICAL_REVIEW_REQUIRED',
      screeningAuthorized: false,
      designAuthority: false,
    },
  });
}

export function parseEnergyInstituteEit(text, options = {}) {
  let document;
  try {
    document = JSON.parse(String(text ?? ''));
  } catch (error) {
    throw createEitError('EIT_JSON_INVALID', 'Energy Institute .eit import requires valid JSON.', {
      message: String(error?.message || error),
    });
  }
  return parseEnergyInstituteEitDocument(document, options);
}
