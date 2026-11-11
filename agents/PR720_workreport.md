# PR720 Work Report

PR: #720 — `feat(vibration): persist M13-M16 lifecycle custody in project v2`

## Mission

Add durable project-container persistence for M13 completion, M14 verification, M15 RCA and M16 mitigation custody without restoring current calculation authority or promoting screening/design authority.

## Exact authority boundary

`VibrationIntegrityProject.v2` is a persistence container only. It does not determine calculation applicability, roadmap completeness, screening acceptance, design acceptance, root cause, mitigation benefit, or current engineering result authority.

The existing M13-M16 ledgers retain their own contracts. In particular their `persistenceAuthority` remains `NONE`; durable storage is provided by the enclosing project container.

The right-rail roadmap remains advisory only and is not an execution prerequisite.

## Implemented persistence seam

- v1 `.vibproj` remains readable and deterministic.
- File open/save alone does not migrate v1.
- First lifecycle mutation upgrades the active project to v2.
- v2 has a closed top-level/activity/authority shape.
- Project activity persists project-scoped M13/M14/M15/M16 ledgers.
- Reopening a v2 project restores those lifecycle ledgers into the Vibration Integrity workspace.
- Project switching replaces prior session lifecycle state rather than transplanting it.
- `currentResults` remains empty-only.
- non-empty `historicalCalculationEvidence` is rejected.
- non-empty reserved `engineeringInputs` namespaces are rejected until separately qualified.
- v2 legacy `actions` is empty-only; legacy v1 actions are quarantined under `extensions.legacyV1Actions` during migration.

## Source falsification review

PASS_WITH_BOUNDARY_NOTE.

- M14/M15/M16 ledger records carry project identity and v2 validates each record against the enclosing project.
- M13 completion records do not carry project identity in the pre-existing M13 contract. PR720 does not invent or promote a new completion-record authority field; M13 is instead contained by the exact project-scoped activity wrapper and cross-project workspace handoff/reset behavior.
- Foreign lifecycle handoff project IDs are rejected before project replacement.
- selected roadmap line is preserved when lifecycle custody updates the project.
- no production vibration equation is changed.

## Validation evidence

Repository-native execution is `NOT_RUN_ENVIRONMENT_BLOCKED`.

GitHub Actions:
- dedicated workflow exists with `pull_request`, matching branch `push`, and `workflow_dispatch` triggers;
- PR-open and the final matching branch push produced zero workflow runs;
- direct workflow dispatch is not exposed by the available GitHub connector.

Local shell:
- `git ls-remote https://github.com/reallaksh19/3D_Converters.git HEAD` failed with `Could not resolve host: github.com`.

Therefore no focused test, full Node suite, or browser result is classified PASS from this work session.

## Merge disposition

OPEN / MERGEABLE at last PR recheck, but execution evidence remains NOT_RUN. Do not represent repository-native execution as PASS. Merge requires explicit owner disposition if that execution gap is to be overridden.

## Exclusions / successors

Not qualified by PR720:
- current or historical calculation-result authority persistence;
- user engineering data persistence;
- identification-authoring persistence;
- explicit assumption persistence;
- automatic root-cause, completion, mitigation-benefit or design conclusions;
- broader EI lifecycle completeness.

## Q1 — Production Trace

Trace one exact project lifecycle round trip end to end before changing any contract:

1. `.vibproj` text enters `parseVibrationIntegrityProject()` and is validated by `assertVibrationIntegrityProject()`.
2. `createVibrationRoadmapController()` owns the active `currentProject`; v1 stays v1 until a lifecycle mutation occurs.
3. `VIBRATION_PROJECT_CHANGED_EVENT` moves the active project into `engineering-calculations-tab.js`, which creates both measurement-evidence and lifecycle handoffs.
4. `renderVibrationIntegrityTab()` restores M13/M14/M15/M16 ledger state through `VibrationProjectLifecycleHandoff.v1`.
5. M13 completion, M14 verification, M15 RCA or M16 mitigation authoring replaces its append-only ledger reference in workspace state.
6. The workspace emits `VIBRATION_PROJECT_LIFECYCLE_CHANGED_EVENT` only when one of those lifecycle ledger references changes.
7. `engineering-calculations-tab.js` relays the handoff to `roadmapController.applyLifecycleHandoff()`.
8. The roadmap controller rejects a foreign project ID, then calls `attachVibrationProjectLifecycleLedgers()`; this is the v1 -> v2 upgrade boundary.
9. The resulting `VibrationIntegrityProject.v2` remains non-authorizing and is emitted again through `VIBRATION_PROJECT_CHANGED_EVENT` without resetting the selected roadmap line.
10. Save uses `serializeVibrationIntegrityProject(currentProject)`; reopen must restore the same persisted lifecycle custody while leaving current calculation authority un-restored.

