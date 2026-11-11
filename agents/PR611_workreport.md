# PR611 Work Report — C4b authoritative config revision routing

## Current state

```text
PR = 611
BRANCH = agent/xml-cii-c4b-config-routing-20260818-0759
BASE_MAIN = e93cf16b9670a9876135a659b4f26506857b2c36
WORK_INTENT = IMPLEMENT
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; minimum 19/20
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED_FOR_THIS NEW-STAGE PR
LATEST_CODE_CHECKPOINT = 0051fecec3ae2fa5d66668ad680a11c8e3be9d78
LATEST_BACKUP_CHECKPOINT = 1d5c609fd79dc7135c09e071eeec5bc2853f526b
```

## Handover in 60 Seconds

C4 dependency revisions landed via #608, but the active XML→CII Standalone UI still had authoritative config writes that bypassed `updateWorkflowState()`. The first PR611 pass covered four surfaces. A current-entrypoint trace then proved three additional active boundaries: Preview-v7 override publication, the single-model Run review used by Mode-A execution, and the Mode-A state replacement boundary itself.

PR611 now routes the complete bounded active graph:

1. Config → Save Config.
2. Weight Match V2 shared config save.
3. Bend Radius publication toggle.
4. Support Type Mapper shared table save.
5. Preview-v7 authoritative override/config saves.
6. Active Run review: rating refresh and applied rigid-weight overrides.
7. Mode-A central state replacement: preserve exact replacement payload while sourcing only dependency revision metadata from `updateWorkflowState()`.

No support/GAP interpretation, converter/writer formula, unit, topology, calculation, worker ownership, or result-publication authority changes.

## Ground truth / coordination

