# PR682 — Runtime Scenario Guard Integration — Recovery Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
CURRENT_STAGE: FINAL_RECONCILED_OWNER_MERGE_AUTHORIZED
MAIN_HEAD_LAST_CHECKED: 5dd7e1d239c64e57c4cc0e07b51a0c63af7fb845
MERGE_BASE: 5dd7e1d239c64e57c4cc0e07b51a0c63af7fb845
IMPLEMENTATION_BASIS_HEAD: 37030eeda506ac441d824d65ea37cc7a29af1bb4
PR_HEAD_OBSERVED_BEFORE_FINAL_SYNC: 7c09015f850951f22596877b530ff855ee8c540b
PREDECESSOR_PR: 680 (MERGED)
PREDECESSOR_MERGE: 5dd7e1d239c64e57c4cc0e07b51a0c63af7fb845
MERGE_AUTHORITY: OWNER_GRANTED_2026_08_20

## Mission
Route current facility-owned vibration execution through exact `OperatingScenario.v1` snapshot custody before numerical execution.

This slice covers FIT, Mechanical T2.3 and SBC Type-3 facility paths. AIV remains a separate successor because its standalone workspace does not yet own a governed `VibrationIntegrityDataset` handoff; no dataset/scenario identity is fabricated.

## Implemented runtime chain

```text
OperatingScenario.v1
-> VibrationScenarioExecutionBinding.v1
-> pre-execution identity + snapshot assertion
-> mechanism calculation
-> VibrationScenarioExecutionBasis.v1 retained with result/evidence
```

## Core behavior
- common lower-level scenario guard shared by `VibrationAssessmentUnit.v1` and facility paths;
- FIT plan items carry scenario bindings; all READY FIT items are validated against current scenarios before `calculateEngineeringBatch()`;
- Mechanical T2.3 UI captures the current facility scenario and calls a guarded facility wrapper;
- SBC matrix projection no longer executes Type-3 calculations during rendering/coverage construction;
- SBC master-assisted and legacy explicit-intermediate evaluation buttons both execute through the same facility scenario guard;
- changed scenario snapshot with unchanged logical line/case identity fails before the mechanism callback;
- design authority, screening authority and numerical method authority are unchanged.

## Exact implementation diff
Normalized implementation commit `37030eeda506ac441d824d65ea37cc7a29af1bb4` contains 14 production/test paths plus 3 canonical PR recovery files. No connector backup or WIP recovery file remains in the PR diff.

## Final hosted reconciliation
At observed PR head `7c09015f850951f22596877b530ff855ee8c540b` before this recovery-only sync:

```text
base / merge base           5dd7e1d239c64e57c4cc0e07b51a0c63af7fb845
changed files               17 intended / 0 unexplained
implementation/test paths   14
PR recovery paths           3
mergeable                   true
draft                       true
PR-triggered workflow runs  0 returned -> NOT_RUN
```

Subsequent commit(s) only synchronize this recovery record/status and do not alter the implementation/test basis.

## Validation ledger
- PR680 merged/current-main grounding: PASS / HOSTED SOURCE
- normalized branch ancestry at implementation basis: PASS
- exact implementation changed-path reconciliation: PASS / 14 intended paths
- final PR path reconciliation: PASS / 17 intended paths
- stale snapshot common callback falsifier: ENCODED / NOT_RUN
- exact snapshot callback count=1 falsifier: ENCODED / NOT_RUN
- FIT stale scenario pre-batch rejection: ENCODED / NOT_RUN
- Mechanical stale scenario rejection: ENCODED / NOT_RUN
- SBC stale scenario callback rejection: ENCODED / NOT_RUN
- legacy SBC explicit route stale rejection: ENCODED / NOT_RUN
- SBC matrix calculation-import negative assurance: ENCODED / NOT_RUN
- repository-native Node execution: NOT_RUN / connector-only runtime
- hosted PR workflows: NOT_RUN / zero returned
- browser/Product Freeze: NOT_RUN / not required for this orchestration-only slice
- independent numerical verification: N/A / no equation, coefficient, LOF threshold or engineering master change

No source/static evidence is promoted to repository-native execution PASS.

## Authority boundary
This PR changes scenario custody/orchestration only. It does not grant execution authority, determine applicability/completeness, change mechanism equations, change source/master qualification, actualize process data, or grant design authority.

## Known successor
AIV facility handoff: bind the standalone AIV screening request to the governed facility scenario set before `calculateEngineering()` without synthesizing a dataset identity from AIV tables.

## Appendix A — takeover qualification
1. Why must a same `scenarioId` with a changed `scenarioSnapshotHash` fail before a kernel callback?
2. Why is `line + caseId` equality insufficient without `datasetId`, identity hash and snapshot hash custody?
3. Why must the SBC matrix use inspection of precomputed evidence rather than executing Type-3 calculation during projection?

Expected expert answer: scenario logical identity is stable across revision while snapshot custody captures the exact engineering state; line/case labels alone cannot prove dataset/revision identity; and UI/coverage projection must never become numerical authority or cause solver side effects.
