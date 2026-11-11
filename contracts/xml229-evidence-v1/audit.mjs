/**
 * XML229 G0 read-only evidence consistency auditor. This is NOT an engineering
 * attestor: caller-supplied JSON, including matching SHA-shaped strings, cannot
 * authorize a Preview, decision, qualification run, or CII release.
 * No raw XML/JSON/master rows, Worker controller, DOM or native converter.
 */
export const AUDIT_SCHEMA = 'XML229.ReadOnlyEvidenceAudit.v1';
const SHA = /^[0-9a-f]{64}$/i;
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonblank = x => typeof x === 'string' && x.trim().length > 0;
const whole = x => Number.isSafeInteger(x) && x >= 0;
const same = (a, b) => nonblank(a) && a === b;
const shape = (x, schema) => isObject(x) && x.schema === schema;

export function auditXml229Evidence(input = {}) {
  const issues = [];
  const add = code => { if (!issues.includes(code)) issues.push(code); };
  if (!isObject(input)) {
    return Object.freeze({ schema: AUDIT_SCHEMA, status: 'INCONSISTENT',
      authoritative: false, nativeCiiReleaseAuthorized: false,
      issues: Object.freeze(['INVALID_AUDIT_ENVELOPE']) });
  }
  const { sourceReceipt: source, sessionReceipt: session,
    completion: proof, finalIntent: intent, physicalTransfer: transfer,
    nativeBoundary: boundary, readiness } = input;
  const provided = {
    source: source !== undefined, session: session !== undefined,
    preview: proof !== undefined, finalIntent: intent !== undefined,
    physicalTransfer: transfer !== undefined,
    nativeBoundary: boundary !== undefined, readiness: readiness !== undefined,
  };
  if (provided.source && (!shape(source, 'XML229.OriginalStagedSourceReceipt.v1') ||
      !SHA.test(source.sha256) || !nonblank(source.generationId))) add('INVALID_SOURCE_RECEIPT');
  if (provided.session && (!isObject(session) || !SHA.test(session.basisId) ||
      !nonblank(session.sourceId) || !whole(session.physicalCount) ||
      !SHA.test(session.originalJsonSha256) || !nonblank(session.sourceGenerationId)))
    add('INVALID_WORKER_SESSION_RECEIPT');
  if (provided.preview) auditPreview(proof, session, source, add);
  if (provided.finalIntent) auditFinalIntent(intent, proof, session, source, add);
  if (provided.physicalTransfer) auditTransfer(transfer, intent, session, add);
  if (provided.nativeBoundary) auditNativeBoundary(boundary, transfer, add);
  if (provided.readiness) auditReadiness(readiness, add);
  for (const receipt of [proof, intent, transfer, boundary]) {
    if (isObject(receipt) && receipt.nativeCiiReleaseAuthorized === true) add('UNSUPPORTED_RELEASE_CLAIM');
    if (isObject(receipt) && receipt.ciiReleaseAuthorized === true) add('UNSUPPORTED_RELEASE_CLAIM');
  }
  const missing = Object.entries(provided).filter(([, v]) => !v).map(([k]) => k);
  const status = issues.length ? 'INCONSISTENT' : missing.length ? 'INCOMPLETE' : 'CONSISTENT';
  return Object.freeze({ schema: AUDIT_SCHEMA, status, authoritative: false,
    nativeCiiReleaseAuthorized: false, provided: Object.freeze(provided),
    missingEvidence: Object.freeze(missing), issues: Object.freeze(issues),
    physicalCount: whole(proof?.verifiedPhysicalCount) ? proof.verifiedPhysicalCount : null,
    factRecordCount: whole(proof?.verifiedFactCount) ? proof.verifiedFactCount : null,
    massCounts: validCounts(proof?.counts) ? Object.freeze({
      source:proof.counts.source,match1:proof.counts.match1,
      final:proof.counts.final,unresolved:proof.counts.unresolved,
    }) : null });
}

