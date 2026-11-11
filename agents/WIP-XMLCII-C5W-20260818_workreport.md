# WIP-XMLCII-C5W-20260818 — C5 Weight-only incremental Preview

## Current state

```text
STACK_BASE = PR604 / 23186fa03de198ad511eba41a3abc6c94b2661db
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; min 18/20
C3_WORKER_ADMISSION = NOT_ADMITTED / NO REAL MAIN-THREAD TIMING EVIDENCE
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement the first proven C5 incremental recomputation slice: **Weight/rigid facts only**.

A Weight-only configuration/master change may reuse already-qualified branch/process facts and rerank final node weight rows. Any source, staged JSON, or non-Weight configuration change fails closed to the existing full Preview dry-run.

This work pack does not yet incrementally recompute line/process/support/branch scopes.

## Grounded production trace

Current `xmlCiiDryRunPreview` sequence:

1. core parse / branch resolution / node weight ranking;
2. strict explicit/exact Line authority repair;
3. bore/wall authority;
4. material-code authority;
5. rating authority;
6. rating authority reranks all node weight rows from final branch ratings.

`branchRows` do not read Weight Master rows. Final `nodeRows` are reranked by `applyPreviewRatingAuthority()` from `branchRows` plus the current Weight config.

Therefore the safe seam is the **final post-rating result**, not pre-rating/core branch rows.

## Correctness boundary

C5a does not rely on C4 revisions alone. Runtime reuse requires exact equality of:

- source XML text;
- staged JSON text;
- canonical entire config with the `weight` section removed.

The only allowed basis difference is the `weight` section itself.

This fail-closed exact-input comparison protects C5a even while remaining direct UI config-save paths are still being routed through the C4 revision ledger.

Same-basis cache hits are intentionally not served; Preview Cache v7 already owns full same-authority reuse. C5a exists only for the proven Weight-only transition.

## Appendix A

```text
A1 full Preview/core/postprocessor production trace          20/20
A2 Weight-only branch-vs-node dependency isolation           20/20
A3 exact source/staged/non-Weight authority invariant        20/20
A4 independent/equivalence validation design                 18/20
A5 minimal fail-closed runtime-only patch + falsifier        20/20
TOTAL                                                          98/100
```

A4 is limited by unavailable real-browser/full private-repo fixture execution; no unexecuted check is claimed PASS.

## Mandatory backup evidence

Exact PR604 stack-base blobs reconstructed and verified before edit:

```text
xml-cii-adapted-preview-dryrun.js           ac247cbe1a1a268d921a92b3d4fbdbc9e3290185
xml-cii-adapted-preview-rating-authority.js ec4a2e6161d2bba98194189c83b1b01da03b3a3b
```

Exact repository backup utility remains:

`cd0c755457bb623b0487200a7d0b7217d8b3478e`

Mandatory backups succeeded before edits:

- #14 dry-run wrapper;
- #15 rating authority.

## Implementation design

New `xml-cii-adapted-preview-incremental.js`:

- runtime-memory only; never persisted;
- stable canonical non-Weight config signature;
- stable Weight config signature;
- retains only the last complete Preview result/basis;
- Weight-only transition reuses branchRows by identity and reranks nodeRows;
- any source/staged/non-Weight mismatch executes full build;
- rerank exception executes full build;
- identical Weight/same basis executes full build rather than becoming a competing v7 cache;
- exposes aggregate internal counts for qualification (`fullBuilds`, `weightOnlyBuilds`, `branchRowsReused`, `nodeRowsRecomputed`).

`xml-cii-adapted-preview-rating-authority.js` exports the exact existing final node reranker; `applyPreviewRatingAuthority()` continues using that same function.

`xml-cii-adapted-preview-dryrun.js` routes the full final-authority result through the runtime-only incremental gate.

## Local validation

Focused suite: **6/6 PASS**.

Proved:

- first build is full;
- Weight-only change reuses branchRows by object identity;
- Weight-only result deep-equals a fresh full-result model under new Weight config;
- source change => full;
- staged JSON change => full;
- any non-Weight config change => full;
- Weight section excluded from branch basis;
- rerank exception => full;
- dry-run integration calls the same exported final-authority reranker used by normal full Preview.

Classification: `PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`.

Real browser/full Preview benchmark equivalence remains `NOT_RUN`.

## Negative assurance

No Line List/Piping Class/Material/process/support formulas or matching rules change; no source parse semantics change; no support/GAP semantics; no CII writer/runtime switch; no persistent cache/index; no workers; no units/result-publication changes.

## Falsifier

Any non-Weight basis change takes the partial path; branchRows differ from the prior qualified branch rows on Weight-only transition; partial nodeRows differ from a full new-Weight build; rerank failure does not fall back to full; or runtime cache becomes persisted authority.

## EXACT_NEXT_ACTION

Publish the locally tested runtime-only module + two surgical existing-file edits + focused tests, reconcile the stacked diff, and open a draft C5a PR. Keep C3 workers NOT_ADMITTED.