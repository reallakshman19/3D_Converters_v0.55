# PR688 — Facility Matrix Run Currentness — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #688
BRANCH: agent/vib-matrix-run-currentness-20260821
BASE: main
BASE_SHA_AT_START: 1d0e9245f9a6333ce43fb8085602ec112241a411
PREDECESSOR_PR: 686 (MERGED)
PREDECESSOR_MERGE: 1d0e9245f9a6333ce43fb8085602ec112241a411
CURRENT_STAGE: DRAFT_READY_FOR_REVIEW
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED
HOSTED_RECONCILIATION_HEAD: 00cd5f16a3752c6b3c0325b071523bceba044ef6

## Mission

Prevent Mechanical, SBC and AIV caches from an earlier facility run from appearing current in the live mechanism matrix after a later identical FIT rerun.

This is presentation/currentness only and consumes `VibrationFacilityRunBasis.v1` from merged PR686.

## Confirmed defect and correction

Before this PR both the main facility register and advisory roadmap bridge passed raw secondary-mechanism caches into `buildVibrationMechanismMatrixRow()` through separate local `matrixContext()` functions.

A byte-identical rerun may preserve scenario hashes and scenario-set key while creating a new `runId`; old Mechanical/SBC/AIV caches could therefore be presented as current even though PR686 classifies them as foreign to the new run.

New `VibrationFacilityMechanismCurrentnessProjection.v1` filters `CURRENT_RESULT` presentation input using:

```text
same runId
+ same datasetId
+ deterministic scenarioSetKey from current OperatingScenario[]
+ same exact line/case OperatingScenario snapshot
```

AIV additionally requires a `CURRENT_RESULT / FACILITY_LINKED` session whose execution plan matches the same run/dataset/scenario-set key.

Stale/foreign entries are omitted from current matrix input and retained only as non-numerical projection metadata:

```text
reason = STALE_OR_FOREIGN_RUN_CUSTODY
```

## Scenario-set anti-drift

The projector recomputes `vibrationFacilityScenarioSetKey(operatingScenarios)` and requires exact equality with the claimed current run basis. A stale/tampered key returns:

```text
FACILITY_SCENARIO_SET_INVALID
```

with empty current secondary-mechanism caches.

## STALE_RESULT behavior

When the entire facility result is already `STALE_RESULT`, existing retained-stale inspection remains available:

- Mechanical/SBC cached evidence remains visible for review;
- AIV is explicitly passed with `aivResultState = STALE_RESULT`;
- no current-run projection is claimed.

This prevents a currentness correction from deleting historical inspection evidence.

## Shared matrix ingress

New:

```text
tabs/vibration-integrity-matrix-context.js
```

Both production consumers use it:

```text
tabs/vibration-integrity-view.js
tabs/vibration-integrity-roadmap-bridge.js
```

The duplicate local raw `function matrixContext()` implementations are removed. Main register and advisory right rail therefore share one currentness rule.

## Permanent authority boundary

```text
purpose                    PRESENTATION_CURRENTNESS_FILTER_ONLY
engineeringAuthority       NONE
screeningAuthority         NOT_AUTHORIZED
designAuthority            false
numericalAuthority         NONE
aggregationAuthority       NONE
persistenceAuthority       NONE
determinesApplicability    false
determinesCompleteness     false
determinesGoverningResult  false
blocksExecution            false
blocksNavigation           false
blocksCalculation          false
blocksPersistence          false
```

The right rail remains advisory/linking only. `AssessmentCompleteness.v1` remains the completeness authority. EI main-line aggregation remains separate.

## Effective PR paths

Exactly 10 paths at hosted reconciliation:

```text
.backups/connector-20260821-vib-matrix-run-currentness/tabs/vibration-integrity-view.js
.backups/connector-20260821-vib-matrix-run-currentness/tabs/vibration-integrity-roadmap-bridge.js
agents/PR688_workreport.md
agents/status/PR688.yaml
agents/claims/PR688.yaml
converters/vibration/facility/mechanism-currentness.js
tabs/vibration-integrity-matrix-context.js
tabs/vibration-integrity-view.js
tabs/vibration-integrity-roadmap-bridge.js
tests/vibration-facility-mechanism-currentness.test.mjs
```

No WIP or allocation-marker files remain.

Exact pre-edit source blobs:

