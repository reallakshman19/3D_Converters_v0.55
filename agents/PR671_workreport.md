# PR671 — Right-rail current assessment scope selector

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: IMPLEMENTED_AWAITING_NATIVE_BROWSER_QUALIFICATION
WORK_INTENT: IMPLEMENT
CRITICALITY: STANDARD_PRESENTATION_NAVIGATION
REPOSITORY: reallaksh19/3D_Converters
PR: 671
BRANCH: agent/vibration-right-rail-scope-selector-20260819
BASE_BRANCH: main
BASE_SHA_AT_ALLOCATION: 0364664705264f4e20b5dbebb3eb7ab996088111
RECONCILIATION_COMMIT: 1dfc354d10908d84819279c3741addd4b98a0f22
MERGE_AUTHORITY: OWNER_ONLY_NOT_GRANTED_FOR_PR671
```

## Handover in 60 seconds

PR671 lets the existing right-side Vibration Assessment rail switch among exact assessment scopes already present in the current Vibration Integrity register.

```text
current workspace rows
-> VibrationRoadmapScopeChoices.v1
-> right-rail Assessment scope selector
-> vibration-roadmap-controller
-> existing data-vi-row control by exact rowKey
-> existing selected-row status/workflow publication
```

Identity remains `rowKey + line + caseId + canonicalId`. This is navigation only; it does not create or persist project case identity.

## Authority boundary

```text
purpose                 CURRENT_REGISTER_SCOPE_NAVIGATION_ONLY
identitySource          VibrationWorkspaceModel.currentRows
createsCaseIdentity     false
persistenceAuthority    NONE
determinesApplicability false
determinesCompleteness  false
determinesNextAction    false
engineeringAuthority    NONE
screeningAuthority      NOT_AUTHORIZED
designAuthority         false
```

No mechanism applicability, EI completeness, workflow next-action semantics, governing result, engineering disposition, verification, RCA, numerical method/master, design/code/safety, persistence, workflow-file, runtime/writer/canvas authority changes.

## Product behavior

- selector appears only inside an already-governed selected assessment and only when at least two current register scopes exist;
- option labels keep line, case and canonical ID visible;
- exact rowKey selection is validated against the current governed list;
- controller delegates by clicking the existing matching `data-vi-row` control;
- no central Vibration Integrity state is directly mutated;
- no selected row still means no invented selected assessment;
- duplicate row keys, unavailable selected keys, malformed/forged envelopes and missing target controls fail closed.

## Coordination

- #668 merged executable-case-action predecessor.
- #667/#658 merged right-rail/status predecessors.
- #649 open shared UI/cache custody: no claimed shared production/cache path in PR671.
- #665 open Project-v2 persistence: no Project-v2 persistence path in PR671.
- #517 AIV PF-02 and #539 FIT Production Freeze: no file overlap.
- unrelated HP/KD320 #670 advanced main; PR671 was losslessly reconciled onto `0364664705264f4e20b5dbebb3eb7ab996088111` using two-parent commit `1dfc354d10908d84819279c3741addd4b98a0f22` with product/test blobs preserved.

## Product/test blobs

```text
scope module  a7c170402f0a0c93ace797185be25f5a5543a362
test          885d514240baafc5dcbc860c7c81e1fc668be259
bridge        26b4e389ede62db7791ed9180a9e9957000455e3
panel         72393977a4033c76f99341369a0d8c822b64bcf8
controller    5e8e28d70d2b0392c1e381e2e41bc7157077e96e
```

## Validation truth

```text
scope-selector pure contract                  PASS 7/7 / LOCAL_EXECUTION
scope-selection module syntax                 PASS / LOCAL_EXECUTION
exact module/test blob identity               PASS / ARTIFACT_INSPECTION
new JS line policy                            PASS: 91 module / 76 test
bridge/panel/controller integration wiring    PASS / SOURCE_INSPECTION
controller physical lines                     295
repository-native broader regressions         NOT_RUN / ENVIRONMENT_BLOCKED
served browser scope-selector journey         NOT_RUN / ENVIRONMENT_BLOCKED
native node utils/backup.js                   NOT_RUN / ENVIRONMENT_BLOCKED
independent numerical verification            NOT_APPLICABLE / no numerical change
```

Integration source inspection is not represented as runtime PASS.

## Hosted reconciliation

At recovery basis head `3fa4518b3d494f168695be321919babcf7ea1558`:

```text
relation to main              ahead 26 / behind 0
changed paths                 14 / 14 explained
GitHub mergeable              true
draft                         true
comments                      0
reviews                       0
review threads                0
commit status entries         0 -> NOT_RUN, not PASS
PR-triggered workflow runs    0 -> NOT_RUN, not PASS
```

Subsequent commits only synchronize PR671 recovery metadata; product/test blobs above remain frozen.

## Rollback evidence

Pre-edit exact Git-blob copies are retained under `.backups/connector-20260819-vib-right-rail-scope-selector/`. Native backup CLI remains NOT_RUN / ENVIRONMENT_BLOCKED.

## Exact next action

Keep PR671 draft/unmerged. Refresh main and exact-head hosted state before any future merge decision. A new explicit owner authorization for PR671 is required.
