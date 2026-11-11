function branchRowsFromPreview(preview) {
  return Array.isArray(preview?.branchRows) ? preview.branchRows : [];
}

export function xmlCiiParentRunParityBranchRows({
  preview,
  sourceXmlText,
  config,
  stagedJsonText,
}) {
  if (typeof preview !== 'function') return [];
  const weight = config?.weight;
  const masterRows = Array.isArray(weight?.masterRows) ? weight.masterRows : null;
  if (!masterRows?.length) {
    return branchRowsFromPreview(preview(sourceXmlText, config, stagedJsonText));
  }

  weight.masterRows = [];
  try {
    return branchRowsFromPreview(preview(sourceXmlText, config, stagedJsonText));
  } finally {
    weight.masterRows = masterRows;
  }
}
