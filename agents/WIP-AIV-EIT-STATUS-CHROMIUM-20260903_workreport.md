# WIP-AIV-EIT-STATUS-CHROMIUM-20260903

WORK_ITEM_KEY: owner-direct:reallaksh19/3D_Converters:AIV-EIT-import-status-chromium
WORK_ITEM_MODE: EXCLUSIVE
BRANCH: fix/aiv-eit-import-status-chromium-20260903
BASE_MAIN: 06697380b8ad71980399d540362639c095733dd5
ENGINEERING_CRITICAL: YES
TAKEOVER_AUTHORITY: WRITE_ALLOWED_AFTER_QUALIFICATION
OWNER_DIRECTIVE: 2026-09-03T10:10:17Z — "rebase. why app shows below error ... Ensure that you are able to run in chromium"
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
COORDINATION_STATE: SAFE_WITH_STALE_PR506_NOT_USED

## Mission

Explain and correct misleading AIV release-status presentation after importing the controlled EI AVIFF v5 worked-example `.eit`, without promoting historical `.eit` results into current screening authority. Verify the corrected presentation in Chromium.

## Ground truth

- User Common source: `reallaksh19/Common@e3ace4802a022f565f95b4af7f01a203df82dbcd/Energy-Institute-AVIFF---Worked-Examples.eit`.
- The file is unchanged from the previously controlled worked-example lineage and contains 12 lines / 7 pipes / 15 streams / 3 AIV lines.
- Import succeeds into `AivEitImportPackage.v1` working state; historical `line.aiv` remains REVIEW_REQUIRED evidence only.
- `tabs/vibration-aiv-eit-import-controller.js` intentionally sets `state.benchmark.loaded = null` after `.eit` import.
- `tabs/vibration-aiv-promotion-view.js` currently maps every no-benchmark state to `CONTROLLED_BENCHMARK_NOT_LOADED`, even when `state.eitImport` proves a historical `.eit` was loaded.
- The same view hardcodes GitHub Actions as NOT_RUN/budget-blocked, which is stale because PR724 produced actual hosted workflow runs on 2026-09-03.
- Legacy worked-example records omit some modern screening evidence, especially explicit physical Source→Assessment distance and modern assessment/branch geometry. The importer must not invent those values; readiness/current screening remains a separate rerun gate.

## Appendix A qualification

A1 Production trace: Common v5 JSON -> `parseAivEitImport` -> working Sources/Assessments/Relationships -> `importAivEitFileIntoState` -> `state.eitImport` + benchmark cleared -> promotion/result/readiness views.

A2 Failure isolation: first wrong presentation boundary is `renderAivPromotionReadinessHtml`: it tests only `state.benchmark.loaded` and ignores `state.eitImport`, conflating imported historical evidence with an empty workspace. Separate stale CI text is also in this renderer.

A3 Authority invariant: imported `line.aiv` is never current screening authority; `screeningResultScopeAfterRerun=ASSESSMENT`; line/case summary remains non-authoritative; `designAuthority=false`.

A4 Independent validation: exact Common payload shows three AIV lines; existing controlled-sonic regression encodes the same three legacy vectors and their frozen PWL values. Common commit comparison shows the `.eit` path did not change between the controlled lineage and the user-supplied ref.

A5 Minimal patch: presentation status classification + focused regression only. No import/readiness/calculation/export contract mutation. Chromium must render the imported state with an explicit review/rerun status and without the stale Actions-budget claim.

QUALIFICATION_STATE: PASS
QUALIFICATION_SCORE: 97/100

## Protected invariants

- no AIV equations/coefficient changes;
- no imported historical result authority promotion;
- no physical-distance inference from SVG or legacy geometry;
- no automatic filling of missing modern evidence;
- no workflow changes;
- no runtime/writer/canvas ownership changes;
- controlled benchmark exact-input PASS remains unchanged when the internal benchmark is actually loaded.

## Validation truth before mutation

SOURCE_TRACE: PASS
COMMON_FILE_DRIFT_CHECK: PASS / file path unchanged across compared Common lineage
CHROMIUM_CORRECTED_UI: NOT_RUN
REPOSITORY_NATIVE_NODE: NOT_RUN
HOSTED_ACTIONS: NOT_RUN_FOR_THIS_BRANCH

## Exact next action

Create the mandatory backup for `tabs/vibration-aiv-promotion-view.js`, patch only promotion status presentation, add focused tests, then execute the corrected imported-state presentation in Chromium. Preserve release/readiness authority semantics unchanged.
