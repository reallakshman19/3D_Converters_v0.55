# PR606 Work Report — C5 Weight-only incremental Preview

## Current state

```text
PR = 606
BRANCH = agent/xml-cii-c5-weight-incremental-20260818
STACK_BASE = PR604 / agent/xml-cii-c4-dependency-revisions-20260818
REPORT_BASIS_HEAD = 0075da914e905adb0ec4195342bd935c19bdb59d
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
TAKEOVER_AUTHORITY = WRITE_ALLOWED
APPENDIX_A = 98/100; min 18/20
DRAFT = true
C3_WORKER_ADMISSION = NOT_ADMITTED
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement the first proven C5 incremental recomputation slice: Weight/rigid facts only. Reuse final qualified branch/process rows only when exact source XML, staged JSON and canonical non-Weight configuration are unchanged; rerank node weight facts using the exact current final Preview reranker.

## Correctness boundary

The runtime partial path does not trust C4 revisions as its sole gate. It requires exact equality of:

- source XML text;
- staged JSON text;
- stable canonical config with the entire `weight` section removed.

The only admitted basis difference is the `weight` section. Any source/staged/non-Weight change or rerank exception executes the existing full Preview path.

Same authority including unchanged Weight also executes the full path; persistent Preview Cache v7 continues to own exact-authority restoration.

## Production trace

The existing Preview pipeline performs core branch/process/node generation, strict Line authority repair, bore/wall authority, material authority and final rating authority. Final rating authority reranks all node weight rows against final branch ratings.

Branch/process rows do not consume Weight Master data. C5a therefore reuses the final post-authority `branchRows` and reruns the same exported final node reranker.

## Implementation

New `xml-cii-adapted-preview-incremental.js`:

- runtime-memory only;
- stores only last complete result/basis;
- stable non-Weight and Weight config signatures;
- Weight-only transition reuses `branchRows` object identity;
- node rows are recomputed through `rerankPreviewNodeRows`;
- any mismatch/error falls back to the full build;
- qualification counters: full builds, Weight-only builds, branch rows reused, node rows recomputed.

Existing `xml-cii-adapted-preview-rating-authority.js` now exports the exact existing final node reranker; the normal full path uses the same function.

Existing `xml-cii-adapted-preview-dryrun.js` factors the prior full path into `buildFullDryRunPreview()` and invokes the runtime gate around it.

## Mandatory backup / byte custody

Exact PR604 stack-base blobs were verified before edit:

```text
preview-dryrun.js           ac247cbe1a1a268d921a92b3d4fbdbc9e3290185
preview-rating-authority.js ec4a2e6161d2bba98194189c83b1b01da03b3a3b
```

Mandatory backups #14 and #15 succeeded before edits.

Published blobs exactly match the locally executed hashes:

```text
preview-incremental.js       50ee2eb511a4f18f72d47ec1cf3b257e8775980c
preview-dryrun.js            a8b0edd214a13a202d8eb789685f3b784c4dad53
preview-rating-authority.js  7640cf38868231637343ade9333ac552993fd989
weight tests                 3b76608d3c5f9fd15975fd42c9432135075f18b4
integration test             3e323e9105353dc9e7b2cbbd717b9a819fc6e964
```

## Validation ledger

```text
module syntax checks                         PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
focused C5a suite                            PASS 6/6 / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
first build => full                          PASS
Weight-only => branchRows object reused      PASS
Weight-only partial vs modeled fresh full    PASS / deep equality
source change => full                        PASS
staged JSON change => full                   PASS
non-Weight config change => full             PASS
rerank failure => full fallback              PASS
full/partial use same final reranker          PASS / static integration
changed-file reconciliation                  PASS / REMOTE_EXECUTION / exactly 8 declared paths
real browser/full private-repo equivalence   NOT_RUN
PR status checks                             NOT_RUN / none observed at report creation
```

No NOT_RUN item is represented as PASS.

## C4 dependency note

C4 revisions remain audit/invalidation infrastructure but are not the sole C5a correctness gate. Direct UI config-save routing gaps identified during C5 trace remain a separate follow-up; the exact-input gate above prevents those gaps from enabling unsafe partial reuse.

## C3 worker gate

Workers remain NOT_ADMITTED. No real main-thread timing evidence exists in this execution environment.

## Negative assurance

No line/process/support formula or matching rule changes; no support/GAP semantics; no CII writer/runtime; no source parser ownership; no persistent cache/index; no workers; no units/result-publication changes.

## Hypothesis / falsifier

Hypothesis: Weight-only Preview updates can reuse qualified branch/process facts and recompute node weights with semantic identity to the existing final Weight-ranking stage.

Falsifier: any hidden non-Weight authority change takes the partial path; reused branch rows differ from prior final branch rows; partial node rows differ from a fresh full new-Weight build; rerank failure does not fall back; or cache state becomes persisted authority.

## EXACT_NEXT_ACTION

Keep PR606 draft. Recheck mergeability/reviews/checks and active-PR overlap. Do not start workers. The next stage should either close C4 direct-save routing or perform a clean C6 source-DOM parse-custody replay; any further C5 domain requires a separate production dependency trace.