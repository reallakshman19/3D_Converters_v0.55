# WIP-XMLCII-DATAWORKER-20260929 — XML→CII master dataset worker

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED_AFTER_APPENDIX_A
REPORT_BASIS_HEAD: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
MAIN_HEAD_LAST_CHECKED: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
MERGE_BASE: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
GROUNDING_EPOCH: GE-XMLCII-DATAWORKER-20260929-01
CURRENT_STAGE: branch bootstrap / draft PR allocation
CURRENT_BLOCKER: existing-file production integration requires native pre-edit backup command
HIGHEST_RISK: changing master-data custody without preserving APPLIED engineering authority
EXACT_NEXT_ACTION: allocate draft PR, then add new worker/protocol/test files before crossing the existing-file backup gate
```

## Classification

```text
WORK_INTENT: IMPLEMENT
REPOSITORY_STATE: NEW_PR_REQUIRED
MUTATION_AUTHORITY: WRITE_ALLOWED
CRITICALITY: ENGINEERING_CRITICAL
MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED
```

Source issue: #776.

Owner-approved mission: robust XML→CII 2019 Standalone large XLSX/JSON/CSV performance architecture using a dedicated worker/data-service boundary.

## Live ground truth

- repository: `reallaksh19/3D_Converters`
- base: `main`
- live main / merge base: `cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520`
- current branch: `agent/xml-cii-master-dataset-worker-20260929`
- predecessor lifecycle PR: #779 merged at current main
- source specification: #776
- relevant stale overlap: #599 touches Preview/import surfaces but declares `SALVAGE_PARTIAL`, `READ_ONLY`, `TAKEOVER_REQUIRED`, `DO NOT MERGE AS-IS`
- open #614 is validation-only and does not own production worker behavior
- coordination classification: `COORDINATION_REQUIRED / NOT_BLOCKED`

## Current production trace

```text
file input
 -> file.arrayBuffer()
 -> parseMasterFileData()
 -> XLSX.read() on main thread
 -> sheet_to_json() for every worksheet
 -> commitParsedImport()
 -> importMasterRows()
 -> autoMapStandaloneMasterFields()
 -> applyFieldMapToContext()
 -> mapRowsWithFieldMap() over all rows
 -> commitAppliedMaster()
 -> config receives normalized masterRows/mapRows
 -> JSON.stringify(committed.config, null, 2)
 -> persistChangedMasterDetailed()
 -> JSON.stringify normalized/raw/workbook repeatedly
 -> synchronous localStorage writes
 -> requestMeasuredFullRender()
```

Preview DOM is virtualized, but `buildMatchingRowIndexes()` still loops synchronously across every logical row for each non-empty query. Line List lazy Proxy access can normalize rows while that scan runs.

Startup restores persisted master arrays synchronously from localStorage and reconstructs them into config before pretty-stringifying config again.

## Diagnosis / hypothesis

Hypothesis: the reported large-file stuck behavior is independently explained by main-thread XLSX parsing, eager all-sheet conversion, O(N) normalization/search, repeated dataset JSON serialization and synchronous localStorage custody. Moving only `XLSX.read()` to a worker is insufficient if 100k objects are then cloned back and reserialized on main.

Falsifier: browser evidence showing large imports/search/startup remain responsive while the current main-thread XLSX/serialization/search path is still exercised at 100k scale.

PR #779 causality is deliberately separate: this WIP does not claim #779 caused the import/startup freeze.

## Architecture decision

Target boundary:

```text
ArrayBuffer transfer once
 -> Master Dataset Worker
    -> XLSX metadata read (`bookSheets: true`)
    -> UI sheet selection
    -> selected-sheet parse (`sheets: selectedSheet`)
    -> sheet_to_json(selected only)
    -> mapping / normalization / validation
    -> worker-owned search representation + lookup indexes
    -> IndexedDB dataset persistence
    -> bounded preview + metadata
 -> Main thread atomic APPLIED metadata commit
