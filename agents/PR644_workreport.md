# PR644 — AIV canvas evidence custody and result currency

## Recovery header
- PR: #644
- Branch: `agent/vibration-aiv-canvas-evidence-hardening-20260818`
- Base PR: #643 @ `afe72d5cc4859bf4d76e95c83563e86d4169b902`
- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- EXECUTION_MODE: AUTO
- AUTO_STATE: COMPLETE
- CURRENT_STAGE: OWNER_MERGE_GATE
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_THIS_REPAIR_SET

## Handover in 60 seconds
PR644 closes canvas evidence/currency gaps after PR642/PR643. One shared current-screening helper now feeds both normal and canvas export, so canvas export retains network path evidence, EIT custody, inventory attestations and input revision. Stale lineage disables/blocks canvas export. Canvas export carries the unified projection. Inspector numerical details fail closed when stale. Projection omissions are counted and warned without invented nodes. Welded-discontinuity inventory state is visible inside the canvas while line/case authority remains NOT_AUTHORIZED.

The full AUTO repair mission is complete in three stacked draft PRs:
1. #642 — fail-closed disconnected readiness + guarded leaf RV branch lifecycle.
2. #643 — create/edit/add/delete interaction hardening.
3. #644 — evidence/export/currentness hardening.

No merge is authorized. Claims remain active to protect the stack until owner disposition.

## Changed-file ledger
New:
- `tabs/vibration-aiv-screening-package-state.js`
- `tabs/vibration-aiv-canvas-projection-coverage.js`
- `tabs/vibration-aiv-canvas-evidence-view.js`
Modified:
- `tabs/vibration-aiv-execution.js`
- `tabs/vibration-aiv-canvas-export-controller.js`
- `tabs/vibration-aiv-unified-canvas-projection.js`
- `tabs/vibration-aiv-unified-canvas-inspector.js`
- `tabs/vibration-aiv-unified-canvas-view.js`
Tests:
- `tests/vibration-aiv-canvas-export.test.mjs`
- `tests/vibration-aiv-canvas-evidence-hardening.test.mjs`
Recovery: PR644/WIP workreport/status/claims.

## Pre-edit rollback blobs
Native backup: `NOT_RUN / ENVIRONMENT_BLOCKED`; blobs are rollback evidence only:
- execution `74acbf43b5f5f6c515c594efc460240590c625a2`
- canvas export controller `0bd5ccc054cdc5bb6d8d515a6cf1e6567d6c84b0`
- unified projection `72bc196779d263da572dac5ddf33bfa94fd35fa7`
- unified inspector `b058f2dd3e6ef0aaaa6a2bbe8f2d3d5586938176`
- unified view `513f545ab06230b9611e22ebf515329521ece595`
- canvas export test `ba5879d60b8a9103b8b41d496830d7430c2ce5a5`

## Authority invariants
No AIV equations/constants, Stage-9 rule, physical-distance authority, line/case authority, generic EI main-line governing aggregation or design authority changed. Canvas presentation remains non-authoritative; engineering authority remains the embedded screening package; AIV line/case remains `NOT_AUTHORIZED`; `designAuthority=false`.

## Validation ledger
- stack against PR643: PASS / exact compare; zero behind predecessor.
- full export custody/current-lineage contract: PASS / source inspection + updated regression artifacts.
- unified presentation projection: PASS / source inspection.
- stale inspector boundary: PASS / source inspection + focused regression artifact.
- omitted-input disclosure/no-placeholder boundary: PASS / source inspection + pure coverage regression artifact.
- inventory completeness/no-promotion presentation: PASS / source inspection + regression artifact.
- full stack ancestry: PASS — #642 based on main, #643 based on exact #642 head, #644 based on exact #643 head.
- current main drift: PASS / none; `main = b2aaa2ebea54bf568f340c62b2bb767d2ce061ae` at final AUTO audit.
- PR mergeability: PASS / #642, #643 and #644 all GitHub-mergeable at final AUTO audit.
- review submissions: PASS / none on #642/#643/#644.
- inline review threads: PASS / none on #642/#643/#644.
- commit status entries on exact pre-finalization heads: NOT_RUN / empty on #642/#643/#644.
- PR-triggered workflow runs on exact pre-finalization heads: NOT_RUN / empty on #642/#643/#644.
- repository-native Node tests: NOT_RUN / executable checkout unavailable.
- browser create/edit/add/delete/export journey: NOT_RUN / Browser unavailable.
- native backup command: NOT_RUN / ENVIRONMENT_BLOCKED.

## Open coordination note
Repository search still contains older open AIV drafts. Final AUTO review found no current-main drift and no review collision on this stack. Do not infer those older drafts are merged or authoritative; active PR644 claims continue to reserve the repair paths until owner disposition.

## Integration order
#642 correctness → #643 interaction → #644 evidence/currency. Keep all draft until owner grants merge authority and executable/browser gates are handled or explicitly waived by owner.

## EXACT_NEXT_ACTION
Owner disposition only: either (a) provide/obtain repository-native + browser validation and then authorize merge in stack order, (b) explicitly waive unavailable execution gates and authorize merge in stack order, or (c) request further scoped repair. Do not merge without explicit authorization.
