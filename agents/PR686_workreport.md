# PR686 — Facility Mechanism Evidence / Run Custody — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #686
BRANCH: agent/vib-facility-mechanism-evidence-20260820
BASE: main
BASE_SHA_AT_START: db5f9e250edfa6fa01097b02ff71b1737ea78436
PR_BASE_CURRENT: cd02030d7d28438ddda8e11ac92acb319cd06cd9
PR_HEAD_OBSERVED_BEFORE_FINAL_REPORT_SYNC: 58d92086d61379cbea770ad4b9dc9816f7f5eea3
REPORT_BASIS_HEAD: 58d92086d61379cbea770ad4b9dc9816f7f5eea3
REPORT_SYNC: CURRENT
PREDECESSOR_PR: 684 (MERGED)
PREDECESSOR_MERGE: db5f9e250edfa6fa01097b02ff71b1737ea78436
CURRENT_STAGE: DRAFT_VALIDATION_BLOCKED
CURRENT_BLOCKER: REPOSITORY_NATIVE_AND_BROWSER_EXECUTION_UNAVAILABLE
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED

## Mission

Bind Mechanical, SBC, and facility-linked AIV evidence to the **specific facility run that produced it**, then project current versus stale/foreign mechanism evidence into the existing FIT reproducibility export without creating another engineering, applicability, completeness, aggregation, persistence, or design authority.

The existing `FitRunSnapshot.v1` and `FitRunEvidencePackage.v1` identities remain intact.

## Runtime/evidence chain

```text
CURRENT facility run
  FitRunSnapshot.v1 -> runId
  VibrationFacilityFitWorkflow.v1
    datasetId
    OperatingScenario.v1[]
    result.scenarioSetKey
      |
      +-> VibrationFacilityRunBasis.v1
      |     runId + datasetId + scenarioSetKey
      |
      +-> Mechanical facility result
      |     scenarioExecutionBasis
      |     facilityRunBasis
      |
      +-> SBC Type-3 facility result
      |     scenarioExecutionBasis
      |     facilityRunBasis
      |
      +-> AIV linked session
            facilityRunId + datasetId + scenarioSetKey
                  |
                  v
VibrationFacilityMechanismEvidence.v1
  currentEvidence[]
  excludedEvidence[] = STALE_OR_FOREIGN
```

## Permanent authority boundary

`VibrationFacilityRunBasis.v1` and `VibrationFacilityMechanismEvidence.v1` are custody/reproducibility contracts only.

```text
engineeringAuthority      NONE
screeningAuthority        NOT_AUTHORIZED
designAuthority           false
numericalAuthority        NONE
aggregationAuthority      NONE
persistenceAuthority      NONE
determinesApplicability   false
determinesCompleteness    false
blocksExecution           false
blocksNavigation          false
blocksCalculation         false
blocksPersistence         false
```

The envelope does not replace `AssessmentCompleteness.v1`, EI main-line aggregation, mechanism applicability, source/master qualification, or any mechanism numerical method.

Existing Mechanical/SBC facility execution guards still require current scenario/run custody as execution-integrity preconditions. That is separate from the non-authorizing evidence projection.

## Engineering/currentness findings

### ISS-001 — identical rerun can preserve scenario identity

A byte-identical rerun can preserve `scenarioSnapshotHash` and `scenarioSetKey` while creating a new facility `runId`. Scenario equality therefore cannot prove that a cached secondary-mechanism result belongs to the latest run.

Resolution:

```text
VibrationFacilityRunBasis.v1 = runId + datasetId + scenarioSetKey
```

Mechanical/SBC retain this basis at evaluation time. AIV already carries `facilityRunId` through merged PR #684. Cross-run reuse fails closed.

### ISS-002 — FIT calculation success must not own secondary scenario validity

A FIT row can be `NOT_ASSESSED_DATA_INCOMPLETE` while its line/case still has a valid `OperatingScenario.v1` usable by another mechanism.

Resolution: current scenario custody is resolved from `workflow.operatingScenarios`. A focused falsifier proves a FIT-incomplete row can admit same-run Mechanical evidence.

### ISS-003 — row/session evidence itself must be current

