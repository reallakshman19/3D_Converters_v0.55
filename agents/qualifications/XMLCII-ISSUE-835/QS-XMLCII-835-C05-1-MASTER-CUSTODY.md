# QS-XMLCII-835-C05.1 — Standalone master custody architecture and cold-load baseline

## Responsibility

- Issue: #835 / C05.1
- Parent: #822 / C05
- Protocol: `reallaksh19/Common@3fd3a971f51a7f2a502edcb194eb9c3d729c37c8:skills/engineering-pr-delivery-v3.2`
- Material base: `db926a1ecf6ae2dd72735d9ab9c03e029c9e4239`
- Scope: architecture/readback + baseline only.
- Production repair: prohibited in this child.

## Existing Standalone custody

At the C04 material base, the save/hydrate control plane is:

```text
import
  -> master-dataset-service.finalizeDataset()
       -> normalize rows
       -> create datasetId + datasetRevision
       -> retain worker in-memory dataset
       -> store.persistDataset(metadata + mappingRows, normalized rows)
       -> DATASET_READY
  -> commitDatasetReadyMaster()
       -> commitAppliedMaster()
       -> datasetRef + preview/mapping state
       -> persistChangedMasterDetailed()
       -> localStorage xml-cii-master-source-<key>

cold startup
  -> mode-a-easy-bulk-v6
       -> hydratePersistedMasterDatasets()
       -> localStorage custody discovery
       -> IndexedDB metadata/rows lookup
       -> applyLoadedDatasets()
       -> masterContext.datasetRefs / rowCounts / previewRows / sourceMetadata
```

### Custody split

| Layer | Current role | C04 observation |
| --- | --- | --- |
| Worker memory | active normalized rows + dataset metadata | `datasetRevision` exists |
| IndexedDB | durable metadata + normalized row payload | metadata receives `datasetRevision` |
| localStorage | compact restart custody | carries datasetId, rowCount, fieldMap, appliedRevision; startup reader does not retain datasetRevision |
| startup datasetRef | runtime re-attach identity | carries datasetId/rowCount/fileName/fieldMap/persistence, but not datasetRevision |

The C04 worker therefore creates and persists a dataset revision, while startup custody drops that revision before/at re-attachment.

## Independent master baseline contract

`tests/xml-cii-issue-835-master-custody-baseline.test.mjs` probes the three requested masters separately.

Each probe validates:

1. save boundary can produce/persist datasetRevision — PASS expected;
2. restart custody discovery finds the datasetId — PASS expected;
3. datasetRevision survives cold hydration — RED expected at C04 head;
4. row preview/count hydrate — PASS expected;
5. runtime datasetRef re-attaches as IndexedDB custody and preserves applied mapping revision — PASS expected.

Expected C04-head matrix:

| Master | Save | Discovery | Identity / revision | Hydrate | Runtime re-attach | Failure class |
| --- | --- | --- | --- | --- | --- | --- |
| Piping Class | PASS | PASS | RED | PASS | PASS | IDENTITY_REVISION |
| PCF_MAT_MAP.TXT | PASS | PASS | RED | PASS | PASS | IDENTITY_REVISION |
| Valve Weight | PASS | PASS | RED | PASS | PASS | IDENTITY_REVISION |

This baseline deliberately does not implement the repair.

## Other C05 boundaries observed but not owned by #835

The C04 source also shows:

- `finalizeDataset()` awaits IndexedDB persistence before returning DATASET_READY; storage failure can therefore abort active-session import. Repair belongs to #839.
- `hydratePersistedMasterDatasets()` uses one `Promise.all` over all persisted masters; one invalid dataset can suppress otherwise valid restores. Per-master repair is allocated across #836–#838 and combined behavior to #840.
- active Mode-A catches cold hydration failure and only `console.error()`s it. User-visible persistence failure semantics belong to #839.

Those findings are classified here for custody completeness, not repaired.

## Advanced_Analysis comparison basis

Comparison source inspected at `reallaksh19/Advanced_Analysis@11eca8e40e560fc2e5f0866489f0b419e1b5afb1`:

- `src/workspace/master-data-controller.js`
- `agents/PR1227_workreport.md`

The proven pattern is:

- per-master IndexedDB records rather than one aggregate failure domain;
- per-master restore iteration, so absent/invalid individual records do not require all masters to fail together;
- monotonic per-master runtime revisions;
- source hash/identity and runtime revision remain separate concepts;
- transaction boundaries are explicit: one logical applied change -> one persistence request -> one update event.

Architectural rule recorded by Advanced_Analysis PR1227:

```text
Hashes establish engineering identity.
Revisions establish runtime currentness.
Indexes eliminate repeated discovery.
Transactions ensure one logical change causes one invalidation.
```

C05 should reuse these separation principles without importing a second storage format into XML->CII Standalone.

## Supporting prior evidence

Parent #822 previously produced hosted RED evidence at commit
`3fd53def019d25c1ef7a23ae720eed13a876830d`, Issue 776 run
`37461549253`. That evidence is supporting/reconstruction input only; #835 must publish its own responsibility-scoped result from the isolated branch.

## Qualification boundary

A PASS for this child means the architecture and current RED/PASS baseline are proven and durable. It does **not** mean persistence is repaired. Repair ownership begins at #836.
