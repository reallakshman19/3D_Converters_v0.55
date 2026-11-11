# PR280 Work report — XML229 actual-JSON engineering Preview stall

**Task:** Owner observed 4 Preview permanently on `Verifying engineering Preview… engineering-preview-using-actual-json` with 385 Line List, 10,699 Piping Class, 383 Material Map, 1,595 Valve Weights rows. Need bounded, cancellable failure rather than an indefinite Worker wait. Do not invent verified Preview engineering facts or automatically accept GC-PW weight decisions.

**Source:** issue #274 and Owner's chat observation 2026-10-16 14:14Z. Branch `fix/xml229-actual-json-preview-startup-deadline-20261016` from merged PR #279 integration branch head `23e6500b53e95ceb986b9a469382828f0685ce2b`. Pull request [#280](https://github.com/reallakshman19/3D_Converters/pull/280), draft, target PR #276 integration branch. Main at task start `9944a5bf521cb67dcabf887d8a5ccce61d4857d2`. Do not change main, merge, or deploy without Owner instruction.

## Verified code finding

`xml229-original-blob-gcpw-worker.mjs` posts the named progress stage immediately before synchronously executing `xmlCiiDryRunPreview(xmlText, isolatedOriginalPreviewWorkConfig(config), stagedSource)`. `xml229-original-blob-gcpw-client.mjs` awaited `started` with no deadline; independent XML census also waited without deadline. `xml-cii-adapted-preview-facts-button-session.js` attached `session.controller` only **after** awaiting `openVerifiedEngineeringSession`, rendering Cancel ineffective during this very hang. The observed stage does **not** prove where within the synchronous dry run the computation is spending its time or that the masters are corrupt.

## Implemented — no engineering authority changes

- Add independent census Worker 120s watchdog, per-stage engineering no-progress Worker watchdog 180s, whole engineering startup limit 720s; terminate Worker and return explicit `ORIGINAL_CENSUS_TIMEOUT`, `ENGINEERING_PREVIEW_WORKER_STALLED`, or `ENGINEERING_PREVIEW_STARTUP_TIMEOUT`. The last stage is non-private.
- Forward `AbortSignal` from the real 4 Preview Cancel and superseding Build through P4 custody to census/engineering Workers. Check aborted before/after asynchronous hydration and successful startup. Actual CII/Weight acceptance and independent source custody unchanged.
- Change root and served `docs/` code together. No private files copied to repo.
- Add regression `tests/xml-cii-229-p4-preview-startup-watchdog.test.mjs` with silent census, stuck exact actual-JSON stage, Cancel during startup, root/docs parity. Include it in Node22/24 targeted CI alongside real original EF05 browser e2e.

## Validation (update with exact-head CI)

- Exact-head `XML229 Canonical Verified Output Readiness` run [38915474105](https://github.com/reallakshman19/3D_Converters/actions/runs/38915474105): at first check Node22 and Node24 PASS; original-preview-to-Weight browser and two EF05 runs still running. Do not claim full PASS until all five are terminal.
- Separate Owner 385-row Line List cannot be reproduced with the public browser fixture (801-row). This is an important fixture difference. No private attachment published.
- Original JSON-governed native CII HOLD remains enforced.

## Highest risk and next action

Watchdog is fail-closed **recovery**, not proof that the particular large synchronous preview algorithm completes under Owner inputs. It must not convert a held Preview into a verified one. **EXACT_NEXT_ACTION:** inspect terminal GitHub Actions run 38915474105 on immutable PR #280 head, investigate failures and reproduce if needed; post source-safe evidence and leave draft for explicit Owner merge. If the Owner's actual-JSON dry run consistently times out, profile the stage as a separate performance root-cause task rather than weakening fact validation.