- register-row scenario basis is checked against the current workflow OperatingScenario;
- linked AIV requires `resultState === CURRENT_RESULT`;
- standalone AIV remains explicitly excluded from facility evidence;
- stale/foreign evidence is not allowed to retain a numerical value in the current-evidence projection.

## Effective changed-file ledger

Exactly 18 effective paths at the hosted reconciliation basis:

Production/contracts:

```text
converters/vibration/facility/run-basis.js
converters/vibration/facility/mechanism-evidence.js
tabs/vibration-integrity-mechanical-controller.js
tabs/vibration-integrity-run-evidence.js
tabs/vibration-integrity-sbc-scenario-execution.js
tabs/vibration-integrity-sbc-type3-controller.js
```

Tests:

```text
tests/vibration-facility-mechanism-evidence.test.mjs
tests/vibration-integrity-run-evidence.test.mjs
tests/vibration-runtime-scenario-guard.test.mjs
```

Connector-side exact pre-edit backups:

```text
.backups/connector-20260820-vib-facility-mechanism-evidence/tabs/vibration-integrity-mechanical-controller.js
.backups/connector-20260820-vib-facility-mechanism-evidence/tabs/vibration-integrity-run-evidence.js
.backups/connector-20260820-vib-facility-mechanism-evidence/tabs/vibration-integrity-sbc-scenario-execution.js
.backups/connector-20260820-vib-facility-mechanism-evidence/tabs/vibration-integrity-sbc-type3-controller.js
.backups/connector-20260820-vib-facility-mechanism-evidence/tests/vibration-integrity-run-evidence.test.mjs
.backups/connector-20260820-vib-facility-mechanism-evidence/tests/vibration-runtime-scenario-guard.test.mjs
```

Recovery:

```text
agents/PR686_workreport.md
agents/status/PR686.yaml
agents/claims/PR686.yaml
```

The three WIP recovery aliases were retired after PR allocation; no WIP duplicate remains in the effective diff.

Native `node utils/backup.js save` remains `NOT_RUN / ENVIRONMENT_BLOCKED`; connector backups are not represented as native backup execution.

## Diff quality / line policy

Whole-file connector formatting churn was removed before PR allocation. Existing production-file deltas are bounded semantic edits:

```text
tabs/vibration-integrity-mechanical-controller.js      +22 / -4
tabs/vibration-integrity-run-evidence.js               +17 / -0
tabs/vibration-integrity-sbc-scenario-execution.js     +21 / -5
tabs/vibration-integrity-sbc-type3-controller.js       +10 / -7
```

New physical files comply with the repository `<300` line policy:

```text
run-basis.js                                      83
mechanism-evidence.js                            224
vibration-facility-mechanism-evidence.test.mjs  275
```

The SBC controller was explicitly reduced below 300 physical lines after a verbose first wiring draft.

## Falsifiers encoded

`tests/vibration-facility-mechanism-evidence.test.mjs` covers:

- envelope has no applicability/completeness/governing/blocking authority;
- exact Mechanical SCREENING evidence admitted;
- exact SBC CANDIDATE evidence admitted without promotion;
- stale scenario evidence excluded without numerical retention;
- identical rerun with same scenario hashes but different runId excludes old Mechanical/SBC;
- standalone AIV excluded;
- non-current linked AIV excluded;
- exact current facility-linked AIV admitted at assessment scope only;
- identical rerun excludes old AIV by facilityRunId;
- source-line-only scenario-set drift excluded;
- FIT-incomplete row can admit same-run Mechanical evidence from current OperatingScenario;
- stale register-row scenario basis fails closed;
- foreign scenario-set register row fails closed.

`tests/vibration-runtime-scenario-guard.test.mjs` additionally proves SBC callbacks receive the originating facility run basis while retaining the existing stale-snapshot pre-callback guard.

`tests/vibration-integrity-run-evidence.test.mjs` asserts that the existing FIT run-evidence export includes the sibling non-authorizing mechanism envelope.

## Validation truth

Executed supporting validation:

