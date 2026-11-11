# WIP-XMLCII-C2V-20260818 — C2 virtualized master Preview

## Current state

```text
STACK_BASE = PR602 / 5a6dbd87e361b83d2b17edc3c9d3302bff919f9f
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; min 18/20
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement the **actual original C2 requirement**: virtualize master Preview row rendering without truncating engineering data.

Target for a 100,000-row master:

```text
APPLIED logical rows = 100,000
physical data rows in tbody = <=60
search matching row IDs = complete, not first 150 only
scroll geometry = full logical row count
engineering/master authority = unchanged
```

This is not PR598/599 replay. Those salvage PRs addressed search preparation and are separate later optimizations.

## Production trace / defect

`summarizeStandaloneImportMasters()` carries both a 150-row sanitized `previewRows` projection and the complete APPLIED `rows` array. Current UI builds `allRows` but renders the 150-row projection and truncates non-empty search results with `filtered.slice(0, 150)`.

Therefore current search has presentation truncation even though the complete APPLIED row set exists.

## Appendix A

```text
A1 full APPLIED master-row production trace      20/20
A2 current 150-row truncation isolation          20/20
A3 authority / no-second-state-tree proof        20/20
A4 quantitative validation design                18/20
A5 minimal virtualization patch / falsifier      20/20
TOTAL                                              98/100
```

A4 remains limited by lack of real-browser execution.

## Pre-edit backup

Exact stack-base `xml-cii-adapted-import-masters.js` reconstructed and verified:

`2bf61911e42e3f2b4386a8b61f0361af3fe84c64`

Mandatory backup #6 executed before C2 edit with context `C2 viewport virtualization from PR602 stack before edit`.

## Design

New pure module `xml-cii-adapted-virtual-rows.js`:

- row height model = 32 px;
- physical data window = 60 rows;
- leading overscan = 10 rows;
- top/bottom spacer heights preserve full logical scroll range;
- empty search uses full APPLIED row set directly without allocating 100k identity indexes;
- non-empty search stores source-row indices only;
- virtual items map logical indices back to original APPLIED row objects.

UI integration:

- uses complete `buildPreviewSearchRows()` corpus;
- preserves existing column schema projection;
- removes `filtered.slice(0, 150)`;
- updates virtual window on scroll;
- resets to row 0 after search change;
- displays logical row range/total.

## Validation

Local focused execution:

```text
5 tests / 5 PASS
100,000 rows -> physical data rows <=60 at top/middle/end
1,000 search matches -> match #151 and final source match retained
logical search rows map to original source row object identity
empty query -> 100,000 logical rows with null index map
static integration -> virtual module + scroll path; no filtered.slice(0,150)
```

STATUS = PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED.
Real browser scroll/search = NOT_RUN.

## Negative assurance

No mapping authority, normalization, persistence, support/GAP semantics, writer/runtime, workers, indexes persisted to storage, source parse cache, formulas, units or output semantics change.

## Falsifier

Any row becomes inaccessible through scrolling/search; DOM data rows exceed the bounded window; virtual logical rows no longer point to APPLIED source row objects; or filtering promotes draft/raw data over APPLIED rows.

## EXACT_NEXT_ACTION

Publish the locally tested virtual-row module + surgical import-masters integration + focused tests, reconcile stacked diff, and open a draft PR based on PR602.