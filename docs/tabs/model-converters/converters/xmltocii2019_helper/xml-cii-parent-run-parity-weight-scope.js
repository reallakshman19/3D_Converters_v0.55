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
  return branchRowsFromPreview(preview(
    sourceXmlText,
    config,
    stagedJsonText,
    { branchRowsOnly: true },
  ));
}
