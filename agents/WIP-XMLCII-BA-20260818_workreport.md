# WIP-XMLCII-BA-20260818 — XML→CII Standalone Performance Batch A replay

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR_HEAD_OBSERVED: 00a3296f4b860ab1acb49ed690a4122122394d56
REPORT_BASIS_HEAD: 00a3296f4b860ab1acb49ed690a4122122394d56
MAIN_HEAD_LAST_CHECKED: 00a3296f4b860ab1acb49ed690a4122122394d56
MERGE_BASE: 00a3296f4b860ab1acb49ed690a4122122394d56
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: CURRENT
GROUNDING_EPOCH: GE-XMLCII-BA-001
LAST_DURABLE_CHECKPOINT: WIP bootstrap before production replay
CURRENT_STAGE: Batch A implementation replay
CURRENT_BLOCKER: none for bounded Batch A replay
HIGHEST_RISK: draft mapping state accidentally becoming calculation/Preview authority before Apply
EXACT_NEXT_ACTION: replay the audited Batch-A production delta from main, execute focused authority/restart tests, reconcile changed files, then open a draft superseding PR
```

## Governing delivery protocol

Pinned owner-selected skill:

`reallaksh19/Common@3fe20c7db76feb6ea583fb658b67b3a55afd4fe3/skills/engineering-pr-delivery`

Repository policies: root `AGENTS.md` and `.agents/AGENTS.md`.

## Mission

Replay only **Batch A — eliminate unnecessary work** from a clean current-main basis:

- parse support config once per explicit boundary where practical;
- separate mapping DRAFT from APPLIED engineering/Preview authority;
- normalize only on import or explicit Apply;
- persist only the changed master;
- instrument operation counts and timings;
- restore all four master types with applied mapping/revision custody;
- keep cached parsed config synchronized when authoritative `supportConfigJson` changes.

## Explicit non-goals

- no indexed resolver layer;
- no master-table virtualization;
- no worker/runtime-owner switch;
- no source-DOM parse cache;
- no support/GAP semantic reinterpretation;
- no CII writer changes;
- no workflow-file changes;
- no change to `converters/scripts/inputxml_to_cii2019.py`.

## Recovery decision — REC-XMLCII-BA-001

Predecessor: PR #595, `SALVAGE_PARTIAL`.

Decision: **SUPERSEDE by clean replay from current main**.

Reason: PR #595's implementation intent is understandable, but its existing-file edits were made without the repository-mandated pre-edit backup operation. Earlier unauthorized performance workflows were removed, but that original backup breach cannot be repaired retroactively.

Salvaged evidence:

- DRAFT/APPLIED state model;
- changed-master persistence design;
- four-master restart custody design;
- aggregate performance instrumentation design;
- focused regression tests.

Rejected from replay:

- workflow history;
- predecessor recovery metadata as current authority;
- unrelated formatting/refactor churn in `xml-cii-adapted-state.js`.

## Grounding epoch — GE-XMLCII-BA-001

```text
verified_at: 2026-08-18 Asia/Muscat session
main: 00a3296f4b860ab1acb49ed690a4122122394d56
predecessor PR595: open / draft / unmerged / salvage-only
PR589: open draft; no exact-file overlap, semantic support/GAP coordination retained
PR597: open draft; no exact-file overlap with Batch-A production files
workflow modifications: prohibited / none planned
merge authority: OWNER_ONLY / NOT_GRANTED
```

## Appendix A takeover qualification

```text
A1 Production Trace                 20/20
A2 Failure / repeated-work isolate  18/20
A3 Authority / invariant            20/20
A4 Independent validation plan      18/20
A5 Minimal replay / falsifier       20/20
TOTAL                                96/100
minimum per challenge                PASS (>=17)
```

Implementation authority: `WRITE_ALLOWED` for the bounded Batch-A mission only.

## Baseline finding

Current-main mapping dropdown flow normalizes and persists on every edit. Ten Line List dropdown edits therefore perform 10 normalization passes and up to 20 master/raw persistence operations before an explicit Apply boundary.

Batch-A target:

```text
10 draft dropdown edits:
  normalization = 0
  master persistence = 0
  APPLIED revision change = 0

