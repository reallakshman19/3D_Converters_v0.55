# PR680 — AssessmentUnit OperatingScenario Snapshot Binding — Recovery Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
MAIN_HEAD_LAST_CHECKED: 68511e14b594eab9e21d06da3ddfc0836e92295b
MERGE_BASE: 68511e14b594eab9e21d06da3ddfc0836e92295b
IMPLEMENTATION_BASIS_HEAD: 13c3b4ddba1474cda0959f95afd6dab4b6cc749b
PR_HEAD_OBSERVED_BEFORE_RECOVERY_SYNC: 33168e85df7aed876bdad80bd14abd3b55025eed
CURRENT_STAGE: DRAFT_READY_FOR_OWNER_REVIEW
CURRENT_BLOCKER: repository-native committed execution unavailable in connector-only runtime
HIGHEST_RISK: direct mechanism paths still bypass the new common guard until the successor adapter-integration PR
EXACT_NEXT_ACTION: owner review/merge PR680; successor PR routes current executable mechanisms through this scenario guard

## Mission
PR680 adds the first-class orchestration seam between `RequiredAssessmentSet.v1`, merged `OperatingScenario.v1`, and future M12 mechanism execution.

```text
RequiredAssessmentSet.v1 + OperatingScenario.v1
-> VibrationAssessmentUnit.v1
-> exact scenarioId + scenarioSnapshotHash custody
-> pre-execution scenario guard
-> caller-provided mechanism callback/kernel
```

## Core behavior
- unit scope line/case must exactly match the bound scenario;
- executable units require a caseId;
- one unit set cannot mix scenarios from different dataset IDs;
- missing/duplicate scenario bindings fail closed;
- `assessmentUnitId` is logical identity and remains stable across revised snapshots of the same scenario;
- `unitSnapshotHash` changes with scenario snapshot / requirement basis;
- stale scenario snapshot fails before callback invocation;
- exact scenario snapshot permits callback invocation;
- tampered unit custody/hash fails.

## Authority boundary
```text
purpose = ASSESSMENT_UNIT_SCENARIO_CUSTODY_ONLY
engineeringAuthority = NONE
screeningAuthority = NOT_AUTHORIZED
designAuthority = false
numericalAuthority = NONE
executionAuthority = NONE
determinesApplicability = false
determinesCompleteness = false
crossScenarioMixingAllowed = false
scenarioSubstitutionAllowed = false
```

The guard proves custody only. It never grants permission to execute a method or changes mechanism authority.

## Changed production/test files
- NEW `converters/vibration/mechanisms/assessment-unit.js` — 252 physical lines
- MODIFIED `converters/vibration/mechanisms/index.js` — export only (+12)
- NEW `tests/vibration-assessment-unit-scenario.test.mjs` — 223 physical lines

Backup/recovery files are separate. Existing FIT/AIV/Mechanical/SBC adapters, calculations, source/master, UI, project persistence, geometry tolerance and process actualization remain read-only.

## Final hosted reconciliation
At observed head `33168e85df7aed876bdad80bd14abd3b55025eed` before recovery-only synchronization:

```text
base / merge base          68511e14b594eab9e21d06da3ddfc0836e92295b
ahead / behind             14 / 0
changed files              7 intended / 0 unexplained
mergeable                  true
draft                      true
reviews                    0
review threads             0
status contexts            0 returned -> NOT_RUN
PR-triggered workflow runs 0 returned -> NOT_RUN
main drift                 none observed
```

Subsequent commits only synchronize this workreport/status and do not change the implementation/test basis.

## Validation ledger
- merged PR678/current-main grounding: PASS / SOURCE_INSPECTION
- RequiredAssessmentSet / mechanism contract trace: PASS / SOURCE_INSPECTION
- open competing PR search: PASS / none found
- physical-line policy: PASS / 252 production, 223 test
- exact changed-path scope: PASS / 7 intended paths
- source-level falsifier coverage: PASS / ENCODED
  - exact binding
  - stable logical ID / moving snapshot ID
  - line/case mismatch
  - missing case
  - mixed datasets
  - missing scenario
  - stale snapshot callback count remains zero
  - exact snapshot callback count one
  - tampered unit rejection
- native checkout: NOT_RUN / ENVIRONMENT_BLOCKED (`github.com` DNS unavailable)
- repository-native committed test: NOT_RUN / ENVIRONMENT_BLOCKED
- status contexts: NOT_RUN / zero returned
- PR workflow runs: NOT_RUN / zero returned
- browser: NOT_APPLICABLE / data-orchestration contract
- independent numerical verification: NOT_APPLICABLE / no equation or engineering value change

No source-level/static evidence is promoted to repository-native execution PASS.

## Successor integration
Do not expand PR680 into adapter-specific changes. After merge, the next PR should route current executable FIT/AIV/Mechanical/SBC preparation through `executeVibrationAssessmentUnitWithScenarioGuard()` (or the basis assertion immediately before their registered kernel calls) and add negative tests proving a changed scenario snapshot cannot reach those mechanism kernels.

Future T2.4/T2.5/T2.9/SBC/T4 implementations then reuse the same path rather than creating their own scenario custody.

## Merge authority
`OWNER_ONLY / NOT_GRANTED_FOR_PR680`.