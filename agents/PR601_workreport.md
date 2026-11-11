# PR601 Work Report — XML→CII Standalone Performance Batch A clean replay

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR_HEAD_OBSERVED: 8c3cce7ffa90512ba96e147312a50fbc996ca1a1
REPORT_BASIS_HEAD: 8c3cce7ffa90512ba96e147312a50fbc996ca1a1
MAIN_HEAD_LAST_CHECKED: 00a3296f4b860ab1acb49ed690a4122122394d56
MERGE_BASE: 00a3296f4b860ab1acb49ed690a4122122394d56
REPORT_SYNC: CURRENT
APPENDIX_A_STATUS: CURRENT
GROUNDING_EPOCH: GE-XMLCII-BA-002
LAST_DURABLE_CHECKPOINT: production/test replay commit 8c3cce7f
CURRENT_STAGE: integrated qualification / PR reconciliation
CURRENT_BLOCKER: no PR-triggered workflow run observed; browser and support/GAP equivalence remain NOT_RUN
HIGHEST_RISK: draft mapping state accidentally becoming APPLIED engineering authority before Apply
EXACT_NEXT_ACTION: execute all available integrated checks without adding workflows, reconcile mergeability/reviews, then close predecessor PR595 only after this replacement remains recoverable
```

## Governing delivery protocol

Owner-pinned skill: `reallaksh19/Common@3fe20c7db76feb6ea583fb658b67b3a55afd4fe3/skills/engineering-pr-delivery`.

Repository policy: root `AGENTS.md` plus `.agents/AGENTS.md`.

## Mission and scope

Batch A only:

1. config parse once per explicit boundary where practical;
2. mapping DRAFT vs APPLIED custody;
3. normalize only at import / explicit Apply;
4. changed-master-only persistence;
5. operation/timing instrumentation;
6. restart/authority correctness for Line List, Piping Class, Material and Weight masters.

Explicit exclusions: workers, indexes, virtualization, source parse cache, new engineering formulas, support/GAP reinterpretation, CII writer changes, workflow changes, immutable InputXML→CII core changes.

## Recovery lineage

```text
PR595 = predecessor salvage evidence only
PR601 = clean superseding implementation replay
```

PR595 is not merge-qualified because its original existing-file edits violated mandatory pre-edit backup policy. Its design/test evidence was selectively salvaged; unrelated state-file formatting and all workflow history were rejected.

## Grounding epoch — GE-XMLCII-BA-002

```text
PR: 601
state: open / draft / unmerged
head: 8c3cce7ffa90512ba96e147312a50fbc996ca1a1
base/main: 00a3296f4b860ab1acb49ed690a4122122394d56
compare: ahead 4 / behind 0
changed files: 11, all reconciled
workflow paths in diff: 0
immutable inputxml_to_cii2019.py in diff: no
PR589 exact-file overlap: none; semantic equivalence coordination retained
PR597 exact-file overlap: none
merge authority: OWNER_ONLY / NOT_GRANTED
```

GitHub initially returned `mergeable=false`; because compare shows a clean ahead-only lineage, this is retained as a live-state item requiring re-check rather than interpreted as a conflict or PASS.

## Appendix A

```text
A1 Production Trace                 20/20
A2 Failure / repeated-work isolate  18/20
A3 Authority / invariant            20/20
A4 Independent validation plan      18/20
A5 Minimal replay / falsifier       20/20
TOTAL                                96/100
```

## Implementation

### Mapping custody

- mapping select changes stage a draft only;
- Auto Map stages a draft only;
- saved mappings are staged rather than applied;
- Preview header/column authority uses APPLIED mapping;
- explicit Apply normalizes current raw rows, commits the field map, increments one applied revision and persists that master;
- Discard removes only the draft.

### Persistence / restart

- changed master owns six persisted custody keys: normalized rows, raw rows, compact source/mapping/revision custody, sheet names, active sheet and workbook data;
- persistence compares serialized bytes and skips unchanged writes;
- Piping Class is restored from the same dedicated custody model as Line List, Material and Weight;
- backward-compatible legacy source strings remain readable;
- derived indexes are not persisted.

### Config cache

When an authoritative state transition supplies `supportConfigJson`, `masterContext.config` is synchronized from that exact JSON. Non-config state changes preserve config object identity.

### Instrumentation

Counters/timers cover config parses, imports, mapping drafts/applies, normalized rows, persistence commits/writes, requested full renders, ArrayBuffer, XLSX read, sheet-to-JSON, normalization and persistence time.

## Changed-file ledger

Production:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js` (new)
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-perf.js` (new)
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js`

