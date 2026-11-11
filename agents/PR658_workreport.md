# PR658 — Exact line/case workflow status + right-rail integration

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: MERGE_AUTHORIZED_PENDING
TAKEOVER_AUTHORITY: IMPLEMENTATION_QUALIFIED
REPOSITORY: reallaksh19/3D_Converters
PR: 658
BRANCH: agent/vibration-line-case-status-20260819
BASE_AT_REPLAY: 2c65a77368fbc8db61d77209b36871d985ff4b55
PRE_TAKEOVER_HEAD: b8488028541665ca888f7f6030bb26f51d59c44b
REPLAY_COMMIT: 839d5bb310f694b869b7bf59a75b26ed81fcbea3
PRODUCT_TEST_BASIS_HEAD: bcdf9160f8a2e3cd6f940c9e2e887af8e70950b6
LAST_PREAUTH_RECONCILED_HEAD: edc9c33c3868874de5b3fab63190420a01d4ec59
MERGE_AUTHORITY: OWNER_GRANTED_FOR_PR658_2026-08-19
MERGE_AUTHORIZATION_SOURCE: USER_MESSAGE_MERGE_PROCEED_NEXT
```

## Handover in 60 seconds

PR658 supplies the governed exact selected-facility workflow source consumed by the merged #667 right rail:

```text
selected register row
  line + caseId + canonicalId
