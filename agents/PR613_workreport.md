# PR613 Work Report — C6b Preview exact-source parse custody

## Current state

```text
PR = 613
BRANCH = agent/xml-cii-c6b-preview-source-custody-20260818
BASE_MAIN = e93cf16b9670a9876135a659b4f26506857b2c36
WORK_INTENT = IMPLEMENT
CRITICALITY = ENGINEERING_CRITICAL
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; minimum 19/20
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED_FOR_PR613
WORKER_ADMISSION = NOT_ADMITTED
```

## Handover in 60 Seconds

C6 source-mode exact-source DOM custody is already on main. PR613 closes the equivalent gap in full Preview. Current main parsed the same complete XML at least three times in a normal full Preview: dry-run core, Bore/Wall authority, and Rating authority. Strict-line fragment extraction could add another full-source parse.

PR613 obtains one raw source DOM from the landed exact-source context, passes that same raw document through Preview authorities, deep-clones only inside the cleanup-mutating core, and leaves strict fragment rebuilds isolated. Normal full-source parse count is therefore >=3 -> 1 in the focused authority-path harness.

## Changed production paths

- `xml-cii-adapted-preview-dryrun.js` — acquire/forward exact-source document.
- `xml-cii-adapted-preview-dryrun-core.js` — optional source document; deep clone before cleanup; parser fallback retained.
- `xml-cii-adapted-preview-bore-wall-authority.js` — raw document handoff; parser fallback retained.
- `xml-cii-adapted-preview-rating-authority.js` — raw document handoff; parser fallback retained.

Regression:
- `tests/xml-cii-standalone-preview-source-custody.test.mjs` — repository-portable source-custody contract.

## Backup / byte custody

Exact main blobs were verified before edits and `node utils/backup.js save ...` succeeded for all four production files. The first committed test version was backed up before its portability correction. Six relevant `.bak` artifacts are retained in the PR.

Remote production/test blob parity at publication:

```text
preview-dryrun.js                 d5beb89f4625e57152ff62981d7bf0180b45c3f8
preview-dryrun-core.js            017cb0aa33712c9910ef80ed961a89b35da54675
preview-bore-wall-authority.js    8955e316b36c1769746759aeeb43e34926d47ecb
preview-rating-authority.js       acbcc661a5745cad7e1dbdcf77d18cb55e6f248c
committed portable regression     977ba12979239f2ffda7315a01fc1d3cb15d308f
```

## Validation ledger

```text
modified production node --check                 PASS 4/4
rich C6b parse/mutation/deep-equivalence harness PASS 6/6
landed C6 source-cache regression                PASS 6/6
landed C5 Weight-only incremental regression     PASS 6/6
committed portable C6b regression                PASS 4/4
remote production/test blob parity               PASS 5/5
browser large-model timing                       NOT_RUN
broader private-repo release qualification       NOT_RUN
```

The rich 6-case harness proves one full-source parse, same raw-DOM identity through core/Bore-Wall/Rating, core clone isolation, raw-DOM non-mutation, strict-fragment isolation, source-change invalidation, and deep-equivalence of optimized vs fallback authority paths.

Evidence classification: `LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`. No unexecuted check is represented as PASS.

## Authority / negative assurance

Unchanged: Line List matching, Piping Class, Material, Rating, wall/corrosion, Weight logic; support/GAP semantics; CII writer/runtime; Python CORE; formulas; units; topology; result publication; persisted cache/index authority; workflows; workers.

## Coordination

- PR611: SAFE exact files; separate C4b config-revision routing.
- PR605 / PR589: SAFE exact files; support/restraint authority untouched.
- PR598 / PR599: salvage-only; no dependency accepted.

## Appendix A

A1 Production Trace 20/20; A2 Failure Isolation 20/20; A3 Authority/Invariant 20/20; A4 Independent Validation 19/20; A5 Minimal Patch 19/20. Total 98/100.

## EXACT_NEXT_ACTION

Reconcile PR613 live changed files, mergeability, reviews, review threads, statuses and workflow runs. Keep draft/unmerged pending explicit owner merge authorization. Continue Batch-C C5 dependency-specific recomputation in read-only trace mode; workers remain NOT_ADMITTED until real main-thread timing evidence exists.
