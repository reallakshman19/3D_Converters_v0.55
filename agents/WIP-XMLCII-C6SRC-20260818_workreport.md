# WIP-XMLCII-C6SRC-20260818 — C6 large-source parse custody

## Current state

```text
STACK_BASE = PR606 / e37896041a513d407f6a6af6a92c58f98279fd34
MAIN_LAST_CHECKED = 00a3296f4b860ab1acb49ed690a4122122394d56
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; min 18/20
C3_WORKER_ADMISSION = NOT_ADMITTED / NO REAL MAIN-THREAD TIMING EVIDENCE
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
```

## Mission

Implement original Batch-C **C6 large-source parse custody** for the Source Mode UI only: Source Validity Diagnostics and Hierarchy Preview must consume one exact-source derived DOM parse instead of independently parsing the same authoritative `sourceText`.

No source/runtime ownership switch is introduced. `state.sourceText` remains authoritative; the DOM document is disposable derived evidence.

## Recovery lineage

Old PR #600 is salvage-only source-parse design evidence. This clean WIP supersedes that implementation lineage after independently re-grounding the current clean stack.

Important correction versus PR600: the old unit test evicted the cache through `getSourceDocumentContext('')`, but the real empty-source Source Mode render returned before calling that function. Clean C6 explicitly evicts the derived document when Source Mode renders with no source.

## Grounded defect

Current clean stack still contains two independent parses for one Source Mode render:

- `xml-cii-adapted-source-mode.js` validity diagnostics: `new DOMParser().parseFromString(state.sourceText, ...)`;
- `xml-cii-adapted-source-preview.js` hierarchy Preview: another independent `DOMParser` call.

C6 target:

```text
one loaded exact source / one Source Mode render:
  Source validity consumer = parse #1
  hierarchy consumer       = cache hit
  sourceParseCount         = 1

exact source change        = +1 parse
source clear               = explicit eviction
clear + identical reload   = +1 new parse
```

## Appendix A

```text
A1 exact Source Mode consumer trace                  20/20
A2 duplicate parse + old-clear-lifecycle defect      20/20
A3 source authority / derived-cache invariant        20/20
A4 focused count/invalidation validation             18/20
A5 minimal fail-closed patch / worker falsifier      20/20
TOTAL                                                  98/100
```

A4 is limited by unavailable real browser timing; this remains NOT_RUN.

## Mandatory backup evidence

Exact PR606 stack-base blobs verified before edit:

```text
source-mode.js      32c0eb12330eb12d0c3263e6760c6c6d074f8145
source-preview.js   fe5951fa9eabeb673945a0c86d021bbca9af736c
perf.js             d7f2095a9d3b90e01b187400e9cce5faa247b9f1
perf-evidence.js    735732588f0b79104541a98f9de97b7b3b6df8c9
```

Exact repository backup utility remains `cd0c755457bb623b0487200a7d0b7217d8b3478e`.

Mandatory backups succeeded before edits:

- #16 source-mode;
- #17 source-preview;
- #18 perf;
- #19 perf-evidence.

## Implementation design

New `xml-cii-adapted-source-derived-context.js`:

- one runtime-only exact-source cache;
- first consumer parses once;
- same exact source returns identical frozen context/document;
- exact source change replaces context;
- empty source evicts cache and returns an empty derived context;
- parser failure is cached only for the exact failing source basis;
- nothing persisted;
- aggregate `sourceParseCount`, `sourceParseCacheHitCount`, `sourceParseMs` instrumentation.

Source Mode explicitly calls `resetSourceDocumentContextCache()` when rendering with no source so real clear/reload lifecycle cannot retain stale derived evidence.

Validity Diagnostics and Hierarchy Preview both consume `getSourceDocumentContext()` and no longer own a direct `DOMParser` call.

## Local validation

Focused suite: **6/6 PASS** (`LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`).

Proved:

- two same-source consumers => one parse + one cache hit;
- exact source change => new parse;
- empty source => eviction;
- clear + identical reload => new parse;
- parse failure cached only on exact failing source;
- static integration: both consumers use shared context, neither owns `new DOMParser`;
- static integration: real empty-source Source Mode explicitly calls cache reset.

Module syntax checks PASS.

Real browser Source Mode timing remains `NOT_RUN`.

## Negative assurance

No converter/enrichment/Regex Tester/branch-scope/output-run parser is redirected in this work pack; no source authority changes; no persisted cache; no CII writer/runtime; no support/GAP semantics; no worker; no formulas/units/result publication changes.

## Worker gate

C3 workers remain NOT_ADMITTED. C6 adds measurement and removes proven duplicate work; worker admission still requires real CPU/main-thread stall evidence after these lower-risk changes.

## Falsifier

Different validity/hierarchy behavior; stale document after source clear/change; >1 parse for two same-source Source Mode consumers; cache becoming authoritative/persistent; or clear/reload reusing the old document.

## EXACT_NEXT_ACTION

Publish the exact locally tested seven-file C6 delta, reconcile stacked diff, open a draft PR based on PR606, migrate recovery to PR number, and close old salvage PR600 as superseded. Do not merge.