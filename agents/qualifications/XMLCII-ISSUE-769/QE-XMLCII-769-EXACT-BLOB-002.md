QUALIFICATION_EVIDENCE_VERSION: 1
CHAIN_ID: XMLCII-ISSUE-769
QUALIFICATION_SCOPE_ID: QSCOPE-ISSUE769-RELEASE
QUESTION_SET_ID: QS-XMLCII-769-RELEASE-001
EVIDENCE_ID: QE-XMLCII-769-EXACT-BLOB-002
BRANCH_BASIS: c1f1e1fe0735e7501135ed05ac0128fe1e992d6c
NODE_VERSION: v22.16.0
EVIDENCE_CLASS: CONNECTOR_MATERIALIZED_EXACT_BLOB_EXECUTION
RECORDED_AT: 2026-09-16T19:24:00Z

# BM-005 bounded large-master persistence qualification

## Method

The committed BM-005 regression and its complete import closure were fetched from the Issue #769 branch, materialized locally, and each file was verified with `git hash-object` against its GitHub blob SHA before execution. The committed test was executed unchanged with Node v22.16.0.

This evidence validates the authored 11,000-row quota/persistence boundary only. It does not claim the Issue Basis 50k/100k runtime capacity ceiling and therefore does not close BM-005 overall.

## Exact blobs

- `tests/xml-cii-master-large-persistence.test.mjs` — `e5711ca81eafb7981024563681cb6f97101b0453`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js` — `52cb9d7326562af05c4c08db75b75e924ec93d61`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js` — `ed56fde4c931face110ad3e0fe235de7b866ce1b`

## Execution

COMMAND: `node --test tests/xml-cii-master-large-persistence.test.mjs`
RESULT: 2 tests / 2 pass / 0 fail

Validated assertions:
- an 11,000-row piping-class master remains authoritative in active session when normalized localStorage persistence raises `QuotaExceededError`;
- compact mode is selected because duplicate normalized/raw/workbook payload exceeds the compact threshold;
- the persistence result reports `quotaLimited: true` and `normalizedPersisted: false` rather than changing the in-memory authority;
- stale redundant raw/workbook persisted copies are removed;
- with an 8 MiB per-value quota, the same 11,000-row normalized master persists successfully while redundant raw/workbook copies remain absent.

## Benchmark status

BM-005_11K_QUOTA_PATH: PASS
BM-005_OVERALL: PARTIAL_PASS_11K
BM-005_50K_RUNTIME: NOT_RUN_ENVIRONMENT_BLOCKED
BM-005_100K_RUNTIME: NOT_RUN_ENVIRONMENT_BLOCKED

No production code was changed by this qualification step. BM-009 and final release readiness remain blocked.