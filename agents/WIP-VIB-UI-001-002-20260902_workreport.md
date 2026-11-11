# Vibration UI-001 + UI-002 — implementation handover

```text
WORK_INTENT              IMPLEMENTATION
SOURCE_AUDIT             agents/WIP-VIB-UI-AUDIT-20260902_workreport.md
IMPLEMENTATION_BRANCH    agent/vibration-ui-audit-20260902
IMPLEMENTATION_BASE      main@bff53e336bdbddbe0fb829b7991ca5ed27fc836a
NUMERICAL_CHANGE         NONE
AUTHORITY_CHANGE         NONE
PERSISTENCE_CHANGE       NONE
RIGHT_RAIL_AUTHORITY     GUIDANCE_ONLY / NON_BLOCKING
```

## Scope

This bounded slice implements only the first two P1 findings from the source/interaction-contract audit:

- UI-001 — preserve right-rail scroll/focus across state-driven rail rebuilds;
- UI-002 — eliminate silent workspace/assessment routing no-ops.

Typography, resize ARIA/hit target, collapse semantics, informational-node semantics, live-region semantics, selected-assessment authority diagnostics, browser interaction coverage, preference persistence, and viewport tuning remain successor work.

## UI-001 implementation

A dedicated `tabs/vibration-roadmap-view-state.js` contract now captures:

- `.vibration-roadmap-scroll.scrollTop`;
- `.vibration-roadmap-scroll.scrollLeft`;
- a semantic focus key for the focused descendant when focus is inside the rail.

Semantic focus keys cover collapse/resize controls, project actions, line/assessment selectors, workspace routes, calculation routes, and roadmap node IDs. Roadmap nodes now emit stable `data-roadmap-node-id` attributes for focus restoration.

`createVibrationRoadmapController().render()` captures view state before the old rail is removed and restores it after the new rail is inserted.

Focus restoration is deliberately conservative:

```text
restore only if prior focus was inside the rail
AND the equivalent semantic target still exists
AND current focus is body/documentElement or the old focused node is disconnected
```

A live external focus target is never overridden. Scroll restoration is independent of focus restoration.

## UI-002 implementation

Workspace and assessment navigation no longer use optional-chained `.click()` calls.

Explicit fail-visible branches now cover:

```text
VIBRATION_ROADMAP_WORKSPACE_ROUTE_UNRESOLVED
VIBRATION_ROADMAP_WORKSPACE_ROUTE_MISMATCH
VIBRATION_ROADMAP_WORKSPACE_TARGET_NOT_FOUND
VIBRATION_ROADMAP_ASSESSMENT_SCOPE_UNRESOLVED
VIBRATION_ROADMAP_ASSESSMENT_TARGET_NOT_FOUND
```

Failures render a visible `Navigation unavailable` diagnostic with a machine-readable `data-roadmap-navigation-code`.

The navigation diagnostic is centralized in `tabs/vibration-roadmap-navigation-diagnostic.js`. Its object shape and authority envelope are closed: unknown top-level or authority fields are rejected by the renderer-side validator rather than tolerated.

The diagnostic authority envelope is intentionally non-engineering:

```text
purpose                  UI_NAVIGATION_DIAGNOSTIC_ONLY
engineeringAuthority     NONE
screeningAuthority       NOT_AUTHORIZED
designAuthority          false
determinesApplicability  false
determinesCompleteness   false
blocksCalculation         false
```

Malformed, authority-promoting, or authority-shape-extending navigation diagnostics are not projected by the panel renderer.

A successful route clears any prior navigation diagnostic before invoking the existing workspace/assessment click seam. No second calculation router or workflow gatekeeper was introduced.

## Validation

```text
Branch re-ground to current main                 PASS
Effective branch behind main                     0 at PR creation
UI-001 standalone Node unit oracle               PASS / 4 tests
UI-002 diagnostic contract Node oracle           PASS / 2 tests
UI-002 source contract tests                     AUTHORED
UI-002 renderer diagnostic tests                 AUTHORED
Hosted Vibration Production Freeze Validation    FAIL
Hosted Stage-4 precheck                          31 PASS / 8 FAIL on recorded run
Full repository-native Node suite                SKIPPED by workflow after Stage-4 failure
Hosted Chromium production-freeze journey        SKIPPED by workflow after Stage-4 failure
Rendered Vibration UI interaction regression     NOT_RUN / successor UI-010
Screenshot/viewport verification                 NOT_RUN
Numerical verification                           NOT_APPLICABLE
```

The standalone UI-001 oracle exercised semantic focus keys, scroll capture, focus+scroll restoration, and the no-focus-steal rule; all four tests passed.

The standalone UI-002 diagnostic oracle executed the exact pure diagnostic contract and verified closed authority shape, rejection of unknown authority fields, rejection of `blocksCalculation: true`, required code/message fields, and invalid-details rejection; both tests passed.

### Hosted failure disposition

PR #707 triggered `Vibration Production Freeze Validation` run `33609689839`. Its `node-and-chromium` job failed in the workflow's existing Stage-4 precheck before the full Node suite or Chromium journey could execute. A later run on the documentation-updated head also failed at the same Stage-4 step and again skipped the full Node/Chromium stages.

The failing assertions/stacks in the recorded detailed run are in untouched Mechanical/SBC Stage-4 files and contracts, including:

```text
tests/vibration-integrity-mechanism-matrix.test.mjs
tests/vibration-mechanical-t23-module-boundaries-stage4.test.mjs
tests/vibration-mechanical-t23-ui-stage4.test.mjs
```

Observed examples include stale expectations for the former Mechanical candidate path/symbols while the current product source exposes the qualified direct T2.3 screening path, plus SBC matrix/readiness expectations. No failing stack enters `vibration-roadmap-controller.js`, `vibration-roadmap-panel.js`, `vibration-roadmap-view-state.js`, `vibration-roadmap-navigation-diagnostic.js`, or the UI-001/UI-002 tests.

This is **not** converted to PASS and does not authorize merge. Because the precheck terminates the job, the new repository-integrated UI tests and browser evidence remain unexecuted by hosted CI.

## Merge gate

```text
MERGE_AUTHORITY          OWNER_ONLY_NOT_GRANTED
MERGE_READINESS          BLOCKED
BLOCKER                  HOSTED VALIDATION RED; FULL SUITE/BROWSER NOT EXECUTED
```

The PR must remain draft until the repository validation baseline is reconciled and the bounded UI tests are executed in a native/hosted checkout. An unrelated Stage-4 failure is not evidence that UI-001/UI-002 failed, but it is also not evidence that they passed integration.

## Negative assurance

This slice does not alter:

- engineering equations or numerical kernels;
- mechanism applicability;
- assessment completeness authority;
- screening/design authority;
- source/method authority;
- project persistence;
- LOF/result aggregation;
- calculation eligibility or execution gating.

The right rail remains descriptive/suggestive only. A navigation diagnostic reports a UI routing problem; it cannot block calculation execution or become engineering evidence.

## Remaining audit stack

Next bounded slice should address UI-003 through UI-009 in the audit-defined order, followed by UI-010 as a real rendered-browser interaction regression. Browser-only evidence remains `NOT_RUN`, not inferred from source.
