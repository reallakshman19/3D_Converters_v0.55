# PR684 — AIV Facility Scenario Handoff — Recovery Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
CURRENT_STAGE: DRAFT_RECONCILED_UNMERGED
MAIN_HEAD_LAST_CHECKED: 1f8f12daf3846780341ad34ab56f9dc0bde05593
MERGE_BASE: 1f8f12daf3846780341ad34ab56f9dc0bde05593
IMPLEMENTATION_BASIS_HEAD: 08d82ef15fbff4508c5e36e24d755b2efd68ed18
PREDECESSOR_PR: 682 (MERGED)
MERGE_AUTHORITY: NOT_GRANTED_FOR_PR684

## Mission
Bind facility-owned current `OperatingScenario.v1` evidence into AIV execution before `calculateEngineering()` without synthesizing dataset identity from AIV tables.

## Implemented architecture

```text
current Vibration Integrity facility run
-> OperatingScenario.v1[]
-> VibrationFacilityScenarioHandoff.v1
   datasetId
   facilityRunId
   scenarioSetKey = exact identity/snapshot fingerprint of all scenarios
-> Engineering Calculations parent state
-> explicit AIV workspace option/state
-> AIV readiness READY relationship
   sourceLine + caseId
   assessmentLine + caseId
-> AivFacilityScenarioExecutionPlan.v1
   source scenario execution basis
   assessment scenario execution basis
   facility scenario-set key
-> executeAivWithFacilityScenarioCustody()
-> only after custody succeeds: calculateEngineering()
-> AIV screening session = FACILITY_LINKED or STANDALONE
-> facility matrix accepts only FACILITY_LINKED evidence current to the exact facility scenario set
```

## Engineering/runtime invariants

1. AIV source and assessment scenarios must resolve from one governed facility dataset.
2. A linked AIV run with a missing/non-current facility handoff fails before the registered calculation callback.
3. `sourceLine + caseId` and `assessmentLine + caseId` are both bound; case-label equality alone is insufficient.
4. `scenarioSetKey` fingerprints every facility scenario's dataset, scope, scenario ID, identity hash and snapshot hash.
5. Source-line-only scenario drift invalidates prior AIV facility evidence even when the selected assessment-line snapshot is unchanged.
6. Standalone AIV remains executable but cannot satisfy facility Vibration Integrity coverage.
7. AIV remains assessment-scope screening only and cannot govern the facility line.
8. No hidden global facility-scenario singleton is introduced; the parent passes the handoff explicitly.

## Production changes

- `converters/vibration/facility/scenario-handoff.js`: governed handoff, same-dataset/duplicate protection, exact bindings, full scenario-set key.
- `converters/vibration/aiv/aiv-facility-scenario-plan.js`: exact source + assessment relationship scenario bases and currentness inspection.
- `converters/vibration/aiv/aiv-facility-execution.js`: callback-level pre-calculation guard.
- `converters/vibration/facility/fit-execute.js`: facility result retains `scenarioSetKey`.
- `converters/vibration/facility/fit-register.js`: workspace rows retain `scenarioExecutionBasis` + `scenarioSetKey`.
- `tabs/vibration-integrity-roadmap-bridge.js`: publishes only current facility handoff context.
- `tabs/engineering-calculations-tab.js`: explicitly transports facility handoff into AIV.
- `tabs/vibration-aiv-state.js`: standalone vs facility-link intent.
- `tabs/vibration-aiv-qualification-tab.js`: visible STANDALONE / FACILITY LINKED / FACILITY LINK BLOCKED state.
- `tabs/vibration-aiv-execution.js`: registered AIV calculation is reached only after linked custody succeeds.
- `tabs/vibration-aiv-screening-session.js`: records `FACILITY_LINKED` vs `STANDALONE` and linked plan.
- `tabs/vibration-integrity-mechanisms.js`: standalone/stale AIV cannot satisfy facility coverage.

## Tests

