# QS-XMLCII-871-C05.5.1 — Persistence failure architecture and baseline

## Responsibility

Issue #871 is evidence-only. It maps current C05.5 failure boundaries on the C05.4 qualified material head `207365b66e9693181cd696068461122f316326bb`.

## Current control plane

### Worker import / IndexedDB

`master-dataset-service.finalizeDataset()` currently performs:

```text
parse / normalize
  -> allocate datasetId + datasetRevision
  -> datasets.set(...)             [session rows now exist]
  -> await store.persistDataset()  [durable IndexedDB boundary]
  -> DATASET_READY
```

Therefore an IndexedDB rejection occurs **after** parsed rows have been registered in worker memory but **before** `DATASET_READY` is returned. The caller experiences a failed import even though the worker can still answer `GET_ROWS` for the generated datasetId.

This is the RED owned by #872.

### Compact localStorage restart custody

`persistChangedMasterDetailed()` already catches individual localStorage write failures and returns structured `failures` plus `quotaLimited`; it does not itself destroy the supplied runtime context.

This is a distinct storage layer from IndexedDB. #873 owns the session-only restart-custody semantics; it must not introduce a full-row localStorage fallback.

### Cold restore

`hydratePersistedMasterDatasets()` loads all discovered persisted datasets with one `Promise.all` and only assigns `stateRef.current` after successful loading. A corrupt/missing persisted dataset therefore rejects before `applyLoadedDatasets()`, leaving pre-existing active runtime state unchanged.

The missing behavior is controlled isolation/status semantics, not a need to preserve state by copying it first. #874 owns corrupt-restore isolation; #875 owns user-visible failure/retry semantics.

### Mode-A surface

The active workflow shell catches startup restore errors and currently logs:

```text
[xml-cii] Mode-A IndexedDB master restore failed
```

It does not update `importMastersWriteBackStatus` in that catch path. User-visible distinction between parse success and persistence/restore failure belongs to #875.

## Baseline matrix

| Boundary | Current result | Classification | Next owner |
| --- | --- | --- | --- |
| Invalid source JSON | rejects before persist; no session dataset | parse failure | none |
| Parsed dataset + IndexedDB rejection | worker session rows exist, but OPEN_SOURCE rejects and no DATASET_READY reaches caller | RED | #872 |
| localStorage restart-custody write rejection | structured persistence failure returned; active context remains | partial PASS / semantics incomplete | #873/#875 |
| corrupt persisted cold dataset | hydration rejects before state mutation; active context remains | fail-closed PASS, isolation/status incomplete | #874/#875 |

## Guardrails

C05.5 must not:
- represent a session-only dataset as IndexedDB durable;
- copy raw/full masters into localStorage as fallback;
- relabel successful parsing as a parse failure;
- change Piping Class, Mat_Map, Valve Weight mapping semantics;
- change Weight Match ranking/formula/unit or C04 rigid-owner semantics.
