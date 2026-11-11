function text(value) { return String(value ?? '').trim(); }

function records(table) {
  if (!Array.isArray(table?.header) || !Array.isArray(table?.rows)) return [];
  return table.rows.map((row, rowIndex) => ({
    rowIndex,
    values: Object.fromEntries(table.header.map((column, columnIndex) => [column, text(row?.[columnIndex])])),
  }));
}

function omittedIndices(rows, requiredFields) {
  return rows.filter(({ values }) => requiredFields.some((field) => !text(values[field])))
    .map(({ rowIndex }) => rowIndex);
}

export function buildAivCanvasProjectionCoverage(input = {}) {
  const tables = input.assumptionResolution?.tables ?? input.tables ?? {};
  const sourceRows = records(tables.sources);
  const assessmentRows = records(tables.assessments);
  const relationshipRows = records(tables.relationships);
  const omittedRowIndices = Object.freeze({
    sources: Object.freeze(omittedIndices(sourceRows, ['Source Canonical ID', 'Operating Case'])),
    assessments: Object.freeze(omittedIndices(assessmentRows, ['Assessment Canonical ID'])),
    relationships: Object.freeze(omittedIndices(relationshipRows, [
      'Source Canonical ID', 'Assessment Canonical ID', 'Operating Case',
    ])),
  });
  const inputRows = Object.freeze({
    sources: sourceRows.length,
    assessments: assessmentRows.length,
    relationships: relationshipRows.length,
  });
  const omittedRows = Object.freeze(Object.fromEntries(
    Object.entries(omittedRowIndices).map(([kind, indices]) => [kind, indices.length]),
  ));
  const omittedTotal = Object.values(omittedRows).reduce((sum, count) => sum + count, 0);
  return Object.freeze({
    inputRows,
    representedRows: Object.freeze({
      sources: inputRows.sources - omittedRows.sources,
      assessments: inputRows.assessments - omittedRows.assessments,
      relationships: inputRows.relationships - omittedRows.relationships,
    }),
    omittedRows,
    omittedRowIndices,
    omittedTotal,
    complete: omittedTotal === 0,
    omissionReason: omittedTotal ? 'MISSING_ENGINEERING_IDENTITY' : null,
    placeholderEngineeringNodesCreated: false,
  });
}
