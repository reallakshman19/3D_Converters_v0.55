# WIP-XMLCII-C1C7-20260818 — XML→CII Standalone C1/C7 replay

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR_HEAD_OBSERVED: cac7fbc191ebf630b284b63d17abda9364ddfcfb
REPORT_BASIS_HEAD: cac7fbc191ebf630b284b63d17abda9364ddfcfb
MAIN_HEAD_LAST_CHECKED: 00a3296f4b860ab1acb49ed690a4122122394d56
STACK_BASE: PR601 / cac7fbc191ebf630b284b63d17abda9364ddfcfb
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: CURRENT
GROUNDING_EPOCH: GE-XMLCII-C1C7-001
CURRENT_STAGE: C1/C7 clean implementation replay
CURRENT_BLOCKER: browser acceptance unavailable in current execution environment
HIGHEST_RISK: an over-broad partial-render classifier could suppress a required authority/UI refresh
EXACT_NEXT_ACTION: publish the locally syntax-tested surgical C1/C7 modules and focused regressions, reconcile the stacked diff, then open a draft PR based on PR601
```

## Governing protocol

Owner-pinned delivery skill:

`reallaksh19/Common@3fe20c7db76feb6ea583fb658b67b3a55afd4fe3/skills/engineering-pr-delivery`

Repository policies: root `AGENTS.md`, `.agents/AGENTS.md`.

## Dependency / recovery lineage

```text
PR595 -> closed / superseded salvage
PR601 -> clean Batch-A replay / open draft / mergeable
PR596 -> salvage-only C1/C7 evidence
this WIP -> clean C1/C7 replay stacked on PR601
```

PR596 is not merge-qualified because its existing-file edits were made without mandatory pre-edit backups. Its design and focused tests are salvage evidence only.

## Mission

Replay only:

- **C1 incremental UI rendering** for mapping DRAFT-only state;
- **C7 aggregate performance evidence** under `?perf=1` / explicit perf flag.

Target:

```text
visible mapping DRAFT-only change:
  APPLIED authority change = 0
  normalization = 0
  persistence = 0
  full workspace render = 0
  local master DOM sync = 1

Apply/import/config/row/revision/source-authority changes:
  full workspace render = required
```

## Explicit non-goals

- no preview virtualization;
- no search corpus/index work;
- no source DOM cache;
- no worker/runtime owner switch;
- no revision graph or dependency-specific recompute;
- no support/GAP semantic change;
- no CII writer/core change;
- no workflow-file change.

## Appendix A — C1/C7 implementation authorization

```text
A1 render production trace / event custody       20/20
A2 current full-render defect isolation          20/20
A3 APPLIED/DRAFT authority & fail-closed proof   20/20
A4 independent/focused validation design         18/20
A5 minimal surgical patch / falsifier            20/20
TOTAL                                              98/100
minimum per challenge                              PASS (>=17)
```

A4 is limited by lack of an executable real-browser environment; this is recorded as NOT_RUN rather than inferred PASS.

## Pre-edit backup evidence

C1 edits exactly two existing files on the PR601 stack:

```text
xml-cii-adapted-perf.js            edf376ca9381dae3c3a8d7ef4c4cf69fe99b21fd
xml-cii-adapted-workflow-shell.js  c0c2910e897efedc8b5dd8e597e19c63b4281b87
```

The first C1 backup attempt failed before any edit because the offline reconstructed `utils/backup.js` contained a duplicate CLI block. That was treated as `FAIL/NOT_RUN`, not bypassed. The local utility was corrected to the exact repository blob:

```text
utils/backup.js = cd0c755457bb623b0487200a7d0b7217d8b3478e
node --check utils/backup.js = PASS
```

Then, before C1 edits, the mandated commands succeeded:

```text
backup #4: xml-cii-adapted-perf.js
backup #5: xml-cii-adapted-workflow-shell.js
```

## Implementation design

### Fail-closed render classifier

Partial rendering is allowed only when:

1. previous and next state both exist;
2. all non-draft top-level state retains identity;
3. parsed config identity is unchanged;
4. normalized master-row identities are unchanged;
5. each raw master-row array identity is unchanged;
6. every APPLIED mapping revision is unchanged;
7. source metadata, row counts, preview rows, workbook/sheet/diagnostic authority retain identity;
8. exactly one mapping draft changed;
9. that master is the currently visible Source/Masters sub-tab.

Anything else -> full render.

### Local DOM sync

The local sync may update only:

- mapping custody/status text;
- mapping-health summary;
- mapping dropdown selected values;
- Apply/Discard enabled state;
- master write-back status text.

It cannot normalize rows, persist masters, increment applied revision or publish calculation/output state.

### Perf evidence

Aggregate counters/timings only. No row-level engineering trace, candidate IDs or result authority is exposed. Production display is absent unless perf mode is explicitly enabled.

## Local validation

Focused C1 tests executed after mandatory backups and local replay:

```text
node --test render-scope + master-dom-sync + perf-evidence
8 tests / 8 PASS / 0 FAIL
```

Validation classification:

- render-scope tests: PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED;
- DOM sync: PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED, with minimal local fields/DOM stubs;
- perf evidence formatting: PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED, with minimal DOM stub;
- real browser event lifecycle: NOT_RUN.

## Surgical replay decision

Unlike PR596, the replacement `workflow-shell.js` retains existing whitespace/comments/diagnostic behavior and changes only:

- required C1/C7 imports;
- scroll capture/restore extraction needed by the render gate;
- fail-closed partial-render dispatch and actual render counters;
- perf evidence panel mount.

No `createMastersBadge`, diagnostics, phase-button or other unrelated cleanup is replayed.

## Planned changed files

Production:

- `xml-cii-adapted-workflow-shell.js` (existing, surgical)
- `xml-cii-adapted-perf.js` (existing on PR601 stack)
- `xml-cii-adapted-render-scope.js` (new)
- `xml-cii-adapted-master-dom-sync.js` (new)
- `xml-cii-adapted-perf-evidence.js` (new)

Regression:

- `tests/xml-cii-standalone-render-scope.test.mjs`
- `tests/xml-cii-standalone-master-dom-sync.test.mjs`
- `tests/xml-cii-standalone-perf-evidence.test.mjs`

Recovery metadata: this WIP + status/claim, later migrated to PR number.

## Hypothesis / falsifier

Hypothesis: DRAFT-only mapping actions can update the visible master controls locally with zero full workspace reconstruction while APPLIED/config/row/source authority changes remain fail-closed to full rendering.

Falsifier: any partial path changes engineering authority, misses a required visible control update, retains stale state after Apply/import/config change, or classifies any applied-revision/config/row/raw-source change as partial.

## Merge authority

`OWNER_ONLY / NOT_GRANTED`. This WIP and its future PR remain draft.