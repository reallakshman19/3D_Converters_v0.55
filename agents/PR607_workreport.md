# PR607 Work Report — C6 exact-source DOM parse custody

## Current state

```text
PR = 607
BRANCH = agent/xml-cii-c6-source-parse-custody-20260818
STACK_BASE = PR606 / agent/xml-cii-c5-weight-incremental-20260818
REPORT_BASIS_HEAD = e4c5979705244f94baef552160eed4d780510db9
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
TAKEOVER_AUTHORITY = WRITE_ALLOWED
APPENDIX_A = 98/100; min 18/20
MERGEABLE = true
DRAFT = true
C3_WORKER_ADMISSION = NOT_ADMITTED
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement original Batch-C C6 large-source parse custody for the Source Mode UI only. Source Validity Diagnostics and Hierarchy Preview share one exact-source runtime DOM parse. `state.sourceText` remains authoritative; the document is disposable derived evidence.

## Recovery lineage

Old PR600 is salvage-only source-parse evidence. PR607 is the clean superseding implementation. The clean replay corrects a lifecycle defect in PR600: real empty-source Source Mode now explicitly evicts the cache before its consumers return early.

## Grounded defect

Before C6 one Source Mode render independently called `DOMParser` in both validity diagnostics and hierarchy Preview. Clean C6 removes those two ownership points and routes them through one source-derived context.

## Implementation

`xml-cii-adapted-source-derived-context.js`:

- runtime-memory only;
- exact source-string basis;
- first consumer parses once;
- same source returns identical frozen context/document;
- exact source change replaces it;
- empty source evicts it;
- parse failure is cached only for the exact failing source;
- aggregate parse/cache-hit/timing metrics;
- nothing persisted.

`xml-cii-adapted-source-mode.js` explicitly calls `resetSourceDocumentContextCache()` on empty source before downstream consumers return.

`xml-cii-adapted-source-preview.js` and validity diagnostics both consume `getSourceDocumentContext()` and no longer own `new DOMParser()`.

C7 evidence includes source parse count/cache-hit/timing rows.

## Mandatory backup evidence

Exact PR606 stack-base blobs:

```text
source-mode.js      32c0eb12330eb12d0c3263e6760c6c6d074f8145
source-preview.js   fe5951fa9eabeb673945a0c86d021bbca9af736c
perf.js             d7f2095a9d3b90e01b187400e9cce5faa247b9f1
perf-evidence.js    735732588f0b79104541a98f9de97b7b3b6df8c9
```

Mandatory backups #16–#19 succeeded before edits.

Two publication attempts with stale hash suffixes were rejected before branch movement. Fresh local/GitHub `git hash-object` reconciliation produced the accepted exact tree; only commit `e4c5979705244f94baef552160eed4d780510db9` contains C6 code.

## Validation ledger

```text
module syntax checks                              PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
focused C6 suite                                  PASS 6/6 / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED
two same-source consumers => one parse + hit      PASS
exact source change => new parse                   PASS
empty source => eviction                           PASS
clear + identical reload => new parse              PASS
failure cached only by exact source                PASS
both UI consumers no longer own DOMParser          PASS / static integration
real empty Source Mode explicitly resets cache     PASS / static integration
changed-file reconciliation                        PASS / REMOTE_EXECUTION / exactly 10 declared paths
mergeability                                       PASS / REMOTE_EXECUTION / true
real browser Source Mode timing                    NOT_RUN
PR status checks                                   NOT_RUN / none observed at report creation
```

No NOT_RUN item is represented as PASS.

## C3 worker gate

Workers remain NOT_ADMITTED. C6 removes a proven duplicate parse and adds aggregate timing evidence, but real main-thread timing still has not been observed.

## Negative assurance

No converter/enrichment/Regex Tester/branch-scope/output-run parser migration; no source authority change; no persistent cache; no CII writer/runtime; no support/GAP semantics; no workers; no formulas/units/result-publication changes.

## Hypothesis / falsifier

Hypothesis: two Source Mode UI consumers can share one exact-source derived DOM without changing semantics and with deterministic source-change/clear invalidation.

Falsifier: stale document after clear/change, >1 parse for two same-source consumers, changed validation/hierarchy behavior, or derived document becoming persistent/authoritative.

## EXACT_NEXT_ACTION

Keep PR607 draft. Close old PR600 as superseded. C3 workers remain blocked. The next safe stage is C4b routing: route active supportConfigJson save surfaces through the existing updateWorkflowState dependency boundary before using revisions as broad C5 invalidation authority.