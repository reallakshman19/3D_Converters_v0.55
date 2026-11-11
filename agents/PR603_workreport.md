# PR603 Work Report — Actual C2 virtualized master Preview

## Current state

```text
PR = 603
BRANCH = agent/xml-cii-c2-virtual-preview-20260818
STACK_BASE = PR602 / agent/xml-cii-c1-c7-replay-20260818
REPORT_BASIS_HEAD = 9bd908e8ea3414b014fff6dc386e0bd723969eb9
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
TAKEOVER_AUTHORITY = WRITE_ALLOWED
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
APPENDIX_A = 98/100; min 18/20
MERGEABLE = true
DRAFT = true
```

## Mission

Implement the original C2 viewport-virtualization requirement: complete APPLIED master/search rows remain logically accessible while the DOM renders only a bounded physical row window.

## Grounded baseline

`summarizeStandaloneImportMasters()` already exposes:

- `previewRows`: sanitized first-150 schema/display projection;
- `rows`: complete APPLIED normalized master rows.

Before C2, search prepared complete rows but displayed only `filtered.slice(0,150)`. This PR removes that presentation truncation.

## Quantitative implementation

```text
row-height model = 32 px
physical data-window target = 60 rows
leading overscan = 10 rows
100,000 logical rows => <=60 physical data rows
non-empty search => complete source-row index list
empty search => direct complete APPLIED rows, no 100k identity-index copy
```

New pure module `xml-cii-adapted-virtual-rows.js` owns row-window/spacer/index-to-source-row mechanics. It does not own engineering state.

The existing `xml-cii-adapted-import-masters.js` integration:

- retains APPLIED mapping/column authority;
- uses complete `buildPreviewSearchRows()` result as the logical corpus;
- uses top/bottom spacer rows for full scroll geometry;
- resets scroll to zero when a search query changes;
- updates the physical window on scroll;
- displays logical range and total;
- removes the old 150-match display truncation.

## Mandatory backup evidence

Exact stack-base target verified before C2 edit:

`xml-cii-adapted-import-masters.js = 2bf61911e42e3f2b4386a8b61f0361af3fe84c64`

Mandatory backup #6 executed before edit.

Modified remote blob is exactly the locally tested replay:

`9a10fb1eb473aa157b15d2586c1d31934bb461f7`

## Validation ledger

```text
100k top/middle/end physical-window bound   PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
spacer+window total-height identity          PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
1000-match search completeness               PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
match #151 retained at source row 15000      PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
final match retained at source row 99900     PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
logical->APPLIED object identity             PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
empty-query complete rows/no index copy      PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
static integration/no filtered.slice(0,150)  PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
focused tests                                PASS 5/5 / 0 FAIL
stacked PR mergeability                      PASS / REMOTE_EXECUTION / GitHub true
changed-file reconciliation                  PASS / REMOTE_EXECUTION / exactly 7 declared paths
real browser scroll/search                   NOT_RUN
PR status checks                             NOT_RUN / none observed yet
```

No NOT_RUN item is represented as PASS.

## Negative assurance

No APPLIED mapping/master authority, normalization, persistence, support/GAP semantics, CII writer/runtime, source parsing, workers, persisted indexes, formulas, units, or result-publication semantics change.

## Coordination

- PR602 = hard stack base;
- PR598/#599 = separate salvage search-preparation optimizations; they are not C2 virtualization and are not dependencies of this PR.

## Hypothesis / falsifier

Hypothesis: table viewport virtualization reduces large-master DOM occupancy from O(N) logical rows to <=60 physical data rows while preserving complete APPLIED row/search accessibility.

Falsifier: any logical row/search match becomes unreachable, physical data rows exceed the window target, source-row identity mapping is wrong, or draft/raw data replaces APPLIED rows.

## EXACT_NEXT_ACTION

Keep PR603 draft. C3 worker admission remains blocked by lack of measured real-browser/main-thread evidence. The next permissible bounded stage is C4 explicit revision/dependency keys or clean C6 source-parse custody; do not implement workers without measurements.