```text
view             4f905f8241713935bd56a99745b89823423053f1
roadmap bridge   cb8ede4ad111914160968901d678b3ea058d6bf1
backup commit    fcd51b2875c08b84d0d52ee675a9a75ca09a05de
```

Native repository backup command remains `NOT_RUN / ENVIRONMENT_BLOCKED`; connector backups are exact Git-blob copies.

## Diff quality / line policy

```text
tabs/vibration-integrity-view.js             +2 / -12
tabs/vibration-integrity-roadmap-bridge.js   +5 / -12
mechanism-currentness.js                     151 lines
vibration-integrity-matrix-context.js         46 lines
vibration-facility-mechanism-currentness.test.mjs 211 lines
```

All new JS/MJS files are below the repository `<300` physical-line policy.

## Falsifiers encoded

1. projection authority is non-authorizing and non-blocking;
2. exact current-run Mechanical/SBC caches remain visible;
3. identical rerun rejects previous-run Mechanical/SBC even with equal scenario hash;
4. same-run stale OperatingScenario snapshot is filtered;
5. claimed scenario-set key must equal deterministic OperatingScenario fingerprint;
6. AIV must match exact current facility run and scenario set;
7. whole-facility stale state preserves retained stale inspection;
8. main register and roadmap bridge must share the matrix-context builder and cannot reintroduce local raw matrix contexts.

## Validation truth

Executed/source-confirmed:

```text
predecessor PR686 merge                         PASS / HOSTED
current-main grounding                          PASS / main@1d0e9245f9a6333ce43fb8085602ec112241a411
exact changed-file reconciliation               PASS / 10 intended, 0 unexplained
branch relation at hosted reconciliation        PASS / ahead 24, behind 0
Git-blob pre-edit backups                       PASS / CONNECTOR TREE/BLOB
diff normalization                              PASS / SOURCE_INSPECTION
physical-line policy                            PASS / SOURCE_INSPECTION
open-PR coordination                            PASS / no exact current production overlap
```

Truthfully NOT_RUN:

```text
repository-native focused Node tests            NOT_RUN / ENVIRONMENT_BLOCKED
repository-native vibration regression suite    NOT_RUN / ENVIRONMENT_BLOCKED
served-browser Vibration Integrity journey      NOT_RUN / ENVIRONMENT_BLOCKED
exact-head commit status contexts               NOT_RUN / 0 returned
exact-head PR-triggered workflow runs            NOT_RUN / 0 returned
independent numerical verification              NOT_APPLICABLE / no numerical change
```

Native Git transport was attempted and failed with `Could not resolve host: github.com`. No committed falsifier source is represented as executable PASS.

## Hosted reconciliation

At engineering/recovery head:

```text
head              00cd5f16a3752c6b3c0325b071523bceba044ef6
base/main         1d0e9245f9a6333ce43fb8085602ec112241a411
state             OPEN / DRAFT / UNMERGED
mergeable         true
changed files     10
branch relation   ahead 24 / behind 0
reviews           0
review threads    0
comments          0
status contexts   0 -> NOT_RUN
PR workflow runs  0 -> NOT_RUN
```

Subsequent commits that only synchronize this workreport/status do not change implementation/test blobs.

## Coordination

PR686 is merged and is the direct foundation. Open PR657 owns T1 identification presentation files and does not overlap this exact production surface.

This PR does not modify mechanism kernels, coverage/completeness contracts, EI aggregation, Project v2, source/master records, AIV/FIT calculation code, or right-rail authority.

## Exact next action

1. Keep PR688 draft until owner review/authorization.
2. If a native checkout becomes available, run the focused currentness test plus existing matrix/vibration regressions and browser journey.
3. Reconcile exact PR head again before any merge.
4. Do not merge without a new explicit Owner instruction.

## Appendix A — takeover questions

1. Why can an identical rerun require a different `runId` even when scenario hashes are unchanged?
2. Why must currentness be enforced before cache values reach the mechanism matrix?
3. Why is the scenario-set key recomputed from current OperatingScenario objects?
4. Why must Mechanical/SBC satisfy both run-level and scenario-level custody?
5. Why is AIV checked against its facility-linked plan rather than line/case labels alone?
6. Why is whole-facility stale inspection preserved?
7. Why must the main register and right rail share one matrix-context builder?
8. Which contract still owns completeness?
9. Why may this projector not determine a governing result?
10. Which executable checks remain required before release-quality confidence?
