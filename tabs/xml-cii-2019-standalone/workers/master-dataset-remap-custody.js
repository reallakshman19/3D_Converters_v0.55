function isRawRow(row) {
  return !!row && typeof row === 'object' && !Array.isArray(row);
}

export function recoverMasterDatasetRawRows(dataset) {
  if (Array.isArray(dataset?.rawRows)) return dataset.rawRows;
  if (dataset?.metadata?.masterKey !== 'lineList' || !Array.isArray(dataset?.rows)) return null;
  const recovered = dataset.rows.map((row) => row?._raw);
  return recovered.every(isRawRow) ? recovered : null;
}
