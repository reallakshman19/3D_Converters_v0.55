# PR780 Checkpoint 01 — worker foundation

```text
REPORT_BASIS_HEAD: 42564f05fef8c3ed46a5bd86562ab36d87dcca7a
BASE_MAIN: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
PR: 780
STATE: OPEN_DRAFT
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
```

## Delivered at this checkpoint

Additive-only XML→CII Standalone Master Dataset Worker foundation:

- transferable `ArrayBuffer` client boundary;
- two-stage XLSX contract: sheet discovery then selected-sheet parse;
- selected-sheet-only `sheet_to_json`;
- worker-owned normalization/search service;
- bounded 150-row Preview return;
- IndexedDB dataset metadata + 2000-row chunk storage;
- worker-side search / row retrieval service;
- hard cancellation by worker termination + generation guard;
- explicit metadata-only config helper that strips `linelist.masterRows`, `pipingClass.masterRows`, `material.mapRows`, and `weight.masterRows` while preserving field maps/other configuration;
- fail-closed assertion when master arrays remain in config.

No pre-existing runtime JS file has been modified.

## Exact commits

```text
1f04f90873acc07525144cf169907678007971c1  perf(xml-cii): add master dataset worker service
42564f05fef8c3ed46a5bd86562ab36d87dcca7a  perf(xml-cii): enforce metadata-only master config boundary
```

## Validation truth

Executed locally on the exact additive source/test bytes reconstructed under the tool runtime:

```text
node --test tests/xml-cii-master-dataset-worker.test.mjs tests/xml-cii-master-dataset-config.test.mjs

PASS 6/6
FAIL 0
SKIP 0
```

The six tests prove:

1. XLSX sheet discovery uses `bookSheets: true` and selected parsing uses `sheets: selectedSheet` as two distinct reads;
2. only the selected worksheet reaches `sheet_to_json`;
3. JSON row-array ingestion does not materialize a workbook;
4. dataset service returns metadata + at most 150 Preview rows while keeping the complete dataset behind the service;
5. worker search can return a match outside the Preview window;
6. client transfers ArrayBuffer ownership and cancellation terminates the worker;
7. 100k-row config arrays are removed without mutating governing field-map/config values;
8. metadata-only assertion fails closed if master dataset arrays are present.

All new JS/MJS files are below the repository 300-line limit. `node --check` passed for the new worker modules/tests before commit.

Classification of this evidence:

```text
STATUS: PASS
OBSERVATION: LOCAL_EXECUTION
ORACLE: IMPLEMENTATION_COUPLED
LIMITATION: additive reconstructed slice, not repository-native exact checkout/browser execution
```

## Known risks / not yet proved

- browser Worker + IndexedDB execution: NOT_RUN;
- real XLSX 10k/50k/100k timing: NOT_RUN;
- exact engineering-result parity: NOT_RUN;
- startup lazy restore: NOT_IMPLEMENTED;
- existing UI import wiring: NOT_IMPLEMENTED;
- Preview UI search routing to worker: NOT_IMPLEMENTED;
- source/docs cache-chain parity: NOT_STARTED.

The worker currently retains the existing `import('xlsx')` then CDN fallback pattern. Before production integration, version/supply-chain custody must be finalized; SheetJS recommends vendoring for production stability.

## Hard gate

Production integration requires edits to existing files including:

- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-events.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-master-runtime.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-state.js`
- `tabs/xml-cii-2019-standalone/ui-adapted/xml-cii-adapted-import-masters.js`

Repository policy requires the native pre-edit command for each existing target. That command has not been executed in an authorized native checkout, therefore these files remain untouched.

```text
EXISTING_FILE_BACKUP_GATE = REQUIRED_NOT_RUN
PRODUCTION_WIRING = BLOCKED_BY_POLICY_GATE
```

## Exact next action

In an authorized native checkout, run the mandatory pre-edit backups for the intended integration files, then wire one bounded import path to the worker while preserving the old APPLIED master until `DATASET_READY` passes current-generation validation. Do not merge without explicit Owner authorization.
