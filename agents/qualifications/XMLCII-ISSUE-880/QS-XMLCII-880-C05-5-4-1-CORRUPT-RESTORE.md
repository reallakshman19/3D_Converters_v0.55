# QS-XMLCII-880-C05.5.4.1 — Corrupt restore failure matrix baseline

## Responsibility

- Issue: #880 / C05.5.4.1
- Parent: #874 / C05.5.4
- Protocol: `reallaksh19/Common@3fd3a971f51a7f2a502edcb194eb9c3d729c37c8:skills/engineering-pr-delivery-v3.2`
- Material base: PR #879 head `6e0818273235c0bb326b720011f8132ca6e0f8c8`
- Scope: evidence only; no production repair.

## Current restore architecture

`hydratePersistedMasterDatasets()` currently performs:

```text
discover all indexeddb custody entries
  -> Promise.all(loadDataset(each master))
  -> only when every load succeeds:
       applyLoadedDatasets(currentState, allLoaded)
       replace stateRef.current
```

Consequences at this baseline:

1. A failed master is not attached because mutation occurs after all loads.
2. Pre-existing active-session authority remains unchanged when aggregate loading rejects.
3. A valid persisted sibling is also not restored when any one sibling rejects.
4. Failure text is emitted from the persisted restore layer, not from parsing/import, but is not yet machine-classified.

## Failure matrix

The focused test covers:

| Failure | Current result | Active session |
| --- | --- | --- |
| Missing IndexedDB metadata | aggregate hydrate rejects | preserved |
| Persisted row-count mismatch | aggregate hydrate rejects | preserved |
| Positive datasetRevision mismatch | aggregate hydrate rejects | preserved |
| Preview/row range unavailable | aggregate hydrate rejects | preserved |
| Legacy Weight fingerprint rows incomplete | aggregate hydrate rejects | preserved |
| Valid Piping Class + corrupt Mat_Map | both restores suppressed | preserved |

The last row is the RED owned by #881: valid persisted siblings are coupled to a corrupt sibling by the aggregate `Promise.all`.

## Boundary

No per-master isolation, same-key precedence, failure-result API, user-visible messaging, retry behavior, or localStorage row fallback is introduced by #880.
