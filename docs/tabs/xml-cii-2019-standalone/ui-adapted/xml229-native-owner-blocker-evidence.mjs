/**
 * Audit-only evidence for a blocked governed XML229 CII release.
 *
 * This payload is not a source-revision manifest, engineering classification,
 * accepted mass packet or native CII release credential.
 */
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function buildXml229NativeOwnerBlockerEvidence(report) {
  if (report?.schema !== 'XML229.NativeOwnerPreflight.v1' ||
      report?.status !== 'UNSUPPORTED_OWNERS' ||
      !sha256(report.sourceXmlSha256) ||
      !Array.isArray(report.unsupportedOwners) ||
      report.unsupportedOwners.length === 0)
    throw new Error('XML229_NATIVE_OWNER_EVIDENCE_UNAVAILABLE');

  const owners = report.unsupportedOwners.map(row => {
    if (!Number.isSafeInteger(row.branchOccurrenceIndex) ||
        row.branchOccurrenceIndex < 0 ||
        !Number.isSafeInteger(row.sourceNodeOrdinal) ||
        row.sourceNodeOrdinal < 0 ||
        row.componentType !== 'INST' ||
        typeof row.componentRefNo !== 'string' ||
        !row.componentRefNo.trim() ||
        !Number.isFinite(row.spanMm) || row.spanMm <= 0 ||
        row.reason !== 'INSTRUMENT_RIGID_CLASSIFICATION_NOT_IN_SOURCE')
      throw new Error('XML229_NATIVE_OWNER_EVIDENCE_INVALID');
    return Object.freeze({
      branchOccurrenceIndex: row.branchOccurrenceIndex,
      sourceNodeOrdinal: row.sourceNodeOrdinal,
      componentType: row.componentType,
      componentRefNo: row.componentRefNo,
      spanMm: row.spanMm,
      reason: row.reason,
    });
  });
  const identities = new Set(owners.map(row =>
    JSON.stringify([row.branchOccurrenceIndex, row.sourceNodeOrdinal])));
  if (identities.size !== owners.length)
    throw new Error('XML229_NATIVE_OWNER_EVIDENCE_DUPLICATE');

  return Object.freeze({
    schema: 'XML229.NativeOwnerBlockerEvidence.v1',
    status: 'GOVERNED_CII_HELD',
    sourceXmlSha256: report.sourceXmlSha256,
    basisId: typeof report.basisId === 'string' ? report.basisId : null,
    finalIntentSha256: sha256(report.finalIntentSha256) ? report.finalIntentSha256 : null,
    physicalCount: Number.isSafeInteger(report.physicalCount) ? report.physicalCount : null,
    unsupportedOwnerCount: owners.length,
    unsupportedOwners: Object.freeze(owners),
    engineeringApprovalVerified: false,
    instrumentClassificationsApplied: false,
    nativeCiiReleaseAuthorized: false,
    instructions: 'Audit only; run xml229_instrument_source_revision.py inspect on the exact source XML. Review each suggestion before optional apply to a new source revision. Complete a new source-bound Final review and native CII reconciliation.',
  });
}
