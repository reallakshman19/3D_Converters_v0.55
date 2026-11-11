# XML229 G3 read-only candidate coverage contract

Status: **DRAFT / diagnostic-only**. Parent #274 G3, #229 and independent Worker ownership #226. Owner's 2026-10-16 19:05:40 instruction is to merge the pending integration and proceed with one pending task, then update the issue; it is not native CII authorization.

## Current implementation
The merged source-bound original-json/GC-PW Worker already owns the independently attested 7-FactRecord-per-physical census and a sole authoritative `session.review.getProposals()` scorer plus separate Match-1 and Final CAS decision ledgers. This G3 candidate uses its pre-existing `weightProjection.proposals(ids)` (which pages the *actual* scorer), `weightProjection.get(id).sourceKg` (fact-based original source mass) and read-only `getDecisionState` (stage revision). No new ranking rules, proposal generation, bulk approval or Final writer. It is bounded in 64-occurrence batches and fails closed when required current-basis input is unavailable or more than 100,000 physical originals would be processed synchronously.

New read-only `readCandidateCoverage()` emits `XML229.G3.CandidateCoverageReport.v1`: source/input-basis/generation/request SHA identifiers, complete physical and verified fact counts, zero/one/multiple candidate distribution, qualified/unqualified candidate totals, occurrences with qualified candidates vs only unqualified, positive/null/invalid original source kg population, and **separate** Match-1/Final accepted/rejected/deferred counts and CAS revisions. It never includes raw original XML, staged JSON, master rows/mappings, raw proposed kg, candidate IDs, physical occurrence IDs or rejection evidence. It does **not** mark reviewed, complete, releasable or qualified native; all review/native authority flags remain `false` regardless of counts.

## Validation
- Pure synthetic Node suite: complete 4-physical census; 0/1/multi, qualified/unqualified, real manual-source kg vs proposal counts, Match-1 and Final distinction, source/decision drift, zero/invalid proposals, privacy, 64-size chunking and rejection of stale/foreign owners.
- Exact real-repository P4 Node22/24 Worker qualification: new suite imported into the current P4 fact test entrypoint.
- Real original-Blob Chromium P4 scenario: read coverage on the same worker before any engineer accepts Match-1; separately accept Match-1 and Final through existing explicit UI-bound review calls; compare the read-only report after. Assert no native release, no candidate/owner row leaks.
- `tabs/` / `docs/tabs/` worker and client mirrors are byte-identical; pre-edit backups under `.backups/20261016-xml229-g3-coverage`.

**No Owner private 385 / 10,699 / 383 / 1,595 master case or 41 / 423 / 2,961 complete private corpus has run.** If the Owner's 423 unresolved original physicals still report zero qualified candidates or only unqualified candidates, do not infer a bug before inspecting exact source/master joins and legitimate eligibility reasons. This report has not produced a population distribution for the Owner's private input. It is an aggregate diagnostic and a decision support input, not an approval.

## Hard gates
Do not add a second scorer or allow `0 candidate`/suggestion counts to mutate Match-1/Final, original source mass, Run or native CII. Missing current request, stale source/master, duplicate original owner, changed review revision, or incomplete physical facts must fail closed. Keep governed native JSON CII release HELD until independently verified physical-slot actual output. Public CI does not establish Owner acceptance or peak Worker/browser memory.

## Next
Validate targeted GitHub Actions on exact PR head, compare the public Chromium census and report before/after explicit acceptance, then capture **redacted aggregate-only** results from Owner-controlled original input. Measure G2 memory/time concurrently in that private setup; reconcile G4 canonical Output/Run report with all UI/manifest status consumers and then implement G5 independent native-CII correspondence qualification. Never upload private original files to public CI.