Apply changed master:
  normalization = 1
  changed-master persistence commit = 1
  unrelated-master persistence = 0
  APPLIED revision increment = 1
```

## Pre-edit backup evidence

The three existing Batch-A production targets were reconstructed from exact live-main blob bytes and their Git blob identities were verified before editing:

```text
xml-cii-adapted-import-masters.js  ace0ce2bf57f55ef95e0e8f64eeae8c2d849ef95
xml-cii-adapted-master-events.js   87665fbd56a956adad795596c26eb7863ffd9c75
xml-cii-adapted-state.js           717c7b0df608301e90f4db997682041be1e8a05d
```

The mandated commands were executed against those verified target bytes:

```text
node utils/backup.js save tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js "Batch A superseding replay from main 00a3296 before edit"
node utils/backup.js save tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js "Batch A superseding replay from main 00a3296 before edit"
node utils/backup.js save tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js "Batch A superseding replay from main 00a3296 before edit"
```

Execution observation: `LOCAL_EXECUTION`, three successful backup receipts. Limitation: the offline workspace reconstructs `utils/backup.js` from repository source; target-file blob identity is proven, but local utility byte identity is not claimed.

## Validation ledger

| Check | Status | Observation | Oracle | Result / limitation |
|---|---|---|---|---|
| runtime/perf JS syntax | PASS | LOCAL_EXECUTION | implementation-coupled | `node --check` passed |
| surgical state JS syntax | PASS | LOCAL_EXECUTION | implementation-coupled | `node --check` passed |
| 10 draft edits: zero persistence, no APPLIED revision change | PASS | LOCAL_EXECUTION | implementation-coupled | 100,000-row synthetic context |
| Apply once + idempotent changed-master persistence | PASS | LOCAL_EXECUTION | implementation-coupled | 6 custody writes first persist, 0 repeat writes |
| cached config synchronization | PASS | LOCAL_EXECUTION | implementation-coupled | authoritative JSON replaces cached config while rows remain |
| four-master restart + applied revision custody | PASS | LOCAL_EXECUTION | implementation-coupled | line/piping/material/weight restored |
| integrated browser flow | NOT_RUN | NOT_OBSERVED | NONE | required after branch publication |
| support/GAP semantic equivalence | NOT_RUN | NOT_OBSERVED | NONE | must execute or remain NOT_RUN |

## Authority / invariants

Intentionally changed:

- mapping dropdown/saved-map/Auto Map produce DRAFT mapping state;
- only import/Apply changes normalized rows and APPLIED revision;
- persistence becomes changed-master-only;
- Piping Class receives the same persistence/restart custody as other masters;
- aggregate operation/timing counters become available.

Must remain invariant:

- support/GAP classification and numerical semantics;
- CII writer/runtime ownership;
- line/process/weight engineering resolution results for the same APPLIED inputs;
- units and sign conventions;
- immutable InputXML→CII core.

## Current hypothesis / falsifier

Hypothesis: removing pre-Apply normalization/persistence eliminates the dominant repeated master-edit work while preserving numerical/semantic identity because Preview and downstream resolvers continue to consume APPLIED mapping/rows only.

Falsifier: any draft-only edit changes APPLIED config/rows/revision, writes authoritative master storage, changes qualified support/GAP output, or cannot be cleanly restored/replayed after restart.

## Planned changed-file ledger

Production:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js` (new)
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js` (new)

Regression:

- `tests/xml-cii-standalone-master-perf.test.mjs`
- `tests/xml-cii-standalone-config-cache-custody.test.mjs`
- `tests/xml-cii-standalone-support-gap-equivalence.test.mjs`

Recovery metadata:

- this WIP work report;
- corresponding WIP status/claim records.

No `.github/workflows/**` path is authorized.
