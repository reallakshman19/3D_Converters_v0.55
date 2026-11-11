# A3-U3.1 — Actual Preview Worker → immutable engineering fact read-model → Weight gate

**Authority:** #1034, #999, #921, #1000, #1001. Source baseline main 5edb77a839b3e2b1e4ae49e743b2573eb0aa6c7a (includes #1031, #1033, #1035, #1036, #1037).

This is a small **execution adapter**, not another GC-PW schema and not a change to Preview/Weight agents' runtime files. The new integrator-only module is a bound loadFactPages callback that the already merged openGcPwPreviewWeightSession can execute. It calls the existing Preview job controller/start handle, checks its requestId/basisId, observes cancellation, requires real independent original source Branch+Node coverage and a separate engineering-verified Preview read model, consumes its getFacts cursor pages, then passes those **unchanged** to the existing #1031 full-hash/canonical physical bridge + Weight ledger. The consumer remains proposed-only until explicit Match1/Final commands.

## Cold source findings — must preserve

- Merged P2.2 Worker at xml-cii-adapted-preview-facts-worker-entry.js reports engineeringAcceptance: NOT_ASSESSED / fullFactPopulationAccepted:false, even when dryrun Branch rows completed. It is **not an engineering-complete source-to-physical FactRecord producer**. Current controller explicitly requires those false values on successful local execution.
- Merged P3-B1 source inspector at xml-cii-adapted-preview-facts-browser-read.js opens source.occurrence records and explicitly marks engineeringReady:false; every source-only page complete:false. Its actual original source census is useful custody, NOT B31.3, Material Code, wall/size/Rating/weight engineering resolution.
- Therefore direct exposure of Preview's current worker output to Weight is a correctness defect. No authoring work or synthetic successful fixture may re-label current production as green. This adapter rejects it with ENGINEERING_NOT_VERIFIED or ENGINEERING_MODEL_NOT_VERIFIED.
- A future Worker must explicitly verify all required per-source engineered FactRecords against the independent original census; a model must have computationStage engineering-verified, exact basis/expected count and complete cursor pages. Success flags are not sufficient alone: #1031 and #1028 still independently challenge live source/master revisions, source→physical identity, every mandatory field, provenance and tamper.

## Bound responsibilities / proof

1. **Job custody:** full digest validation before start; requestId/basisId binding; typed cancellation before and after async work; wrong worker lease never becomes fact authority.
2. **Dual completion gate:** Worker must report independently verified population and original Branch+Node **identities** as well as count; `expectedOriginalOccurrences` is a separately obtained source-local independent XML census with sourceId/occurrenceId/subjectType (not copied from Worker). The reader must separately be engineering-ready, with independently expected record population. Runtime #1032/1035 correctly fails this gate until P's P3-B2/P4 work is delivered.
3. **Bounded pagination:** getFacts on physical-component (not review nodeRows), 1..200 page size; reject incomplete pages, cursor loops, changed total and count mismatches; never silently trim to viewport/first 100.
4. **Real consumer demonstration:** tests import merged Preview job controller/read model and merged integrator/Weight session with real Node SHA-256; a positive **synthetic fully attested engineering fixture** opens Weight with revision null. Negative current-worker replay proves no product acceptance. Root/docs module parity checked.

## Handoff and release

**Agent P #1000** must generate independent full engineering FactRecords and source selection proof in the Worker (and revise the P job-controller result acceptance contract deliberately). **Agent W #1001** owns Match1 and Final revisions. **Integrator #999** can connect this adapter to actual UI/phase registry *only* after real worker fact completion is proven in source and browser; this task does not edit that UI or create a fake review button. J05 #926 owns Material Code/B31.3 proof; J06 #927 owns PL01+PL06 19 original Branch/871 Node/322 -1 and actual CII mass conservation.

The retained owner-scale 385/10699/383/1595 and original private master sources are not certified by a fixture success. The gate is intended to block unsafe export and expose the exact next engineering responsibility. No API server or second ranker.