-> existing exact-scope T1 resolver
-> existing mechanism matrix
-> AssessmentCompleteness.v1
-> VibrationLineCaseAssessmentStatus.v1
-> transient VibrationIntegrityRoadmapAssessmentContext.v1
-> existing bubbling VIBRATION_ROADMAP_STATE_EVENT
-> right-panel Selected assessment card
```

The card shows exact scope, workflow state, case next action, EI completeness state, and screening-evidence currentness. It does not create case identity, applicability, completeness, screening authority, engineering authority, or persistence authority.

Project `lineId` and facility-register `line` remain separate identities. No mapping is asserted because current project contracts do not prove that identity or persist a governed project case collection.

## Re-ground / salvage

The old PR658 branch was 8 commits behind current main. Drift did not touch the original five product/test paths, so those validated blobs were replayed byte-for-byte onto main `2c65a77368fbc8db61d77209b36871d985ff4b55` rather than merging stale history.

```text
tabs/vibration-integrity-assessment-status.js                dac55dfe7143369000ab6cbe196a8a4c84a329be
tabs/vibration-integrity-assessment-status-view.js           bf9b9b8179cd940db5d9a4c140b2e8ec10d3fae8
tabs/vibration-integrity-view.js                             4f905f8241713935bd56a99745b89823423053f1
tests/vibration-integrity-assessment-status.test.mjs         c4f19c330fd1913e45af8b5ff00542530170e1fd
tests/vibration-integrity-assessment-status-view.test.mjs    340c4704b58cd6c11f42cc815feee4e478e1fea1
```

Replay outcome: `CONTINUE_BYTE_PRESERVING_REPLAY`.

## Authority / invariants

`VibrationLineCaseAssessmentStatus.v1` remains `LINE_CASE_WORKFLOW_STATUS_PROJECTION_ONLY` with:

```text
determinesApplicability       false
determinesCompleteness        false
createsIdentificationEvidence false
numericalAuthority            NONE
engineeringAuthority          NONE
screeningAuthority            NOT_AUTHORIZED
designAuthority               false
safetyAuthority               false
codeCompliance                false
```

The transient right-rail bridge remains `SELECTED_REGISTER_SCOPE_WORKFLOW_CONTEXT_ONLY` with:

```text
determinesApplicability false
determinesCompleteness  false
createsCaseIdentity     false
persistenceAuthority    NONE
engineeringAuthority    NONE
screeningAuthority      NOT_AUTHORIZED
designAuthority         false
```

The panel fails closed unless both selected-context and nested line/case-status authority envelopes are present and non-authorizing. `ASSESSMENT_COMPLETE` remains evidence completeness only; `NOT_APPLICABLE` is consumed, never inferred.

## Product behavior

The Vibration Integrity register exposes `Line/case workflow status` before EI completeness. Selecting a row publishes its exact `line + caseId + canonicalId` state through the existing roadmap event seam. The right rail renders a `Selected assessment` card above generic roadmap attention, including the case next action and the explicit label:

```text
Exact register scope · project mapping not asserted · workflow projection only
```

No selected row produces no case card. Teardown clears the selected context.

## Validation truth

```text
status contract narrow reconstruction                    PASS 9/9 / LOCAL_EXECUTION / unchanged blobs
main drift + overlap classification                      PASS / SOURCE_INSPECTION
byte-preserving replay                                   PASS / ARTIFACT_INSPECTION
bridge consumes governed status                         PASS / SOURCE_INSPECTION
no applicability/completeness/case-identity creation    PASS / SOURCE_INSPECTION
existing roadmap event seam reused                      PASS / SOURCE_INSPECTION
clear selected context on teardown                      PASS / SOURCE_INSPECTION
right rail requires governed authority envelopes        PASS / SOURCE_INSPECTION
new JS source-size policy                               PASS / ARTIFACT_INSPECTION
new line/case right-rail regression                     NOT_RUN / ENVIRONMENT_BLOCKED
repository-native focused/regression suites             NOT_RUN / ENVIRONMENT_BLOCKED
served browser selected-row -> right-rail journey       NOT_RUN / ENVIRONMENT_BLOCKED
native backup CLI                                       NOT_RUN / ENVIRONMENT_BLOCKED
independent numerical verification                      NOT_APPLICABLE / no numerical change
```

Current-head GitHub commit status entries and PR-triggered workflow runs were empty at the owner gate; both are classified `NOT_RUN`, not PASS.

## Intended changed paths

```text
.backups/connector-20260819-vib-linecase-roadmap/tabs/vibration-integrity-tab.js
.backups/connector-20260819-vib-linecase-roadmap/tabs/vibration-roadmap-panel.css
.backups/connector-20260819-vib-linecase-roadmap/tabs/vibration-roadmap-panel.js
agents/PR658_workreport.md
agents/claims/PR658.yaml
agents/status/PR658.yaml
tabs/vibration-integrity-assessment-status-view.js
tabs/vibration-integrity-assessment-status.js
tabs/vibration-integrity-roadmap-bridge.js
tabs/vibration-integrity-tab.js
tabs/vibration-integrity-view.js
tabs/vibration-roadmap-panel.css
tabs/vibration-roadmap-panel.js
tests/vibration-integrity-assessment-status-view.test.mjs
tests/vibration-integrity-assessment-status.test.mjs
tests/vibration-roadmap-linecase-context.test.mjs
```

## Coordination

```text
PR667  MERGED right-rail predecessor; consume main only
PR665  OPEN Project-v2 persistence/currentness; no exact file overlap; no project-case identity source
PR657  OPEN stale presentation neighbor; not consumed as authority
```

No AIV/FIT equation, coefficient, tolerance, unit, method/master, production-freeze authority, governing LOF, Project-v2 schema/currentness, engineering disposition, verification authority, or workflow file changed.

## Takeover qualification

```text
A1 production trace          20/20
A2 failure isolation         20/20
A3 authority/invariants      20/20
A4 independent validation    17/20
A5 minimal patch             20/20
TOTAL                        97/100
RESULT                       IMPLEMENTATION TAKEOVER QUALIFIED
```

## Owner gate

On 2026-08-19 the owner explicitly instructed: `merge, proceed next`. This grants merge authority for PR658 only. It does not grant merge authority to any follow-on PR.

## Exact next action

Mark PR658 ready for review, refresh current head/main/mergeability/checks once more, then squash-merge only if the exact expected head remains clean. After merge, re-ground the next production slice independently.
