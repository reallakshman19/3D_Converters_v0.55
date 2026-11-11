# WIP-XMLCII-C4REV-20260818 — C4 revision-keyed dependency custody

## Current state

```text
STACK_BASE = PR603 / 0dc15b701fa82182d75409e0a1b4c1866c6f1ae6
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; min 18/20
C3_WORKER_ADMISSION = NOT_ADMITTED / NO REAL MAIN-THREAD TIMING EVIDENCE
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement **C4 revision-keyed computation custody** as behavior-neutral infrastructure. This work pack creates explicit revision keys and deterministic bump semantics; it does **not** yet assign production computations to dependency sets. Calculation-specific declarations belong in C5 after their actual production inputs are traced.

Required revision keys:

```text
sourceModelRevision
lineListAppliedRevision
pipingClassAppliedRevision
materialAppliedRevision
weightAppliedRevision
supportConfigRevision
branchLineMapRevision
```

## Grounded authority trace

- `sourceText` is the authoritative loaded/editable source model text.
- Batch A owns APPLIED master revisions in `masterContext.appliedMappingRevision` and changes normalized row array identities only at import/Apply/clear boundaries.
- support configuration authority is `supportConfigJson`.
- Branch→Line mapping authority is exactly `config.linelist.branchLineKeyMap`; the branch mapping panel saves only that map then invokes the existing config-save callback.
- DRAFT mapping changes retain normalized row references and APPLIED revisions and therefore must not change dependency revisions.

## C3 gate

Workers are still **NOT_ADMITTED**. Real browser/main-thread timing is unavailable, so no XLSX/XML/JSON worker or runtime-owner switch is introduced in this work pack.

## Appendix A

```text
A1 source/master/config production trace         20/20
A2 current broad-invalidation problem isolate    20/20
A3 authority + monotonic revision invariants     20/20
A4 focused quantitative validation               18/20
A5 minimal central integration / falsifier        20/20
TOTAL                                              98/100
```

A4 is limited by absent browser/integrated computation timing; this is retained as NOT_RUN, not inferred PASS.

## Pre-edit backup

Existing C4 target is only `xml-cii-adapted-state.js`.

Exact current stack blob was verified locally:

`644643466187c6257b83facb0367480effd4dd7b`

Exact backup utility:

`cd0c755457bb623b0487200a7d0b7217d8b3478e`

Mandatory backup #7 succeeded before the C4 edit.

## Design

New pure module `xml-cii-adapted-dependency-revisions.js`:

- owns the seven public revision keys;
- stores monotonic revision counters plus derived non-persisted basis metadata;
- source revision bumps only when exact `sourceText` changes;
- support-config revision bumps only when `supportConfigJson` text changes;
- Branch→Line revision compares a stable canonical signature of `linelist.branchLineKeyMap` only;
- each master revision bumps only when its normalized APPLIED row-array identity or APPLIED mapping revision changes;
- DRAFT-only mapping contexts therefore do not bump;
- dependency keys can be composed from selected revisions without declaring a computation.

Central state integration:

- initial workflow state receives revision ledger/basis;
- `updateWorkflowState()` advances the ledger after each state transition;
- a support-config transition is parsed once in this boundary and that parsed object is reused for master-config synchronization and Branch→Line signature custody;
- no derived revision/index data is persisted.

## Local validation

Focused suite: **8/8 PASS**.

Proved:

- initial empty source/master/branch revisions;
- DRAFT-only mapping -> zero revision changes;
- source edit -> source revision only;
- Branch→Line change -> support-config + branch-map revisions only;
- unrelated support-config change -> support-config revision, branch-map unchanged;
- Weight Master authority change -> weight revision only;
- selected key `[sourceModelRevision,lineListAppliedRevision,branchLineMapRevision]` stays identical across Weight Master change;
- Line List Apply -> line-list revision only among master revisions;
- static state integration owns initialization/advancement centrally.

Classification: `PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`.
Real browser/computation invalidation evidence: `NOT_RUN`.

## Negative assurance

No resolver output, engineering formula, support/GAP semantic, CII writer/runtime, worker, persisted index/cache, units, source parsing behavior or result-publication behavior is changed. Revision metadata is observational/invalidation infrastructure only.

## Falsifier

Any DRAFT-only edit changes a dependency revision; Weight Master changes line/source/branch revisions; Branch→Line map edits fail to increment their dedicated revision; or revision metadata becomes persisted/authoritative engineering input.

## EXACT_NEXT_ACTION

Publish the locally tested dependency-revision module + surgical state integration + focused tests, reconcile the stacked diff, and open a draft PR based on PR603. C5 computation-specific dependency declarations remain a separate work pack.