# PR656 — Compact USER_CALCULATED_KD3 Review Work Report

## Recovery header

- PR: #656
- TITLE: `feat(hp): compact USER_CALCULATED_KD3 review workflow`
- BRANCH: `agent/hp-kd-review-compact`
- BASE: `main@95ee50ff78d81465f3e4968f62767d866f8b9da8`
- CRITICALITY: ENGINEERING_CRITICAL
- PR_STATE: OPEN_DRAFT_HANDOVER_READY
- BACKUP: `backup/hp-kd-review-compact-pre-edit-20260819`
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_SUCCESSOR

## Handover in 60 seconds

This is the product-focused successor after PR651. It deliberately reduces evidence prominence instead of adding more evidence surfaces.

KD Review primary table:

```text
Cycle | state pair | location | CORE Salt | user Salt | external Seq | external N | applied n | Ui=n/N | status
```

Per-row Code/Edition/Method/Calculation-ref/author/check custody remains in the same project model but is rendered in a collapsed audit section.

Productivity:

- `Add all governed cycles` creates every uncovered cycle row from the governed transient spectrum.
- `Copy first-row basis to all cycles` deep-copies only `calculationBasis`.
- It never copies cycle ID, state pair, location, Salt, Seq, N or usage.

## Authority boundary

```text
calculationMode            USER_CALCULATED_KD3
nativeCoreKd3Qualified     false
codeCompliance             false
canUseForDesignAuthority   false
```

No numerical kernel, HP project schema, Q1/Q2 evidence contract, fatigue curve, master table or workflow file is changed.

## Validation

| Check | Result |
|---|---|
| Base/main drift | PASS — main remained `95ee50ff...` through implementation |
| Productivity helper | PASS 3/3 — LOCAL_EXECUTION / IMPLEMENTATION_COUPLED |
| Basis-copy negative assurance | PASS — cycle/location/Seq/N unchanged |
| Compact UI contract | PASS — SOURCE_INSPECTION |
| Workbench diff normalization | PASS — `+36/-34` after rebuilding from exact base blob |
| Non-KD workbench preservation | PASS — GITHUB_PATCH_INSPECTION |
| Changed-file reconciliation | PASS — 11/11 expected paths |
| GitHub mergeability | PASS — mergeable at pre-recovery head |
| Commit statuses | NOT_RUN — 0 statuses |
| PR workflow runs | NOT_RUN — 0 runs |
| Reviews / review threads | 0 / 0 |
| Full repository-native tests | NOT_RUN / ENVIRONMENT_BLOCKED |
| Workbench module graph execution | NOT_RUN / ENVIRONMENT_BLOCKED |
| Served browser acceptance | NOT_RUN |

No unexecuted check is represented as PASS.

## Coordination

PR649 also touches `tabs/engineering-workspace-tab.js`. Its intended change is the Calculations loader cache identity; PR656 changes only the HP Piping Class loader cache identity and preserves the merged KD evidence loader. If PR649 later merges, it must re-ground and preserve this HP cache identity.

## Changed product files

- `tabs/hp-piping-class-kd-productivity.js`
- `tabs/hp-piping-class-workbench-tab.js`
- `tabs/engineering-workspace-tab.js`
- `tests/hp-piping-class-kd-productivity.test.mjs`
- `tests/hp-piping-class-kd-compact-ui.test.mjs`

Recovery artifacts are the PR656 and WIP workreport/status/claim files.

## EXACT_NEXT_ACTION

Leave PR656 draft/unmerged. On owner merge authorization, re-ground current `main` and PR649 coordination, refresh mergeability/status/workflow truth on the then-current head, and merge only if the HP cache identity and authority boundaries remain intact.