- `tests/vibration-aiv-facility-scenario-handoff.test.mjs`
  - one-dataset handoff and deterministic scenario-set key;
  - mixed-dataset rejection;
  - source + assessment scenario mapping;
  - missing-source callback count = 0;
  - non-current-link callback count = 0;
  - exact linked callback count = 1;
  - standalone callback count = 1 with no facility plan;
  - assessment-line drift rejection;
  - source-line-only drift rejection while assessment snapshot remains unchanged;
  - linked vs standalone session classification.
- `tests/vibration-integrity-mechanism-matrix.test.mjs`
  - direct AIV fixtures now obey facility custody;
  - standalone AIV excluded;
  - assessment snapshot drift excluded;
  - source-only scenario-set drift excluded.
- `tests/vibration-facility-fit-execute.test.mjs`
  - legacy fixtures aligned with PR682 scenario-binding requirements;
  - scenario-set key and retained scenario basis asserted.

## Exact PR reconciliation

At PR allocation/reconciliation:

```text
PR                           684
base                         main@1f8f12daf3846780341ad34ab56f9dc0bde05593
state                        OPEN / DRAFT / UNMERGED
changed files                18
production/test paths        15
recovery paths               3
WIP recovery paths           0
allocation markers           0
backup paths                 0
mergeable                    true at ea63bfc78b919481679ea9c1ac2533f91021b4f4
PR-triggered workflow runs   0 at ea63bfc78b919481679ea9c1ac2533f91021b4f4
```

Canonical recovery paths:
- `agents/PR684_workreport.md`
- `agents/status/PR684.yaml`
- `agents/claims/PR684.yaml`

## Validation truth

- current-main grounding: PASS / HOSTED SOURCE
- predecessor PR682 state: PASS / MERGED
- exact changed-file reconciliation: PASS / 18 = 15 production-test + 3 recovery
- overlap: SAFE / PR506 stale salvage-only per merged PR517
- PR mergeability: PASS / true at inspected head
- source/assessment relationship custody falsifiers: ENCODED / NOT_RUN
- callback-unreachable-on-custody-failure falsifiers: ENCODED / NOT_RUN
- standalone/facility separation falsifiers: ENCODED / NOT_RUN
- assessment and source-only scenario drift falsifiers: ENCODED / NOT_RUN
- repository-native Node tests: NOT_RUN / native checkout unavailable in connector runtime
- attempted container GitHub network access: ENVIRONMENT_BLOCKED / DNS resolution unavailable
- browser/Product Freeze: NOT_RUN
- hosted Actions: NOT_RUN / zero PR-triggered runs returned at inspected exact head
- independent numerical verification: N/A / no AIV equation, coefficient, threshold or master-data change

No encoded/static evidence is promoted to repository-native execution PASS.

## Authority boundary

This PR changes runtime custody/orchestration only. It does not change AIV equations/coefficients, EI/ASME source or governed master values, line/case aggregation authority, applicability/completeness authority, process actualization, or design authority.

Permanent boundaries remain:

```text
screeningResultScope = ASSESSMENT
lineCaseSummaryAuthoritativeForScreening = false
designAuthority = false
facility handoff numerical authority = NONE
facility handoff screening authority = NOT_AUTHORIZED
```

## Known validation debt

- Native Node suite is still required on an exact checkout.
- Real-browser navigation/reload should verify visible facility-link state and module-cache behavior.
- No browser PASS is inferred from source changes.

## Appendix A — takeover qualification

1. Why must AIV bind both source-line and assessment-line OperatingScenarios rather than only the assessment line?
2. Why is an assessment snapshot comparison insufficient to detect source-only engineering drift?
3. Why may a standalone successful AIV result remain valid in its workbench but be rejected as facility coverage evidence?
4. What exactly must happen before the registered AIV calculation callback can execute in FACILITY_LINKED mode?
5. Which authority flags remain unchanged by the handoff and why?

Expected expert answer: AIV is relationship-scoped, so both ends and the full coherent facility scenario set are custody; source-only changes can alter the acoustic source while leaving the assessment-line scenario unchanged; standalone calculation lacks facility scenario provenance; linked custody must resolve/validate the exact handoff and relationship scenario bases before callback; and custody never confers numerical, screening-aggregation, applicability/completeness, or design authority.
