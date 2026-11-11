# PR620 — XML→CII Browser Semantic-Core Timing

## Authority

Validation-only Batch-C worker-admission evidence. No production file is modified.

## Baseline

- functional Batch-C main before timing harness: `22b7b57fed3e78534da41342fc3240c8d27369c3`
- landed dependency sequence: #611 → #613 → #617 → #618
- browser timing harness landed by #620: `45e77dfa06947a9da41dbb75ee59d2efb7303821`
- established-workflow push retrigger: `4ee9e2d525a3f4349fe1f5f3c59477946e2ee8dd`
- failure-evidence workflow hardening: `095ad19421e61bce69acb195ae707eead7cb9e1e`
- benchmark: `Benchmarks/css/SYS-0010.xml`

## Required evidence

A real Chromium run must execute the checked-out production `xmlCiiDryRunPreview()` graph and report:

- cold full Preview duration;
- same-source Line/Piping semantic rebuild duration;
- Material-only duration;
- Weight-only duration;
- source parse count/cache-hit count;
- incremental routing counters;
- branch/node cardinality;
- controlled master-row cardinality;
- browser identity and hardware concurrency.

## Browser ladder retained on main

The harness is committed at `tests/browser/xml-cii-semantic-core-timing.html` and the runner at `scripts/run-xml-cii-browser-semantic-timing.mjs`.

Cases:

1. real SYS-0010 with 0 controlled master rows;
2. real SYS-0010 with 250 Line List + 250 Piping Class rows;
3. real SYS-0010 with 1000 + 1000 rows;
4. 3× cloned SYS-0010 branch graph with 250 + 250 rows.

Each sequence asserts the landed routing/custody invariants:

```text
sourceParseCount         = 1
sourceParseCacheHitCount = 1
fullBuilds               = 2
materialOnlyBuilds       = 1
weightOnlyBuilds         = 1
```

## Worker gate

`50 ms` is the main-thread long-task boundary used for this qualification. Crossing it does not automatically admit workers: master-cardinality scaling is inspected first because the current semantic core performs Line List lookup inside the branch loop. If the 1000-master stress case alone crosses the boundary, indexing is required before worker offload.

## Execution attempts

Browser execution was attempted through three distinct trigger paths:

1. PR #620 `pull_request` opened/synchronize events while the workflow was introduced on the branch;
2. #620 merge-to-main push after the workflow was present in the merge commit;
3. an established-default-branch workflow retrigger on main followed by diagnostic PR #621, where the workflow already existed on base before the PR opened.

For diagnostic PR #621 head `f8ccf595f8b97bbd44c05fbfae49a42be2dbdfbd`, the GitHub connector returned **zero pull-request-triggered workflow runs** on repeated checks. #621 was closed unmerged. Direct-main push attempts also produced neither the timing JSON nor the hardened failure-status JSON.

The available execution container contains Chromium, but outbound network is blocked and the complete repository cannot be cloned/materialized there. A partial or reconstructed browser harness is therefore not accepted as this evidence.

## State

```text
BROWSER_EXECUTION = NOT_RUN
BLOCKER           = ACTIONS_NOT_STARTED / EXECUTION_ENVIRONMENT
WORKERS           = NOT_ADMITTED
```

This is an evidence failure, not a performance pass or fail. Do not infer a semantic-core duration from Node/reconstructed timing. The next environment that can execute GitHub Actions or a complete local checkout should run the retained harness unchanged and record `ValidationRecords/xml-cii-browser-semantic-core-timing.json` before revisiting worker admission.
