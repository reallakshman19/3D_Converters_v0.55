# WIP-781-LINELIST-INTEGRATION-V2-20260930

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED
ISSUE: #781
BRANCH: agent/issue-781-linelist-integration-v2-20260930
REPORT_BASIS_HEAD: 961a1feb93387bc453d73b402d93467e4a3eddb7
LIVE_MAIN_LAST_CHECKED: 3976929fd0d012fae5c3bf4014eb10af7e8ab332
PROTOCOL: V3.1 / Common@1ced68258afeaf50df113b1d38a4ceb9193587e3
CRITICALITY: ENGINEERING_CRITICAL
CURRENT_STAGE: IMPLEMENT
HIGHEST_RISK: breaking APPLIED-vs-DRAFT mapping authority while repairing restored-session remap and mapping quality
EXACT_NEXT_ACTION: apply bounded header-band mapping to worker + UI auto-map, recover remap raw basis from persisted normalized _raw rows, make restored sheet switch explicit, add regressions, validate, PR, merge with owner authorization.
```

## Diagnosis

- Draft mapping and Preview intentionally use different authorities until Apply succeeds.
- Persisted dataset remap can fail because worker `rawRows` is session-only even though normalized Line List rows persist `_raw` source rows.
- Restored sheet selector can silently no-op because workbook source/job custody is session-only.
- Current 4/5-row semantic probing is too shallow for the reported multi-row Line List header band.

## Protected invariants

- Preview and calculations remain APPLIED-only.
- Draft edits never self-promote.
- Apply creates one new dataset/revision atomically.
- No full workbook/raw duplicate persistence is introduced.
- Worker remains dataset normalization/remap owner.
- Source/docs mirrors remain byte-aligned.

## Acceptance

Reported layout resolves to the expected `__EMPTY_*` map, generic density and line sequence stay unmapped, post-reload Apply succeeds from persisted `_raw` rows, and post-reload worksheet switching never silently pretends to work.

## Validation ledger

- native pre-edit backup: PASS
- real-layout mapping regression: NOT_RUN
- restored remap regression: NOT_RUN
- restored sheet capability regression: NOT_RUN
- Issue #776 exact-head authority workflow: NOT_RUN
- browser WSW + scale: NOT_RUN
