# PR602 Work Report — C1 incremental rendering + C7 perf evidence

## Current state

```text
PR = 602
BRANCH = agent/xml-cii-c1-c7-replay-20260818
STACK_BASE = PR601 / agent/xml-cii-batch-a-replay-20260818
REPORT_BASIS_HEAD = 1774d89a4b02b06406ec9f974c2f35984ac988ed
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

C1/C7 only: visible mapping DRAFT-only transitions may use master-local DOM sync; all authority changes fail closed to full workspace rendering; perf mode exposes aggregate counts/timings only.

## Dependency and supersession

- hard stack base: PR601 clean Batch A;
- salvage predecessor: PR596; must not merge;
- this PR supersedes PR596 implementation lineage.

## Implemented production delta

- `xml-cii-adapted-render-scope.js`: pure fail-closed classifier;
- `xml-cii-adapted-master-dom-sync.js`: local status/health/select/button/write-back sync;
- `xml-cii-adapted-perf-evidence.js`: optional aggregate evidence drawer;
- `xml-cii-adapted-perf.js`: actual full/partial/local-DOM counters;
- `xml-cii-adapted-workflow-shell.js`: surgical classifier dispatch + evidence mount only.

Surgical workflow-shell blob: `74c1b167555a6677816a5874ecb7794f75188a26`. It deliberately excludes unrelated PR596 cleanup.

## Mandatory backup evidence

Stack-base target blobs verified before edit:

```text
perf.js = edf376ca9381dae3c3a8d7ef4c4cf69fe99b21fd
workflow-shell.js = c0c2910e897efedc8b5dd8e597e19c63b4281b87
```

Initial C1 backup attempt failed because the offline utility reconstruction had a duplicated CLI block. No C1 target had been edited. Utility was repaired to exact repo blob `cd0c755457bb623b0487200a7d0b7217d8b3478e`, syntax checked, then backups #4/#5 succeeded before edits.

## Fail-closed contract

Partial rendering requires all of the following: same non-draft top-level state; same config identity; same normalized row identities; same raw row-array identities; same applied mapping revisions; same source/row-count/preview/workbook/sheet/diagnostic authority; exactly one changed mapping draft; target master visible in Source phase.

Everything else => full render.

## Validation ledger

```text
module syntax checks                 PASS / LOCAL_EXECUTION / implementation-coupled
render scope                         PASS 6/6 / LOCAL_EXECUTION / implementation-coupled
master DOM sync                      PASS 1/1 / LOCAL_EXECUTION / implementation-coupled / minimal stubs
perf evidence formatting             PASS 1/1 / LOCAL_EXECUTION / implementation-coupled / minimal DOM stub
stacked PR mergeability              PASS / REMOTE_EXECUTION / GitHub reports true
real browser draft/edit/Apply flow   NOT_RUN
PR status checks                     NOT_RUN / none observed yet
```

No NOT_RUN item is represented as PASS.

## Negative assurance

No support/GAP semantics, CII writer/runtime, immutable InputXML→CII core, workers, indexes, preview virtualization, source parse cache, units, calculations or result-publication authority changed.

## Hypothesis / falsifier

Hypothesis: draft-only mapping can be displayed through local DOM synchronization with zero full-workspace reconstruction while authority-changing transitions remain full-render boundaries.

Falsifier: any applied/config/row/raw/source-authority mutation is classified partial; any local sync changes engineering authority; or real browser execution loses bindings/visible state.

## EXACT_NEXT_ACTION

Keep PR602 draft; move to actual C2 viewport virtualization as a separate stacked work pack. Browser acceptance remains required before PR602 can be considered ready for review.