function validCounts(c) {
  return isObject(c) && ['source','match1','final','unresolved'].every(k => whole(c[k]));
}
function auditPreview(proof, session, source, add) {
  if (!shape(proof, 'XML229.P4.RunAdvisory.v1') ||
      !SHA.test(proof.basisId) || !SHA.test(proof.originalJsonSha256) ||
      !nonblank(proof.sourceGenerationId) || !nonblank(proof.sourceId) ||
      !whole(proof.verifiedPhysicalCount) || !whole(proof.verifiedFactCount) ||
      proof.engineeringFactsVerified !== true ||
      proof.previewStatus !== 'FULL_SOURCE_FACTS_VERIFIED' ||
      !validCounts(proof.counts)) { add('INVALID_PREVIEW_COMPLETION_SHAPE'); return; }
  const c = proof.counts;
  if (proof.verifiedFactCount !== 7 * proof.verifiedPhysicalCount ||
      c.source + c.match1 + c.final + c.unresolved !== proof.verifiedPhysicalCount)
    add('INCONSISTENT_PHYSICAL_FACT_OR_MASS_CENSUS');
  if (isObject(source) && (!same(proof.originalJsonSha256, source.sha256) ||
      !same(proof.sourceGenerationId, source.generationId))) add('PREVIEW_SOURCE_DRIFT');
  if (isObject(session) && (!same(proof.basisId,session.basisId) ||
      !same(proof.sourceId,session.sourceId) ||
      !same(proof.originalJsonSha256,session.originalJsonSha256) ||
      !same(proof.sourceGenerationId,session.sourceGenerationId) ||
      proof.verifiedPhysicalCount !== session.physicalCount)) add('PREVIEW_SESSION_DRIFT');
}
function auditFinalIntent(intent, proof, session, source, add) {
  if (!shape(intent, 'XML229.NativeFinalPhysicalIntent.v1') ||
      !SHA.test(intent.intentSha256) || !SHA.test(intent.basisId) ||
      !SHA.test(intent.originalJsonSha256) || !nonblank(intent.sourceGenerationId) ||
      !whole(intent.physicalCount) || !whole(intent.verifiedFactCount) ||
      !['sourceAcceptedCount','match1OnlyCount','acceptedFinalCount','unresolvedCount'].every(k => whole(intent[k]))) {
    add('INVALID_FINAL_INTENT_SHAPE'); return;
  }
  const total = intent.sourceAcceptedCount + intent.match1OnlyCount +
    intent.acceptedFinalCount + intent.unresolvedCount;
  if (total !== intent.physicalCount ||
      intent.eligibleForEngineBinding !== (intent.unresolvedCount === 0 && intent.match1OnlyCount === 0))
    add('FINAL_INTENT_CENSUS_OR_ELIGIBILITY_DRIFT');
  if (isObject(session) && (!same(intent.basisId, session.basisId) ||
      intent.physicalCount !== session.physicalCount)) add('FINAL_INTENT_SESSION_DRIFT');
  if (isObject(source) && (!same(intent.originalJsonSha256, source.sha256) ||
      !same(intent.sourceGenerationId, source.generationId))) add('FINAL_INTENT_SOURCE_DRIFT');
  if (isObject(proof) && (intent.physicalCount !== proof.verifiedPhysicalCount ||
      intent.verifiedFactCount !== proof.verifiedFactCount ||
      intent.sourceAcceptedCount !== proof.counts?.source ||
      intent.match1OnlyCount !== proof.counts?.match1 ||
      intent.acceptedFinalCount !== proof.counts?.final ||
      intent.unresolvedCount !== proof.counts?.unresolved)) add('FINAL_INTENT_PREVIEW_DRIFT');
}
function auditTransfer(transfer, intent, session, add) {
  if (!shape(transfer, 'XML229.R2.OriginalPhysicalEngineInputTransfer.v1') ||
      !SHA.test(transfer.basisId) || !SHA.test(transfer.finalIntentSha256) ||
      !SHA.test(transfer.engineInputSha256) || !whole(transfer.originalPhysicalCount) ||
      !whole(transfer.verifiedEnginePhysicalCount) || !Array.isArray(transfer.matches) ||
      transfer.complete !== true) { add('INVALID_ENGINE_INPUT_TRANSFER_SHAPE'); return; }
  if (transfer.originalPhysicalCount !== transfer.verifiedEnginePhysicalCount ||
      transfer.matches.length !== transfer.originalPhysicalCount) add('ENGINE_INPUT_POPULATION_DRIFT');
  const ids = transfer.matches.map(x => x?.originalOccurrenceId);
  if (ids.some(x => !nonblank(x)) || new Set(ids).size !== ids.length)
    add('ENGINE_INPUT_DUPLICATE_OR_MISSING_OWNER');
  if (isObject(intent) && (!same(transfer.finalIntentSha256, intent.intentSha256) ||
      !same(transfer.basisId, intent.basisId) ||
      transfer.originalPhysicalCount !== intent.physicalCount ||
      intent.eligibleForEngineBinding !== true)) add('ENGINE_INPUT_FINAL_INTENT_DRIFT');
  if (isObject(session) && !same(transfer.basisId, session.basisId))
    add('ENGINE_INPUT_SESSION_DRIFT');
}
function auditNativeBoundary(boundary, transfer, add) {
  if (!shape(boundary, 'XML229.NativeCiiEngineBoundary.v1') ||
      !SHA.test(boundary.engineInputSha256) ||
      (boundary.ciiOutputSha256 !== null && !SHA.test(boundary.ciiOutputSha256)) ||
      typeof boundary.engineBoundaryVerified !== 'boolean') {
    add('INVALID_NATIVE_BOUNDARY_SHAPE'); return;
  }
  if (isObject(transfer) && !same(boundary.engineInputSha256,transfer.engineInputSha256))
    add('NATIVE_ENGINE_INPUT_DIGEST_DRIFT');
  if (boundary.engineBoundaryVerified === true && !SHA.test(boundary.ciiOutputSha256))
    add('NATIVE_OUTPUT_BYTES_MISSING');
  if (boundary.physicalMatch2ConsumptionVerified === true)
    add('UNSUPPORTED_NATIVE_PHYSICAL_CONSUMPTION_CLAIM');
}
function auditReadiness(report, add) {
  if (!isObject(report) || !isObject(report.summary) ||
      !Array.isArray(report.checklistRows)) { add('INVALID_READINESS_REPORT'); return; }
  const rows = report.checklistRows;
  if (rows.some(r => !isObject(r) || typeof r.blocking !== 'boolean' ||
      !nonblank(r.id) || !nonblank(r.status))) { add('INVALID_READINESS_ROWS'); return; }
  const blockers = rows.filter(r => r.blocking).length;
  const warnings = rows.filter(r => !r.blocking && r.status !== 'ready').length;
  if (report.summary.blockingCount !== blockers || report.summary.warningCount !== warnings)
    add('READINESS_SUMMARY_ROW_DRIFT');
  if (isObject(report.raw) && report.raw.xml229VerifiedEngineering !== true &&
      rows.some(r => ['preview-audit','weight-match'].includes(r.id) && r.status === 'ready') &&
      rows.some(r => r.id === 'xml229-original-json-engineering-authority'))
    add('UNATTESTED_GOVERNED_READINESS');
  if (rows.some(r => r.id === 'xml229-original-json-engineering-authority' &&
      (r.status !== 'held' || r.blocking !== true)) &&
      report.raw?.xml229XmlOnlyOutput !== true)
    add('GOVERNED_NATIVE_HOLD_MISSING');
}
