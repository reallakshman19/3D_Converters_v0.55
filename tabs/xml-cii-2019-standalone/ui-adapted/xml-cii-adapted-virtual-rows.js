export const XML_CII_VIRTUAL_ROW_HEIGHT = 32;
export const XML_CII_VIRTUAL_WINDOW_ROWS = 60;
export const XML_CII_VIRTUAL_OVERSCAN_ROWS = 10;

function nonNegativeInteger(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function virtualRowWindow(rowCount, scrollTop, options = {}) {
  const count = nonNegativeInteger(rowCount);
  const rowHeight = nonNegativeInteger(options.rowHeight, XML_CII_VIRTUAL_ROW_HEIGHT);
  const windowRows = Math.max(1, nonNegativeInteger(options.windowRows, XML_CII_VIRTUAL_WINDOW_ROWS));
  const overscanRows = nonNegativeInteger(options.overscanRows, XML_CII_VIRTUAL_OVERSCAN_ROWS);
  const top = Math.max(0, Number(scrollTop) || 0);
  const visibleStart = Math.min(count, Math.floor(top / rowHeight));
  let start = Math.max(0, visibleStart - overscanRows);
  let end = Math.min(count, start + windowRows);
  if (end - start < windowRows) start = Math.max(0, end - windowRows);
  end = Math.min(count, start + windowRows);
  return {
    start,
    end,
    rowHeight,
    rowCount: count,
    domRowCount: end - start,
    topSpacerPx: start * rowHeight,
    bottomSpacerPx: Math.max(0, count - end) * rowHeight,
    totalHeightPx: count * rowHeight,
  };
}

export function buildMatchingRowIndexes(rows, query, searchText) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const q = String(query || '').toLowerCase().trim();
  if (!q) return null;
  const indexes = [];
  for (let index = 0; index < safeRows.length; index += 1) {
    if (String(searchText(safeRows[index]) || '').includes(q)) indexes.push(index);
  }
  return indexes;
}

export function logicalRowCount(rows, indexes) {
  return Array.isArray(indexes) ? indexes.length : (Array.isArray(rows) ? rows.length : 0);
}

export function rowForLogicalIndex(rows, indexes, logicalIndex) {
  const sourceIndex = Array.isArray(indexes) ? indexes[logicalIndex] : logicalIndex;
  return {
    row: Array.isArray(rows) ? rows[sourceIndex] : undefined,
    sourceIndex,
    logicalIndex,
  };
}

export function virtualRowItems(rows, indexes, window) {
  const items = [];
  for (let logicalIndex = window.start; logicalIndex < window.end; logicalIndex += 1) {
    items.push(rowForLogicalIndex(rows, indexes, logicalIndex));
  }
  return items;
}
