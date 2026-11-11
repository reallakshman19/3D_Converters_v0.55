import { isWorkbookFile } from './master-dataset-protocol.js';

function dataView(buffer) {
  if (!(buffer instanceof ArrayBuffer)) throw new Error('ArrayBuffer is required.');
  if (!buffer.byteLength) throw new Error('File is empty (0 bytes).');
  return new Uint8Array(buffer);
}

export function listWorkbookSheets(buffer, xlsx) {
  const workbook = xlsx.read(dataView(buffer), { type: 'array', bookSheets: true });
  const sheetNames = Array.isArray(workbook?.SheetNames) ? workbook.SheetNames : [];
  if (!sheetNames.length) throw new Error('Workbook contains no sheets.');
  return sheetNames;
}

function readWorkbookSheet(buffer, sheetName, xlsx) {
  const workbook = xlsx.read(dataView(buffer), {
    type: 'array',
    sheets: sheetName,
    cellDates: false,
    raw: false,
  });
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet) throw new Error(`Worksheet not found: ${sheetName}`);
  return sheet;
}

export function parseWorkbookSheet(buffer, sheetName, xlsx) {
  const sheet = readWorkbookSheet(buffer, sheetName, xlsx);
  return xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false });
}

function boundedSheetRange(sheet, xlsx, maxRows) {
  const requested = Math.max(1, Math.min(100, Number(maxRows) || 25));
  if (sheet?.['!ref'] && typeof xlsx?.utils?.decode_range === 'function') {
    const range = xlsx.utils.decode_range(sheet['!ref']);
    range.e.r = Math.min(range.e.r, range.s.r + requested);
    return range;
  }
  return { s: { r: 0, c: 0 }, e: { r: requested, c: 255 } };
}

export function parseWorkbookSheetSample(buffer, sheetName, xlsx, maxRows = 25) {
  const sheet = readWorkbookSheet(buffer, sheetName, xlsx);
  const range = boundedSheetRange(sheet, xlsx, maxRows);
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: false, range });
  return Array.isArray(rows) ? rows.slice(0, Math.max(1, Number(maxRows) || 25)) : [];
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map((value) => value.trim().replace(/^["']|["']$/g, ''));
  return lines.slice(1).map((line, rowIndex) => {
    const values = line.split(',').map((value) => value.trim().replace(/^["']|["']$/g, ''));
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']).concat([['_rowIndex', rowIndex + 1]]));
  });
}

function parseMaterialMapText(text) {
  return String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
    .map((line) => line.trim()).filter((line) => line && !/^\d{4}$/.test(line))
    .map((line, index) => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      return { _rowIndex: index + 1, code: match ? match[1].trim() : '', material: match ? match[2].trim() : line };
    });
}

function parseJson(text) {
  const value = JSON.parse(text);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.rows)) return value.rows;
  throw new Error('JSON master import requires an array or an object with a rows array.');
}

export function parseTextSource(buffer, fileName, masterKey) {
  const text = new TextDecoder('utf-8').decode(dataView(buffer));
  if (/\.json$/i.test(fileName)) return parseJson(text);
  if (masterKey === 'materialMap' && /\.(txt|map)$/i.test(fileName)) return parseMaterialMapText(text);
  return parseCsv(text);
}

export function sourceNeedsSheetSelection(fileName) {
  return isWorkbookFile(fileName);
}