When debugging, identify the first boundary that differs from this trace. Do not bypass the project container by adding direct local/session storage for engineering lifecycle state.

## Q2 — Current Unresolved Problem / Failure Isolation

The unresolved blocker is execution evidence, not a demonstrated persistence defect:

```text
source falsification review     PASS_WITH_BOUNDARY_NOTE
focused repository tests        NOT_RUN
broader Node regression         NOT_RUN
browser execution               NOT_RUN
GitHub Actions delivery         unavailable / zero runs observed
local GitHub checkout access    blocked by DNS
```

If execution becomes available and a test fails, isolate the first failing boundary before mutation in this order:

```text
v1/v2 schema validation
-> deterministic migration/serialization
-> project-scoped ledger validation
-> lifecycle handoff validation
-> cross-project reset/rejection
-> workspace mutation detection
-> engineering-console relay
-> roadmap project attachment
-> save/reopen restoration
```

Do not change expected values, weaken a validator, widen accepted v2 fields, or reclassify `NOT_RUN` merely to clear the gate.

## Q3 — Authority / Invariant

The successor must demonstrate and preserve all of these invariants:

```text
project container authority                    PERSISTENCE_CONTAINER_ONLY
engineering authority from persistence          NONE
screeningAuthorized                             false
designAuthority                                 false
calculationEligibilityAuthority                 false
lifecycleEvidenceIsCurrentEngineeringAuthority  false
currentResults                                  EMPTY_ONLY
historicalCalculationEvidence                   RESERVED / NONEMPTY REJECTED
engineeringInputs.*                             RESERVED / NONEMPTY REJECTED
v2 legacy actions                               EMPTY_ONLY
roadmap calculation-blocking authority           NONE
```

Additional custody invariants:

- M13 remains caller-attested completion; project scoping is provided by the enclosing activity wrapper and workspace project-reset behavior, not by inventing a new M13 record field.
- M14/M15/M16 records carrying `projectId` must match the enclosing v2 project.
- foreign lifecycle handoffs must fail before active-project replacement.
- opening/saving a v1 project alone must not implicitly upgrade it.
- lifecycle persistence must not restore a historical/imported result as current engineering authority.
- roadmap state remains descriptive/advisory and cannot become an execution prerequisite.

Any proposed change that violates one of these is outside PR720 and requires a separately qualified contract.

## Q4 — Independent Validation

Obtain an exact repository-native execution receipt for the current #720 head without changing expected values first:

```bash
node --test \
  tests/vibration-project-lifecycle-persistence.test.mjs \
  tests/vibration-project-lifecycle-ui-contract.test.mjs \
  tests/vibration-project-eit.test.mjs \
  tests/vibration-project-measurement-persistence.test.mjs \
  tests/vibration-facility-action-completion.test.mjs \
  tests/vibration-mitigation-custody.test.mjs
```

Independently validate at least these falsifiers rather than reading production output as the oracle:

1. Starting from a known v1 project, confirm simple parse/serialize remains v1 and byte-semantically deterministic.
2. Apply known M13-M16 ledgers, serialize the resulting v2 project, parse it again, and compare each ledger record/fingerprint to the independently constructed input custody.
3. Inject a foreign M14/M15/M16 `projectId` and confirm the v2 validator rejects it.
4. Inject `currentResults`, historical calculation evidence, non-empty reserved engineering inputs, extra v2 authority fields, or screening/design/calculation-eligibility promotion and confirm fail-closed rejection.
5. Switch between two distinct project IDs and confirm lifecycle custody is replaced rather than transplanted.
6. Confirm selected roadmap line survives a lifecycle persistence update.

Browser acceptance, when available, should exercise open v1 -> author lifecycle record -> save v2 -> reload page -> reopen v2 -> observe restored lifecycle history, while separately confirming no current result is restored as authoritative.

Until an actual execution receipt exists, keep every unexecuted item `NOT_RUN`.

## Q5 — Next Contribution / Minimal Patch

First obtain and classify the exact #720 focused execution. Then:

- if all focused tests pass, update PR720 validation custody with the exact head/run/job/test counts and proceed only according to owner merge disposition;
- if a test fails, patch only the first failing boundary identified under Q2 and rerun the same focused set before touching adjacent persistence domains;
- do not add persistence for identification authoring, user engineering data, assumptions, historical/current calculation results, or new EI lifecycle modules in the same repair;
- do not change FIT/AIV/Mechanical/SBC equations or authority as part of this persistence successor;
- do not use the roadmap/right rail as a calculation gate.

Only after PR720 is validated/landed should the next persistence contribution separately qualify one currently reserved domain with its own closed schema, project-scope rules, authority falsifiers, deterministic round-trip tests and explicit migration behavior.