```

Hard invariant: `supportConfigJson` must not contain large master datasets.

Migration compatibility may temporarily hydrate normalized `runtimeRows` for existing synchronous engineering consumers, but that is explicitly not the final architecture.

## Authority / negative assurance

Must remain unchanged:

- APPLIED vs DRAFT mapping semantics;
- applied mapping revision advancement rules;
- support/GAP interpretation;
- XML/CII topology, geometry, units and writer ownership;
- numerical calculations and result publication;
- failed/cancelled/stale imports must not mutate current APPLIED authority.

## Appendix A — implementation qualification

### A1 Production Trace — 20/20

Traced current upload, XLSX parse, all-sheet conversion, mapping, normalization, config insertion, supportConfigJson serialization, persistence and full-render path through current main. Also traced Preview full-dataset search and startup restore behavior.

### A2 Current Failure Isolation — 19/20

Isolated multiple independent main-thread scale hazards: synchronous `XLSX.read`, eager `sheet_to_json` for every sheet, full-row normalization, repeated JSON serialization/localStorage writes, synchronous Preview full scan, and startup restore. Browser long-task reproduction remains NOT_RUN at bootstrap, so one mark is withheld.

### A3 Authority / Invariant — 20/20

Identified APPLIED mapping/revision and current engineering master rows as protected authority. Worker staging must remain non-authoritative until one atomic successful commit; cancellation/failure/stale generation preserves prior authority.

### A4 Independent Validation — 18/20

Plan includes 10k/50k/100k scale tests, exact engineering-result parity, cancellation/stale-job tests, config no-dataset invariant, no-main-thread XLSX/search assertions, startup restore behavior and browser responsiveness. Real browser timing is not yet executed.

### A5 Next-Commit / Minimal Patch — 19/20

First code slice is additive: new worker protocol/client/parser modules and focused tests. Existing production integration is deferred until native backup gate is satisfied. This minimizes authority risk while establishing executable worker behavior.

```text
TOTAL: 96/100
MINIMUM: 18/20
DISPOSITION: QUALIFIED_FOR_BOUNDED_XMLCII_DATASET_WORKER_IMPLEMENTATION
```

## Planned changed-file ledger

Initial additive slice only:

- `tabs/xml-cii-2019-standalone/workers/master-dataset-protocol.js` (new)
- `tabs/xml-cii-2019-standalone/workers/master-dataset-client.js` (new)
- `tabs/xml-cii-2019-standalone/workers/master-dataset-worker.js` (new)
- focused tests (new)
- recovery records

Existing files such as `xml-cii-adapted-master-events.js`, `xml-cii-adapted-master-runtime.js`, `xml-cii-adapted-state.js`, `xml-cii-adapted-import-masters.js` and docs mirrors are **not authorized for mutation until native pre-edit backups are executed**.

## Validation ledger

```text
live main grounding                         PASS / SOURCE_INSPECTION / NONE
repo policy + engineering protocol          PASS / SOURCE_INSPECTION / AUTHORITATIVE_REFERENCE
production trace                            PASS / SOURCE_INSPECTION / IMPLEMENTATION_COUPLED
open-PR overlap check                       PASS / REMOTE_EXECUTION / NONE
browser freeze reproduction                 NOT_RUN / NOT_OBSERVED / NONE
worker implementation tests                 NOT_RUN / NOT_OBSERVED / NONE
engineering-result parity                   NOT_RUN / NOT_OBSERVED / NONE
```

## Exact continuation state

1. Open a draft PR from this branch to `main`, linked to #776.
2. Replace WIP recovery authority with `agents/PR<NUMBER>_workreport.md` plus status/claim records.
3. Implement additive worker protocol/client/worker + tests only.
4. Do not edit existing JS until `node utils/backup.js save <file> "<context>"` has been executed in an authorized native checkout.
5. Never merge without explicit Owner authorization.