```text
current main/source grounding                         PASS / SOURCE_INSPECTION
predecessor #684 merged                              PASS / HOSTED SOURCE
main drift classification                            PASS / PR685 HP-only, no exact overlap
diff normalization                                   PASS / SOURCE_INSPECTION
physical-line policy                                 PASS / SOURCE_INSPECTION
new custody module syntax                            PASS / LOCAL_EXECUTION exact source bytes
reconstructed custody falsifiers                     PASS / LOCAL_EXECUTION faithful dependency stubs
```

The reconstructed execution is supporting implementation evidence only, not repository-native qualification.

Truthfully still not executed:

```text
repository-native focused Node tests                 NOT_RUN / ENVIRONMENT_BLOCKED
repository-native vibration regression suite         NOT_RUN / ENVIRONMENT_BLOCKED
served-browser Vibration Integrity acceptance         NOT_RUN / ENVIRONMENT_BLOCKED
independent numerical verification                    NOT_APPLICABLE / no equation or coefficient change
```

Direct native clone remains unavailable because this runtime cannot resolve GitHub through normal Git transport.

## Main drift / coordination

Current main at reconciliation:

```text
cd02030d7d28438ddda8e11ac92acb319cd06cd9
PR #685 · HP product-matrix full-app browser qualification
```

The branch relation at the reconciliation basis is:

```text
ahead 42 / behind 1
merge base db5f9e250edfa6fa01097b02ff71b1737ea78436
```

The one behind commit is HP-only. No exact production/test file overlap was found, and GitHub reports PR686 mergeable.

Open vibration PRs inspected for coordination include #540, #665, #657, #655, #653, #649, #571, #546 and #508. Their engineering/source/persistence domains are independent of this custody slice; exact-path checks against #508 and #665 found no overlap.

## Hosted reconciliation

At `PR_HEAD_OBSERVED_BEFORE_FINAL_REPORT_SYNC = 58d92086d61379cbea770ad4b9dc9816f7f5eea3`:

```text
PR                           #686
state                        OPEN / DRAFT / UNMERGED
base                         main@cd02030d7d28438ddda8e11ac92acb319cd06cd9
changed files                18 intended / 0 unexplained
commits                      42
mergeable                    true
reviews                      0
review threads               0
conversation/review comments 0
commit status contexts       0 returned -> NOT_RUN
PR-triggered workflow runs   0 returned -> NOT_RUN
```

GitHub initially reported `mergeable=false` at PR allocation, then reported `mergeable=true` after recovery migration. The initial value is treated as a transient allocation snapshot, not as a conflict.

Subsequent commits that only synchronize this workreport/status do not change engineering behavior, test code, authority, or the effective production/test file set. Under that recovery-only freshness rule, `REPORT_SYNC=CURRENT` remains valid.

## Exact next action

In a repository-capable runtime:

```text
node --test tests/vibration-facility-mechanism-evidence.test.mjs
node --test tests/vibration-integrity-run-evidence.test.mjs
node --test tests/vibration-runtime-scenario-guard.test.mjs
```

Then run the relevant Vibration Integrity regressions and served-browser acceptance. Until then, retain `NOT_RUN` truth.

Following this PR, the next bounded systemic slice is to make the **on-screen mechanism matrix/currentness projection** consume `VibrationFacilityRunBasis.v1` so identical-rerun stale Mechanical/SBC/AIV caches cannot appear current in the UI. That successor must consume this custody contract without duplicating `AssessmentCompleteness.v1` or creating new governing authority.

Do not merge PR686 without explicit Owner authorization.

## Appendix A — takeover questions

1. Why are identical scenario hashes insufficient to distinguish two facility reruns?
2. Why must `runId` be retained when Mechanical/SBC are evaluated instead of inferred at export time?
3. Why may a FIT-incomplete row still have a valid OperatingScenario for another mechanism?
4. Why is the workflow OperatingScenario checked rather than blindly trusting a register-row basis?
5. Why must standalone AIV remain excluded even when its numeric result is valid?
6. Why does Mechanical retain SCREENING evidence while SBC remains CANDIDATE in the same envelope?
7. Why must stale/foreign evidence not retain a numerical value in the current projection?
8. Which separate contract determines required-mechanism completeness?
9. What three run-level identities establish custody before scenario-level equality is checked?
10. Which validation classes remain NOT_RUN before a release-quality claim is possible?