Regression:

- `tests/xml-cii-standalone-master-perf.test.mjs`
- `tests/xml-cii-standalone-config-cache-custody.test.mjs`
- `tests/xml-cii-standalone-support-gap-equivalence.test.mjs`

Recovery metadata:

- WIP bootstrap report/status/claim;
- PR601 report/status/claim migration.

No other path is explained or authorized.

## Pre-edit backup evidence

Verified live-main target blobs before edit:

```text
import-masters  ace0ce2bf57f55ef95e0e8f64eeae8c2d849ef95
master-events   87665fbd56a956adad795596c26eb7863ffd9c75
state           717c7b0df608301e90f4db997682041be1e8a05d
```

`node utils/backup.js save ...` was executed successfully for all three verified targets before replay. Offline reconstruction limitation: target byte identity is proven; local backup-utility byte identity is not claimed.

The final surgical state replay blob is `644643466187c6257b83facb0367480effd4dd7b`, exactly matching the locally syntax-tested file.

## Validation ledger

| ID | Check | Status | Observation | Oracle | Basis/result |
|---|---|---|---|---|---|
| VAL-A01 | runtime/perf syntax | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | `node --check` |
| VAL-A02 | surgical state syntax | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | `node --check` |
| VAL-A03 | 100k rows, 10 mapping drafts | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | 10 drafts; 0 storage writes; applied revision unchanged |
| VAL-A04 | explicit commit + persistence | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | revision +1; first persist 6 keys; repeat 0 writes |
| VAL-A05 | config cache synchronization | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | cached config updates only on supportConfigJson transition |
| VAL-A06 | four-master restart custody | PASS | LOCAL_EXECUTION | IMPLEMENTATION_COUPLED | line/piping/material/weight rows + revisions restored |
| VAL-A07 | branch changed-file reconciliation | PASS | REMOTE_EXECUTION | NONE | exactly 11 expected files at implementation checkpoint |
| VAL-A08 | branch lineage | PASS | REMOTE_EXECUTION | NONE | ahead 4 / behind 0 vs main |
| VAL-A09 | PR-triggered repository checks | NOT_RUN | NOT_OBSERVED | NONE | no workflow runs returned for 8c3cce7f |
| VAL-A10 | integrated browser mapping/import/Apply/restart | NOT_RUN | NOT_OBSERVED | NONE | required before ready-for-review |
| VAL-A11 | support/GAP semantic equivalence test | NOT_RUN | NOT_OBSERVED | NONE | test committed, execution not yet observed |

No NOT_RUN item is represented as PASS.

## Negative assurance

Must remain invariant:

- support kind/GAP numerical interpretation;
- engineering formulas and units;
- CII writer/runtime ownership;
- topology and result publication authority;
- immutable `converters/scripts/inputxml_to_cii2019.py`.

## Hypothesis / falsifier

Hypothesis: draft-only mapping removes repeated O(N) normalization and storage churn while APPLIED-only downstream authority preserves engineering semantics.

Falsifier: any draft edit changes applied config/rows/revision, writes authoritative master storage, causes a qualified support/GAP result to differ, loses an applied mapping across restart, or allows stale cached config to outrank a newer authoritative JSON state.

## Review / merge state

```text
reviews: none observed at report creation
requested reviewers: none
PR checks: no runs observed
PR: draft
merge authority: NOT_GRANTED
```
