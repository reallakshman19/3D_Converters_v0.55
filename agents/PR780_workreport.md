# PR780 — XML→CII master dataset worker boundary

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: RECOVERABLE
TAKEOVER_AUTHORITY: WRITE_ALLOWED
REPORT_BASIS_CODE_HEAD: 29abbd32fb72be7474e8581bdc044eeddb4e27ad
MAIN_HEAD_LAST_CHECKED: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
MERGE_BASE: cd8e32d97f0a52d3ec40ed6b3a7112f16b8db520
PR: 780
PR_STATE: OPEN_DRAFT
GROUNDING_EPOCH: GE-XMLCII-DATAWORKER-20260929-03
PROTOCOL: ENGINEERING_PR_DELIVERY_V3.1
COMMON_BASIS: 1ced68258afeaf50df113b1d38a4ceb9193587e3
TWO_PASS_REVISION: TPG-2P-2026-09-28-R3
CURRENT_STAGE: ACCEPTANCE_QUALIFIED_METADATA_ONLY_DATASET_CUSTODY
CURRENT_BLOCKER: NONE_APPLICABLE_WITHIN_PR780_SCOPE; MERGE_AUTHORITY_REMAINS_OWNER_ONLY_NOT_GRANTED
HIGHEST_RISK: confusing transient operation materialization with retained main-thread authority, or expanding into unrelated CI baselines
EXACT_NEXT_ACTION: owner review / merge decision only; do not merge or expand scope without explicit owner authority
```

Source issue: #776. Branch: `agent/xml-cii-master-dataset-worker-20260929`.

## Final architecture state

PR780 now implements the large-master architecture for XML→CII 2019 Standalone with:

- transferable file `ArrayBuffer` ownership in a dedicated Master Dataset Worker;
- two-stage XLSX sheet discovery and selected-sheet parsing;
- worker-owned mapping, normalization, validation, Preview search corpus, and dataset remap;
- IndexedDB persistence for large normalized datasets;
- metadata-only retained main-thread custody for dataset-backed masters: `datasetId`, row count, field map/revision/fingerprint, source metadata, and bounded Preview/mapping samples;
- no retained full normalized/raw dataset arrays in `masterContext` after worker-backed import, remap, or normal startup restore;
- `supportConfigJson` compaction for dataset-backed masters;
- no large dataset copies in localStorage;
- worker-backed virtualized Preview rows and worker SEARCH for non-empty Preview search;
- stale/cancelled import protection and stale/out-of-order search protection;
- atomic dataset remap for APPLIED mapping changes, with stale-result rejection;
- operation-specific transient row materialization for existing synchronous engineering calculation consumers;
- source/docs deployment parity for changed deployed modules.

Important definition: **metadata-only custody describes retained/authoritative application state.** Some synchronous engineering operations still materialize normalized rows transiently on the main thread for the duration of that calculation/review. Those transient rows are not committed back into `masterContext`, `supportConfigJson`, or localStorage and are not persistent authority.

Legacy compatibility exception: an older persisted Weight dataset that predates fingerprint metadata may be fully read once during startup solely to reconstruct the governed Weight fingerprint. New custody stores the fingerprint and follows the bounded startup path.

## Delivered phases

```text
D-A  Weight Match transient dataset materialization                 QUALIFIED
D-B  workflow job transient dataset hydration                       QUALIFIED
D-C  Run/Weight review detached from resident master arrays         QUALIFIED
D-D  Preview diagnostics transient basis + metadata Output readiness QUALIFIED
E-A  metadata-only IndexedDB startup restore                        QUALIFIED
E-B1 atomic worker dataset remap                                     QUALIFIED
E-B2 metadata-only import/remap retained custody                     QUALIFIED
CLOSE browser scale evidence updated to custody-vs-transient model   QUALIFIED
```

The previous workreport statement that `master-dataset-import-coordinator.materialize()` was still called by the import integration is obsolete. The helper remains available for explicit transient operation use, but worker-backed import no longer calls it and no longer retains the returned full arrays.

## Exact-head acceptance evidence

Qualified closure code/evidence head:

```text
29abbd32fb72be7474e8581bdc044eeddb4e27ad
```

Issue #776 validation run #205 (`36585914273`) — **SUCCESS**:

```text
Issue #776 focused regressions          PASS
PR780 master dataset regressions        PASS
adjacent PR/base differential           PASS
applicable enforcement                  PASS
WSW exact-head browser conversion       PASS
WSW parity comparisons                  694
WSW parity mismatches                   0
10k / 50k / 100k browser scale          PASS
```

XML CII Browser Semantic Core Timing run #126 (`36585914237`) — **SUCCESS**.

WSW/scale evidence artifact from run #205:

```text
name: issue-776-wsw-e2e.zip
artifact_id: 11041049568
sha256: be1ae4e59e3995ad97eee92afc9b028477d3480ce480e1ef67ca9569bbfcf71b
```

## Chromium 10k / 50k / 100k closure evidence

Scale evidence schema: `XMLCII_MASTER_DATASET_SCALE_E2E_V2`.
Responsiveness threshold: maximum animation-frame gap <= 250 ms. Synthetic fixture preparation is excluded from product timing.

| Rows | Worker import | Metadata-only commit | Retained normalized/raw | Preview / mapping samples | Transient operation materialization | Worker search | Worst frame gap | Last match |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | 133.9 ms | 2.2 ms | 0 / 0 | 150 / 150 | 18.2 ms | 2.1 ms | 16.7 ms | 9,999 |
| 50,000 | 261.4 ms | 0.2 ms | 0 / 0 | 150 / 150 | 47.0 ms | 2.9 ms | 16.7 ms | 49,999 |
| 100,000 | 277.6 ms | 0.4 ms | 0 / 0 | 150 / 150 | 94.0 ms | 3.2 ms | 16.8 ms | 99,999 |

All three scales report `metadataOnlyCustody: true` and `responsive: true`.

The transient-operation column is intentionally measured separately from retained custody. It demonstrates the compatibility boundary still used by synchronous engineering operations without misclassifying those temporary rows as application-state authority.

## Acceptance ledger

```text
main-thread large XLSX.read                         PASS = 0
main-thread large sheet_to_json                     PASS = 0
eager all-sheet materialization                     PASS = 0
supportConfigJson dataset payload                   PASS = 0
large-master localStorage dataset writes            PASS = 0
100k Preview full sync scan on main thread          PASS = 0 for dataset-backed search
stale/cancelled import authority mutation           PASS = 0
stale worker search replaces newer query            PASS = 0
stale dataset remap replaces newer APPLIED basis    PASS = 0
dataset-backed retained full normalized rows        PASS = 0
dataset-backed retained full raw rows               PASS = 0
startup retained full dataset rows                  PASS = 0 normal path
retained Preview/mapping sample bound                PASS <= 150 each
10k / 50k / 100k browser responsiveness            PASS
qualified WSW engineering-result parity             PASS = 694 comparisons / 0 mismatches
metadata-only dataset-backed main-thread custody     PASS
```

## Protected authority

No intended change was made to:

- APPLIED vs DRAFT mapping semantics;
- support/GAP interpretation;
- XML/CII topology, geometry, or units;
- CII writer/runtime numerical authority;
- Weight Match acceptance semantics;
- B31.3 calculation authority.

Dataset-backed mapping changes remain DRAFT until explicitly applied. Applying a dataset-backed draft uses worker `REMAP_DATASET`; the old APPLIED dataset remains authoritative during the asynchronous remap, and the result is rejected if the basis dataset ID, applied revision, or submitted draft map changed before completion.

## Repository-native backup / recovery evidence

Existing files edited during production and closure slices were protected with repository-native pre-edit backups using:

```bash
node utils/backup.js save <file> "<context>"
```

Temporary backup/apply workflows were removed after use. Recovery copies remain under `.backups/` according to repository policy.

## Repo-wide CI outside PR780 authority

CAESAR, FBX, FBX2, and StagedJSON workflows have independent historical failures outside this XML→CII dataset-worker authority. PR780 acceptance is governed by the Issue #776 applicable differential gate, exact-head WSW conversion/scale evidence, and XML CII semantic timing. Do not expand PR780 to repair unrelated baselines without a separate plan and authority.

## Merge boundary

PR780 remains **Draft**. `MERGE_AUTHORITY = OWNER_ONLY / NOT_GRANTED`.

No merge action has been taken. The bounded implementation and acceptance mission is qualified; the next action is an owner review/merge decision, not additional production mutation unless new evidence identifies a scoped defect.