- base main: `e93cf16b9670a9876135a659b4f26506857b2c36` (#608).
- current tab entrypoint imports `xml-cii-adapted-workflow-shell-mode-a-easy-bulk-v6.js`; Mode A is active, not compatibility-only.
- Mode-A fast runner imports `runWorkflowFromUi` from `xml-cii-adapted-run-workflow-atta-default.js`; therefore Run review config writes are active for source-isolated execution.
- exact-file overlap with #605/#589 Node-140/support-gap production paths: none observed; semantic coordination remains negative-assurance only.
- #598/#599 remain salvage-only performance drafts; no exact-file dependency is accepted from them.
- contaminated bootstrap #610 is closed and not implementation authority.

## Root cause

`updateWorkflowState()` is the C4 transition authority. When `supportConfigJson` changes it synchronizes parsed config custody and advances `dependencyRevisions` deterministically. Direct state replacement or direct property assignment could mutate real engineering configuration while leaving `supportConfigRevision` / `branchLineMapRevision` stale, which makes C5 dependency-specific recomputation unsafe.

The original four-surface audit was incomplete because it did not follow the live Mode-A tab entrypoint far enough through Preview and batch Run orchestration.

## Implementation

### Direct save surfaces

For Config, Weight Match, Bend Radius, Support Mapper, Preview-v7 and Run review:

- retain the same config object/JSON and persistence intent;
- route the authoritative `supportConfigJson` transition through `updateWorkflowState()`;
- retain the returned dependency revision metadata;
- preserve existing master-context persistence and render/callback behavior.

### Mode-A boundary

`createXmlCiiModeAStateRef()` now routes replacement state through `updateWorkflowState(previous, replacement)` but deliberately copies back only:

```text
dependencyRevisions
dependencyRevisionBasis
```

onto the exact Mode-A replacement payload. This preserves source-batch/marker replacement semantics and prevents `updateWorkflowState()` from becoming a new owner of Mode-A payload shape.

## Authority / invariants

Protected and unchanged:

- `converters/scripts/inputxml_to_cii2019.py`;
- support/GAP classification, positional matching and restraint closure;
- CII writer/runtime ownership;
- engineering formulas and units;
- source topology and branch semantics;
- master-domain and Branch→Line exclusions already established by C4;
- no persisted derived index/revision metadata;
- no worker admission;
- no `.github/workflows/**` changes.

## Pre-edit backup evidence

All seven existing production targets were reconstructed from exact live-main bytes and hash-verified before editing. Repository `node utils/backup.js save ...` was executed before each edit.

Original blob custody:

```text
config.js                              de88aae8e69cf191bac77cfd6a2de6894b2d673f
weight-match-v2.js                     a21ed51a6992b61934c39e73cdea71989e5131c8
bend-radius-toggle.js                  4a956131c4047895c370b44baa61c8a55b4d9ffb
support-type-mapper.js                 c10c4bfae05638cb82bf13821608bfd79defe0bf
preview-diagnostics-audit-v7.js        3f3a00b6e8311c57a14717b0ed8e2f178ddaa6b9
run-workflow-atta-default.js           5fcb01407719a0f7dd7721f0aa6c8375a9f6feca
mode-a-state.js                        8caaad0bdcbc2bbde7a31957624b3c1136b8c360
utils/backup.js                        cd0c755457bb623b0487200a7d0b7217d8b3478e
```

`.backups/1..7_*` in this PR retain the original production bytes.

## Changed-file ledger

Production:

- `xml-cii-adapted-config.js`
- `xml-cii-adapted-weight-match-v2.js`
- `xml-cii-adapted-bend-radius-toggle.js`
- `xml-cii-adapted-support-type-mapper.js`
- `xml-cii-adapted-preview-diagnostics-audit-v7.js`
- `xml-cii-adapted-run-workflow-atta-default.js`
- `xml-cii-adapted-mode-a-state.js`

Regression:

- `tests/xml-cii-standalone-config-revision-routing.test.mjs`
- `tests/xml-cii-standalone-config-save-routing.test.mjs`
- `tests/xml-cii-standalone-mode-a-dependency-routing.test.mjs`
- existing C4 regression `tests/xml-cii-standalone-dependency-revisions.test.mjs` executed as an unchanged oracle.

Evidence/governance:

- `.backups/1..7_*`
- `agents/PR611_workreport.md`
- `agents/status/PR611.yaml`
- `agents/claims/PR611.yaml`

## Validation ledger

```text
pre-edit exact source blob verification       PASS / LOCAL_EXECUTION / 7 of 7
repository-native backup execution            PASS / LOCAL_EXECUTION / 7 of 7
node --check bounded production modules       PASS / LOCAL_EXECUTION
original C4b routing suite                     PASS / LOCAL_EXECUTION / 5 of 5
expanded active-save routing suite             PASS / LOCAL_EXECUTION / 4 of 4
existing C4 dependency revision suite          PASS / LOCAL_EXECUTION / 9 of 9
Mode-A dependency routing suite                PASS / LOCAL_EXECUTION / 2 of 2
combined focused validation                    PASS / LOCAL_EXECUTION / 20 of 20
remote code blob parity                        PASS for published expanded blobs
browser active-save lifecycle                  NOT_RUN
broader release/private-repo qualification     NOT_RUN
GitHub workflow/check state                    refresh required after final report commit
reviews/review threads                         refresh required after final report commit
mergeability                                   refresh required after final report commit
```

The 20/20 result is implementation-coupled focused evidence. It is not browser evidence and is not represented as independent engineering qualification.

## Falsifiers proven

- semantic no-op config saves do not advance dependency revisions;
- Branch→Line map advances its dedicated revision without broad support-config invalidation;
- master row/mapping-only changes remain excluded from broad support-config revision;
- both Run review config mutations route through C4 custody;
- Preview report-only state publication remains separate from config authority;
- normal Mode-A assignment preserves exact replacement payload while advancing source revision;
- `replaceModeAState()` strips the marker, preserves replacement payload and advances config revision.

## Appendix A — expanded-scope qualification

A1 Production Trace — 20/20. Traced current tab → Mode-A v6 shell → phase/event graph → Preview/Weight/Config surfaces and fast Run → single-workflow Run review.

A2 Failure Isolation — 19/20. Failure is transition-custody bypass, not C4 signature arithmetic; old four-surface audit was incomplete rather than numerically wrong.

A3 Authority / Invariant — 20/20. Dependency metadata only; support/GAP, writer, formula/unit and Mode-A payload authority remain unchanged.

A4 Independent Validation — 20/20. Four focused suites exercise original routing, expanded routing, C4 revision domains and Mode-A replacement semantics; browser remains explicit NOT_RUN.

A5 Minimal Patch — 19/20. Seven bounded production routing edits plus focused tests/backups; no worker/cache/formula/workflow expansion.

Total: 98/100; minimum 19/20.

## Risk register

- `RISK-C4B-01`: future save surfaces could bypass the state boundary. Mitigation: regression enumerates current active modules and current entrypoint trace is recorded.
- `RISK-C4B-02`: Mode-A state routing could accidentally change replacement payload. Mitigation: dynamic tests assert exact payload retention and metadata-only merge.
- `RISK-C4B-03`: browser event-order/render lifecycle remains unexecuted in this environment. Status remains NOT_RUN.
- `RISK-C4B-04`: revisions remain runtime metadata only; persistence of derived revision/index state is intentionally forbidden.

## EXACT_NEXT_ACTION

Refresh PR611 changed-file reconciliation, reviews/checks and mergeability at the final head. Leave unmerged unless the owner gives explicit authorization for PR611. Once C4b lands, continue Batch C with C5 dependency-specific Preview recomputation; worker admission remains blocked until real main-thread timing evidence justifies it.
