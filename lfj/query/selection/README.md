# LFJ R08 — committed original-source occurrence selection

**Governance:** [R08 #1082](https://github.com/reallaksh19/3D_Converters/issues/1082), claim `C3_SELECT` (existing four semantic units), V3.2 claim-first [admission #1083](https://github.com/reallaksh19/3D_Converters/pull/1083) merged before product edits; predecessor R05/R07 accepted. Sole product source `lfj/query/selection/**`. First consumer target is the Resolver adapter, but **no Resolver/Zone/POS/PS/XML/CII logic belongs in this generic selector**.

## Contract and real source authority

`selectCommittedOccurrences(view, query, {onSelectedPage,pageRows,maxPageBytes,signal})` accepts:

- **Trusted committed view**, supplied by a future backing index/storage adapter, with `manifest` matching complete `LFJ.JSON.OccurrenceIndexSummary.v1`, genuine terminal R07 `completion` of kind `SOURCE_INDEX_COMPLETE`, and asynchronous `readOrdered()` that yields committed R05 `OPEN` records in exact source ordinal order. `readOrdered()` **must not** reparse full source bytes per query/page. R08 checks manifest-completion and basis equality; a JS object claiming completion alone is not cryptographic authority. The adapter must enforce index visibility and provenance.
- **Explicit query** with `mode:'ALL'|'NONE'|'EXPLICIT'`, `includes:originalOccurrenceId[]`, `excludes:originalOccurrenceId[]` and required `sourceBasis:{sourceRefId,sourceSha256,sourceRevision}`. The source basis is the selected input snapshot, not filename, string length, display label, or GC-PW engineering ID. Optional synchronous `getCurrentBasis()` is checked before/after awaited staged-page publication and at completion, refusing changed sources.
- **Provisional sink** `onSelectedPage(page)` receives source-ordered selections bounded by both row count and serialized UTF-8 byte size, with backpressure. A sink **must stage, never expose as accepted**: completion is authorized only after the function returns `LFJ.OccurrenceSelectionSummary.v1` with `complete:true`. On any rejection, caller discards/aborts provisional pages; the function cannot roll back arbitrary external storage.
- Output rights always `SOURCE_FACTS_ONLY`, `engineeringReady:false`. R07 `SOURCE_INDEX_COMPLETE` is not an XML/CII or engineering match/export gate.

No unbounded `JSON.parse`, source cloning or Site/Zone inference is performed by the selector. It uses only source occurrence identity, parent ancestry, source order, source revision and a bounded output page. It validates a complete ordered row count; if the committed reader is truncated, stale, malformed or outside the requested source basis, no complete selection is returned. Nested exclusion dominates descendant re-inclusion. Repeated text names across distinct source occurrences never merge.

## Integration limits — do not misrepresent as delivered

**R05 has no default persistent query store**, and **R07 has only a caller-injected synchronous staging/commit seam**; this unit does not implement IndexedDB/OPFS, spill, atomic persistent storage, or a production query index. Its native fixture assembles genuine R05 and R07 source facts in memory for *small* independent expected-output tests. That does not qualify large-source RAM bounds or live application adoption. A production `CommittedOccurrenceView` backed by verified storage is required for R09/R10/R12; any write outside R08's lease requires an authorized V3.2 graph amendment. R09 must provide resumable paging/cursors rather than repeat a full source scan per visible page.

Likewise, **R02 typed Site/Zone ownership inputs differ from R05 syntactic JSON-value OPEN rows**. Domain/profile adapter projection is owned separately, before real R12 Resolver UI use. This module is source-occurrence selection only. No deployed `docs/lfj` Worker or populated 30/90MB performance/engineering-output golden is accepted here.

## Independent checks

`node --test lfj/query/selection/*.test.mjs` tests genuine R03 original bytes, full R05 source census with handwritten expected RFC6901 paths, R06 consumed-byte native Worker receipt and R07 atomic source-only commit; parent include, exclusions, repeated names and escaped keys; missing/mismatched/late-changed source query basis, incomplete index, and noncommitted receipts. Hosted exact-head Node22/24 and retained LFJ + GC-PW/Chromium checks are required for accepted product evidence. The first test-only RED had a missing implementation; a later semantic RED correctly showed three stale-basis refusals absent before their production fix. The tests do not substitute for real app source→output acceptance.
