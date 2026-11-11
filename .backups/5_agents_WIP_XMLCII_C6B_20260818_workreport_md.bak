# WIP-XMLCII-C6B-20260818 — Preview exact-source parse custody

## Current state

```text
BASE_MAIN = e93cf16b9670a9876135a659b4f26506857b2c36
BRANCH = agent/xml-cii-c6b-preview-source-custody-20260818
WORK_INTENT = IMPLEMENT
CRITICALITY = ENGINEERING_CRITICAL
TAKEOVER_AUTHORITY = WRITE_ALLOWED_AFTER_BACKUP_GATE
PR_RECOVERY_STATE = RECOVERABLE
APPENDIX_A = 98/100; minimum 19/20
MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED
WORKER_ADMISSION = NOT_ADMITTED
```

## Mission

Close the remaining large-source parse-custody gap in the Standalone Preview path without changing engineering semantics.

The landed C6 source context shares one exact-source DOM between Source Mode validity and hierarchy consumers. Full Preview still reparses the same source independently:

1. `xml-cii-adapted-preview-dryrun-core.js` parses XML before branch/process resolution and mutates that parsed document for node cleanup;
2. `xml-cii-adapted-preview-bore-wall-authority.js` reparses the original XML to recover raw branch wall evidence and node bore authority;
3. strict-line fallback can additionally rebuild isolated branch fragments.

Therefore a normal full Preview currently performs at least two full-source `DOMParser` parses before strict-fragment work is considered.

## Intended bounded change

Existing files requiring mandatory pre-edit backup:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-dryrun-core.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-preview-bore-wall-authority.js`

Reuse existing landed source authority:

- `xml-cii-adapted-source-derived-context.js`

Design:

- top-level full Preview obtains the exact-source cached raw DOM once;
- core receives an optional raw source document and clones it before existing cleanup mutation;
- Bore/Wall authority receives the same raw source document read-only;
- strict-line branch-fragment rebuilds intentionally do **not** consume or replace the full-source context; they keep isolated parsing semantics;
- invalid/parsererror input preserves current fail-closed empty/unchanged behavior;
- no derived DOM/index is persisted.

## Acceptance / falsifier

For one unchanged loaded source:

```text
full-source DOMParser parses = 1
core cleanup mutations cannot modify cached raw source DOM
Bore/Wall authority sees raw source evidence, not cleanup-mutated DOM
strict-line fragment rebuilds remain isolated from full-source cache
Preview branchRows/nodeRows deep-equal current full-build baseline
source change invalidates exact-source context deterministically
source clear evicts context
```

Fail if any output/provenance field changes solely because of parse custody, if the cached raw DOM is mutated, or if a branch fragment replaces the full-source cache basis.

## Coordination

- PR611 C4b config-revision routing: no exact-file overlap; semantically independent. C6b may proceed from main without stacking on #611.
- PR605 / PR589 support-gap work: no exact-file overlap; no support/GAP semantic authority is touched.
- PR598 / PR599: salvage-only; no dependency accepted.

## Negative assurance

No support/GAP interpretation; no CII writer/runtime; no formula/unit/topology change; no Line List/Piping Class/Material/Weight business rule; no worker; no persisted cache/index; no workflow changes.

## Appendix A

```text
A1 Production Trace — 20/20
  Current full Preview traced through strict-line core -> bore/wall -> material -> rating, and source context traced through Source Mode consumers.

A2 Failure Isolation — 20/20
  Proven redundant full-source parse boundary: core parse + bore/wall parse. Strict fragment parses are a separate derived-input path.

A3 Authority / Invariant — 20/20
  Raw source DOM remains immutable authority; only a clone may be cleanup-mutated. Bore/wall must read raw evidence.

A4 Independent Validation — 19/20
  Planned parse-count + DOM-mutation + deep-equivalence falsifiers. Browser large-model timing remains unavailable.

A5 Minimal Patch — 19/20
  Three existing Preview modules only; reuse landed source context; no new worker/index/business logic.

TOTAL = 98/100
```

## Validation state

```text
live main grounding                     PASS / SOURCE_INSPECTION
current duplicate full-source parse     PASS / SOURCE_INSPECTION
open-PR exact-file overlap              SAFE / REMOTE_INSPECTION
pre-edit exact blob reconstruction      NOT_RUN
mandatory backup commands               NOT_RUN
implementation                          NOT_STARTED
focused parse/equivalence regression    NOT_RUN
browser timing                          NOT_RUN
```

## EXACT_NEXT_ACTION

Reconstruct the three exact main blobs locally, verify Git blob SHAs, run repository `node utils/backup.js save ...` for each existing file before editing, then implement the optional source-document handoff and execute parse-count/deep-equivalence regressions. Do not admit workers from this stage.
