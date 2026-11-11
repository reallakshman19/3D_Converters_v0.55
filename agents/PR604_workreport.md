# PR604 Work Report — C4 revision-keyed dependency custody

## Current state

```text
PR = 604
BRANCH = agent/xml-cii-c4-dependency-revisions-20260818
STACK_BASE = PR603 / agent/xml-cii-c2-virtual-preview-20260818
REPORT_BASIS_HEAD = cc37039591583a05273e15a09d7f221bd056a815
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
TAKEOVER_AUTHORITY = WRITE_ALLOWED
APPENDIX_A = 98/100; min 18/20
MERGEABLE = true
DRAFT = true
C3_WORKER_ADMISSION = NOT_ADMITTED
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Establish behavior-neutral explicit revision custody for future dependency-specific computation invalidation. This PR does not yet assign named production computations to dependency sets.

Public revision keys:

- `sourceModelRevision`
- `lineListAppliedRevision`
- `pipingClassAppliedRevision`
- `materialAppliedRevision`
- `weightAppliedRevision`
- `supportConfigRevision`
- `branchLineMapRevision`

## Authority trace

- source: exact `sourceText`;
- master authority: normalized APPLIED row identity + Batch-A APPLIED mapping revision;
- general support/process/override config: canonical `supportConfigJson` signature excluding independently versioned master rows/field maps and Branch→Line map;
- Branch→Line map: `config.linelist.branchLineKeyMap`.

DRAFT mapping state is explicitly excluded from revision authority.

## Implementation

`xml-cii-adapted-dependency-revisions.js` owns the revision ledger and non-persisted basis metadata. `updateWorkflowState()` initializes/advances the ledger centrally. Support-config transitions are parsed once at the state boundary and that parsed object is reused for cached master-config sync plus branch-map signature custody.

No revision metadata is persisted.

## Mandatory backup / byte custody

Existing state target before edit:

`644643466187c6257b83facb0367480effd4dd7b`

Mandatory backup #7 executed with exact repo backup utility `cd0c755457bb623b0487200a7d0b7217d8b3478e` before edit.

Published state blob exactly matches local tested blob:

`ad1f8120247129780dceac64ade1c7af39354f34`

Published dependency module after C5-trace correction:

`465a007d3d7a6e63a79258f25a9a9ba4284a2f4c`

Correction custody: dependency module backup #8; exact remote dependency-test baseline backup #10. A scratch non-exact test restoration was rejected and never published.

## Validation ledger

```text
focused revision suite                      PASS 10/10 / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
DRAFT-only edit => zero revisions           PASS
source edit => source only                   PASS
branch-map edit => branch only               PASS
unrelated support config => support only     PASS
Weight authority/config embedding => weight only; support unchanged PASS
master rows/field maps excluded from support signature PASS
Line List Apply => line-list only            PASS
selected source+line+branch key vs Weight    PASS / unchanged
state integration static check               PASS
stacked changed-file reconciliation          PASS / REMOTE_EXECUTION / exactly 7 paths
mergeability                                 PASS / REMOTE_EXECUTION / true
real browser/computation invalidation        NOT_RUN
PR checks                                    NOT_RUN / none observed yet
```

No NOT_RUN item is represented as PASS.

## C3 worker gate

Workers remain NOT_ADMITTED. This repository session still has no real browser/main-thread stall measurement; no XLSX/XML/JSON worker or runtime-owner switch is justified.

## Negative assurance

No engineering result/formula, support/GAP semantics, CII writer/runtime, source parser behavior, workers, persisted indexes/caches, units or result-publication authority changed.

## Hypothesis / falsifier

Hypothesis: explicit revisions can later scope recomputation without changing current result semantics.

Falsifier: draft changes bump revisions, Weight/master embedding bumps support/source/line/branch revisions, Branch→Line changes fail to bump branch revision, or revision metadata becomes persistent engineering authority.

## EXACT_NEXT_ACTION

Keep PR604 draft. Ground C5 against the actual Preview computation graph; only after tracing each production computation may dependency sets and incremental recomputation be introduced.
