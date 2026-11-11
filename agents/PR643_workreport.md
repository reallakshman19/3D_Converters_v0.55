# PR643 — AIV unified canvas interaction hardening

## Recovery header
- PR: #643
- Branch: `agent/vibration-aiv-canvas-interaction-hardening-20260818`
- Base PR: #642 @ `26d6c6800300a9fecf50c88664469070a3f67562`
- WORK_INTENT: IMPLEMENT
- CRITICALITY: ENGINEERING_CRITICAL
- EXECUTION_MODE: AUTO
- AUTO_STATE: PHASE_2_HANDOVER
- MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_THIS_REPAIR_SET

## Handover in 60 seconds
PR643 fixes the confirmed unified-canvas interaction failures after PR642 closes the disconnected-source/branch-lifecycle defect. Navigate clicks on overlaid pipe paths resolve to physical segments; Inspect paths retains relationship selection. Source case edits preserve selection. Canvas errors render inline. Network inspector focus/scroll and Bulk graph edit disclosure survive rerenders. Quick-RV targets are routing-only and branch presentation avoids nearby occupied coordinates. NOT_APPLICABLE overlays are visually inactive.

## Changed-file ledger
Production/UI:
- `tabs/vibration-aiv-unified-canvas-workflow.js`
- `tabs/vibration-aiv-ui-context.js`
- `tabs/vibration-aiv-unified-canvas-author-view.js`
- `tabs/vibration-aiv-state.js`
- `tabs/vibration-aiv-unified-canvas-editor-controller.js`
- `tabs/vibration-aiv-unified-canvas-controller.js`
- `tabs/vibration-aiv-unified-canvas-view.js`
- `tabs/vibration-aiv-qualification-tab.js`
Test:
- `tests/vibration-aiv-unified-canvas-interaction-hardening.test.mjs`
Recovery: PR643/WIP workreport/status/claims.

## Pre-edit rollback blobs
Native backup: `NOT_RUN / ENVIRONMENT_BLOCKED`; blobs are rollback evidence only:
- workflow `53a59246a37a1c82dbcaa16e110759e3ac7563c5`
- UI context `864f26dedd660c6230bc6dbf724bb41b1091203e`
- author view `3bd7f28ed0b675ccc72cd9d05ac5055d2f59b97a`
- state `0f568a573a1eb898bd49565605a7df0e90e2d818`
- editor controller `c6d97d1d8b1da7bc1c3a67da85a6ec20d51a0936`
- unified controller `d859d363f8a875090086ca42bca23597447c5ac0`
- unified view `c93307496e388bb0880aac0644cc453a5b525505`
- qualification tab `f802f67c8644f42133fee46ae706184ca1f48e1a`

## Authority invariants
No numerical AIV method, Stage-9 rule, physical-distance authority, line/case authority, generic EI governing aggregation or design authority changed. AIV line/case remains `NOT_AUTHORIZED`; `designAuthority=false`.

## Validation ledger
- stack against PR642: PASS / source reconciliation — 12 files at allocation, 0 behind.
- interaction contracts: PASS / source inspection and focused regression artifacts.
- repository-native Node tests: NOT_RUN / executable checkout unavailable.
- browser create/edit/add/delete journey: NOT_RUN / Browser unavailable.
- native backup command: NOT_RUN / ENVIRONMENT_BLOCKED.

## Follow-on
Phase 3 will align canvas export evidence custody with normal screening export, fail closed stale detailed results/export, surface welded-discontinuity inventory completeness in canvas, and make projection omissions visible without inventing engineering nodes.

## EXACT_NEXT_ACTION
Refresh exact PR643 head/mergeability/hosted evidence, then create Phase-3 branch from final PR643 head and continue AUTO. Do not merge.
