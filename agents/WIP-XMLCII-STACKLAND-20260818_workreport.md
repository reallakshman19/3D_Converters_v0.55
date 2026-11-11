# WIP-XMLCII-STACKLAND-20260818 — qualified post-Batch-A stack landing

## Basis

```text
MAIN = e94ee8989d0f42d0a4d770ebb8ed6044eefb5f69
MAIN_TREE = 309d75671a8655d5c85bfb1257eb6a13374055b3
PR601_HEAD_TREE = 309d75671a8655d5c85bfb1257eb6a13374055b3
QUALIFIED_FINAL_SOURCE = PR607 / f7fb087179c4b80275b3afdb0f361a11255d3996
QUALIFIED_FINAL_TREE = 090283c05291ac3f8883497b6e2c5834eaa7e673
CRITICALITY = ENGINEERING_CRITICAL
MERGE_AUTHORITY = OWNER_GRANTED_2026-08-18
C3_WORKERS = NOT_ADMITTED
```

## Why this landing PR exists

The repository permits squash merges only. PR #601 was therefore squash-merged to main. Retargeting stacked PR #602 to main broke ancestry even though the Batch-A tree is byte-identical, so the remaining stack cannot be safely merged one PR at a time without cumulative/conflicting squashes.

This landing does not create new behavior. It moves current main from the exact #601 tree to the already-qualified final #607 tree, preserving the existing qualified blobs byte-for-byte. Provenance remains in PRs #602, #603, #604, #606 and #607.

## Backup provenance

No new implementation edit is introduced here. Existing-file bytes in the final tree are the exact blobs already edited under their stage backup gates:

- C1/C7: backups #4–#5;
- C2: backup #6;
- C4: backup #7 plus correction backups/receipts recorded in PR #604;
- C5a: backups #14–#15;
- C6: backups #16–#19.

New modules/tests require no pre-edit backup. Current main tree equals the original PR601 head tree exactly, so there is no unqualified intermediate basis.

## Qualification provenance

```text
C1/C7 = 8/8 PASS, LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
C2    = 5/5 PASS, including 100000 rows and <=60 physical rows
C4    = 10/10 PASS after revision-ledger correction
C5a   = 6/6 PASS
C6    = 6/6 PASS
browser/full private-repo qualification = NOT_RUN
```

No NOT_RUN item is represented as PASS.

## Appendix A — landing/recovery authorization

```text
A1 live-main/tree identity and ancestry diagnosis       20/20
A2 qualified final-tree provenance                     20/20
A3 backup/authority preservation                       20/20
A4 diff/negative-assurance verification plan           20/20
A5 squash-only landing and rollback strategy           20/20
TOTAL                                                  100/100
```

## Negative assurance

No workflow files; no Node-140/#605 restraint closure; no support/GAP semantic change; no CII writer/runtime change; no worker admission; no formula/unit/result-publication change. PR #605 remains independent and must not be merged as part of this landing.

## Acceptance gate

Before merge, the landing PR changed-file set must equal the difference between current #601 main tree and the final #607 tree plus these landing recovery records. Any `.github/workflows/**` or `xml-cii-mds-restraint-closure.js` path is a blocker.
