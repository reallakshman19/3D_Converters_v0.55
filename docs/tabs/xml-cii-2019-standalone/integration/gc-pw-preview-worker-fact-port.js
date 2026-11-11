// A3-U3.1: integrator-owned boundary between actual Preview job/read model
// and the merged GC-PW Preview-to-Weight review session.
// No browser globals, XML reparsing, guessed facts, or review commits.
import { assertBasisDigest, validatePage } from '../../../contracts/gc-pw-v1/contract.mjs';

export class GcPwWorkerFactGateError extends Error {
  constructor(code, message) {
    super(String(message));
    this.name = 'GcPwWorkerFactGateError';
    this.code = code;
    this.retryable = false;
  }
}
const fail = (code, message) => { throw new GcPwWorkerFactGateError(code, message); };
const check = (ok, code, message) => { if (!ok) fail(code, message); };
const count = n => Number.isSafeInteger(n) && n >= 0;

/**
 * startJob must call the real Preview controller.start(), returning
 * {requestId,basisId,promise,cancel}. openFactModel must return the actual
 * Preview read model, not a synthesized model made from review nodeRows.
 *
 * Merged #1032/#1035 workers state NOT_ASSESSED/false: fail closed until
 * independent engineering FactRecords and a verified read model exist.
 */
export function createGcPwPreviewWorkerFactPort({
  startJob, openFactModel, expectedOriginalOccurrences, expectedOriginalCount,
  expectedModelOccurrenceCount, expectedPhysicalFactCount,
  pageSize = 100,
} = {}) {
  check(typeof startJob === 'function', 'WORKER_JOB_PORT_REQUIRED', 'Preview job start port required');
  check(typeof openFactModel === 'function', 'FACT_READ_MODEL_PORT_REQUIRED', 'Preview fact reader port required');
  check(count(expectedOriginalCount) && expectedOriginalCount > 0,
    'INDEPENDENT_SOURCE_COUNT_REQUIRED', 'Independent original population required');
  check(Array.isArray(expectedOriginalOccurrences)
    && expectedOriginalOccurrences.length === expectedOriginalCount,
    'INDEPENDENT_ORIGINAL_IDS_REQUIRED', 'Original source identity census must precede Worker execution');
  const originalKey = (row, kind) => {
    check(row && typeof row.sourceId === 'string' && row.sourceId.trim()
      && typeof row.occurrenceId === 'string' && row.occurrenceId.trim(),
      'INVALID_ORIGINAL_ID', 'Original occurrence source/ID required');
    return JSON.stringify([kind, row.sourceId, row.occurrenceId]);
  };
  const sourceKeys = new Set(expectedOriginalOccurrences.map(row =>
    originalKey(row, row.subjectType)));
  check(sourceKeys.size === expectedOriginalCount &&
    expectedOriginalOccurrences.every(row => ['branch','node'].includes(row.subjectType)),
    'DUPLICATE_ORIGINAL_ID', 'Original census has repeated or unknown identities');
  check(count(expectedModelOccurrenceCount) && expectedModelOccurrenceCount >= expectedOriginalCount,
    'INDEPENDENT_MODEL_COUNT_REQUIRED', 'Reader scope must include independently counted original source population');
  check(count(expectedPhysicalFactCount) && expectedPhysicalFactCount > 0,
    'INDEPENDENT_PHYSICAL_FIELD_COUNT_REQUIRED', 'Independent physical field count required');
  check(Number.isSafeInteger(pageSize) && pageSize >= 1 && pageSize <= 200,
    'INVALID_PAGE_SIZE', 'Preview read model supports 1..200 facts per page');
  return async function loadFactPages({basis, requestId, report, isCancelled} = {}) {
    check(basis && typeof basis === 'object', 'BASIS_REQUIRED', 'Complete InputBasis required');
    check(typeof requestId === 'string' && requestId.trim(), 'REQUEST_ID_REQUIRED', 'Worker request required');
    check(typeof report === 'function' && typeof isCancelled === 'function',
      'LIFECYCLE_PORTS_REQUIRED', 'Progress and cancellation required');
    await assertBasisDigest(basis);
    if (isCancelled()) fail('CANCELLED', 'Before Preview Worker launch');
    const job = startJob({basis,requestId});
    check(job && job.requestId === requestId && job.basisId === basis.basisId
      && typeof job.promise?.then === 'function' && typeof job.cancel === 'function',
      'UNBOUND_WORKER_JOB', 'Preview job handle has wrong request/basis');
    const cancelled = () => {
      if (!isCancelled()) return false;
      try { job.cancel(); } catch { /* cancellation never publishes authority */ }
      return true;
    };
    const result = await job.promise;
    if (cancelled()) fail('CANCELLED', 'Preview Worker result was superseded');
    check(result?.engineeringAcceptance === 'VERIFIED'
      && result?.fullFactPopulationAccepted === true,
      'ENGINEERING_NOT_VERIFIED', 'Preview Worker has not verified complete engineering facts');
    const originals = result.sourceOccurrences, coverage = result.coverage;
    check(Array.isArray(originals?.branches) && Array.isArray(originals?.nodes)
      && count(coverage?.sourceBranchCount) && count(coverage?.originalNodeCount)
      && originals.branches.length === coverage.sourceBranchCount
      && originals.nodes.length === coverage.originalNodeCount
      && originals.branches.length + originals.nodes.length === expectedOriginalCount,
      'WORKER_ORIGINAL_CENSUS_MISMATCH', 'Worker lost original source occurrences');
    const actualKeys = originals.branches.map(row => originalKey(row, 'branch'))
      .concat(originals.nodes.map(row => originalKey(row, 'node')));
    check(actualKeys.length === sourceKeys.size && new Set(actualKeys).size === sourceKeys.size
      && actualKeys.every(key => sourceKeys.has(key)),
      'WORKER_ORIGINAL_ID_MISMATCH', 'Worker changed original source/branch/node occurrence identities');
    const model = await openFactModel({basis, requestId, workerResult:result});
    if (cancelled()) fail('CANCELLED', 'Preview read model cancelled');
    check(model?.info?.basisId === basis.basisId
      && model.info.engineeringReady === true
      && model.info.computationStage === 'engineering-verified'
      && model.info.expectedOccurrenceCount === expectedModelOccurrenceCount
      && typeof model.getFacts === 'function',
      'ENGINEERING_MODEL_NOT_VERIFIED', 'Source-only or wrong-basis reader cannot open Weight');
    let cursor = null, total = null, read = 0;
    const seen = new Set(), pages = [];
    do {
      if (cancelled()) fail('CANCELLED', 'Fact paging cancelled');
      const page = await model.getFacts({
        basisId:basis.basisId, subjectType:'physical-component', cursor, limit:pageSize,
      });
      if (cancelled()) fail('CANCELLED', 'Fact paging returned after cancellation');
      validatePage(page, basis.basisId);
      check(page.complete === true, 'INCOMPLETE_ENGINEERING_PAGE', 'Unverified FactRecord page');
      if (total === null) total = page.totalCount;
      check(total === page.totalCount && total === expectedPhysicalFactCount,
        'PHYSICAL_FIELD_POPULATION_MISMATCH', 'Actual facts differ from independent population');
      check(page.items.length > 0, 'EMPTY_ENGINEERING_PAGE', 'Missing physical FactRecords');
      read += page.items.length;
      check(read <= total, 'FACT_PAGE_OVERFLOW', 'Duplicate/extra worker facts');
      if (page.nextCursor !== null) {
        check(!seen.has(page.nextCursor), 'REPEATED_FACT_CURSOR', 'Fact reader cursor loop');
        seen.add(page.nextCursor);
      }
      pages.push(page);
      report(read, total);
      cursor = page.nextCursor;
    } while (cursor !== null);
    check(read === total, 'TRUNCATED_ENGINEERING_FACTS', 'Fact pagination stopped early');
    // #1028/#1031 re-challenge source membership, original physical identity,
    // complete field set, live content hashes and Weight custody downstream.
    return pages;
  };
}
