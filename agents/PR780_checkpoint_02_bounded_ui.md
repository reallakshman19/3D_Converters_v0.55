# PR780 Checkpoint 02 — bounded UI reads

## Basis

- Parent: #776
- PR: #780
- Production commit: `1e3be2e8246ecd7ff86cd6e57333f5370b3f6627`
- Protocol basis: V3.1 / Common@`1ced68258afeaf50df113b1d38a4ceb9193587e3`
- Plan: `PLAN_UPDATE — rev 4`

## Phase B material result

- Import Masters Preview no longer depends on full hydrated normalized arrays for worker-backed datasets.
- Empty-query Preview reads only the current virtual window through bounded worker `GET_ROWS` requests.
- Search Preview keeps worker-owned search and fetches only the visible non-contiguous matches through bounded `GET_ROWS_BY_INDEXES` requests.
- Dynamic Field Mapping uses a bounded raw mapping sample instead of the complete raw master array for worker-backed datasets.
- The bounded mapping sample is persisted with IndexedDB dataset metadata and restored at startup.
- Legacy non-dataset masters retain the existing array-backed Preview/mapping path.
- Compatibility hydration remains in place for engineering-critical consumers; this checkpoint does not claim final metadata-only runtime authority.

## Protected pre-push evidence

The temporary protected apply job completed successfully before pushing the production commit:

- patch application: PASS
- JavaScript syntax checks: PASS
- PR780 master-dataset config/coordinator/persistence/rollback/startup/worker/search/integration tests: PASS
- Issue #776 deployment parity: PASS

Temporary write-enabled apply/backup workflow files are absent from the final production tree.

## Gate applicability

Per Owner direction and `PLAN_UPDATE — rev 4`, only XML→CII master-data gates are applicable. Unrelated CAESAR / FBX / StagedJSON gates are not work items unless a failure is directly traceable to PR #780 production material.

## Remaining architecture gap

Full normalized/raw compatibility hydration still exists because Preview candidate generation and engineering-critical Preview / Weight Match / Regex / Run paths remain synchronous full-dataset consumers. Those require separate parity-qualified migration before complete hydration can be removed.
