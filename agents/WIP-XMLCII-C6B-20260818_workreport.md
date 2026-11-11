# WIP-XMLCII-C6B-20260818 — Preview exact-source parse custody

## Current state

```text
BASE_MAIN = e93cf16b9670a9876135a659b4f26506857b2c36
BRANCH = agent/xml-cii-c6b-preview-source-custody-20260818
WORK_INTENT = IMPLEMENT
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; minimum 19/20
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
WORKER_ADMISSION = NOT_ADMITTED
```

## Handover in 60 Seconds

C6 source-mode custody is already on main, but the full Standalone Preview still reparses the same source XML at multiple authority stages. Re-tracing current main proved a normal full build parses the full source at least three times: dry-run core, Bore/Wall authority, and Rating authority. Strict-line fragment extraction can add another full-source parse before isolated fragment rebuilds.

C6b reuses the landed exact-source `getSourceDocumentContext()` as the one raw DOM authority. The core deep-clones that raw DOM before existing node-cleanup mutation; Bore/Wall and Rating read the raw document without mutation; strict-line fragment rebuilds intentionally receive no full-source document and remain isolated.

No engineering rule, formula, support/GAP interpretation, CII writer/runtime, units, topology, or persisted cache/index changes.

## Production trace / defect

Current main baseline:

```text
preview-dryrun-core.js              DOMParser(full source) + cleanup mutation
preview-bore-wall-authority.js      DOMParser(full source) for raw wall/bore evidence
preview-rating-authority.js         DOMParser(full source) for DTXR/rating evidence
preview-dryrun.js strict fragments  DOMParser(full source) when automatic line matches exist
```

The redundant parse is execution custody only; output authority remains the existing Preview pipeline.

## Implementation

Existing modified files:

- `xml-cii-adapted-preview-dryrun.js` — obtains exact-source context once; forwards one raw `sourceDocument` through the normal full Preview authority chain; strict fragment rebuilds remain isolated.
- `xml-cii-adapted-preview-dryrun-core.js` — optional runtime source document; deep clone before existing cleanup mutation; fallback parser retained.
- `xml-cii-adapted-preview-bore-wall-authority.js` — optional raw source document; fallback parser retained.
- `xml-cii-adapted-preview-rating-authority.js` — optional raw source document; fallback parser retained.

New regression:

- `tests/xml-cii-standalone-preview-source-custody.test.mjs` — parse-count, object-identity, mutation-isolation, strict-fragment isolation, and deep-equivalence falsifiers.

## Mandatory backup evidence

Exact live-main blobs verified before edit:

```text
preview-dryrun.js                 a8b0edd214a13a202d8eb789685f3b784c4dad53
preview-dryrun-core.js            fbc5ed7e13f9a45070970df1063cd652c2ffb88f
preview-bore-wall-authority.js    0e1da4b804770864f84f388169780cf1c1903708
preview-rating-authority.js       7640cf38868231637343ade9333ac552993fd989
utils/backup.js                   cd0c755457bb623b0487200a7d0b7217d8b3478e
```

Repository backup commands executed successfully before each edit: backups #1–#4. Workreport backup #5 was also taken before this handover refresh.

## Local modified blob custody

```text
preview-dryrun.js                 d5beb89f4625e57152ff62981d7bf0180b45c3f8
preview-dryrun-core.js            017cb0aa33712c9910ef80ed961a89b35da54675
preview-bore-wall-authority.js    8955e316b36c1769746759aeeb43e34926d47ecb
preview-rating-authority.js       acbcc661a5745cad7e1dbdcf77d18cb55e6f248c
preview-source-custody test       ef8c91da375c1a0633cba1480c1002faf9885ff9
```

## Validation ledger

```text
live main grounding                              PASS / REMOTE_SOURCE_INSPECTION
open-PR exact-file overlap                       SAFE / REMOTE_INSPECTION
pre-edit exact blob verification                 PASS 4/4 + backup utility
repository backup gate                           PASS 4/4 production files
node --check modified production modules         PASS 4/4
C6b source-custody focused suite                 PASS 6/6
landed C6 source-cache suite                     PASS 6/6
landed C5 Weight-only incremental suite          PASS 6/6
browser large-model timing                       NOT_RUN
broader private-repo release suite               NOT_RUN
workers                                           NOT_ADMITTED
```

Focused C6b evidence proves:

- normal full Preview consumes exactly one full-source parse in the tested authority path;
- the same raw DOM object is forwarded to core, Bore/Wall, and Rating;
- core cleanup occurs only on a deep clone; raw DOM retains removed-node evidence;
- strict-line fragment rebuild does not inherit the full-source document;
- source-context same-text reuse and exact-text invalidation remain deterministic;
- optimized core, Bore/Wall, and Rating paths deep-equal their fallback parse paths in the focused fixture.

Evidence class: `PASS / LOCAL_EXECUTION / IMPLEMENTATION_COUPLED`. Browser timing remains explicitly `NOT_RUN`.

## Authority / negative assurance

Unchanged by C6b:

- Line List matching and fuzzy proposal rules;
- Piping Class, Material, Rating, wall/corrosion, Weight calculations;
- support/GAP classification and positional matching;
- CII writer/runtime and Python CORE;
- engineering formulas, units and result publication;
- strict-line engineering semantics;
- persistent cache/index/revision authority;
- workers and workflow files.

## Coordination

- PR611: no exact-file overlap; C6b is main-based and independent.
- PR605 / PR589: no exact-file overlap; support/restraint semantic authority untouched.
- PR598 / PR599: salvage-only; no dependency accepted.

## Appendix A

```text
A1 Production Trace        20/20
A2 Failure Isolation       20/20
A3 Authority / Invariant   20/20
A4 Independent Validation  19/20
A5 Minimal Patch           19/20
TOTAL                       98/100
```

A4 remains limited by unavailable real-browser large-model qualification.

## EXACT_NEXT_ACTION

Publish the exact locally validated four production blobs, five backup evidence files (#1–#5), new focused test, and WIP status/claim records to the current branch. Verify remote blob parity, open a draft PR against current main, reconcile changed files/reviews/checks, and leave it unmerged pending explicit owner authority. Then continue C5 dependency-specific recomputation trace; workers remain NOT_ADMITTED.
