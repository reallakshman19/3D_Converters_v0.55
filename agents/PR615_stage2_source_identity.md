# PR #615 Stage 2 — Engineering Source Identity

## Grounding epoch

- WORK_INTENT: IMPLEMENT
- REPOSITORY_STATE: EXISTING_PR
- MUTATION_AUTHORITY: WRITE_ALLOWED by Owner instruction `proceed next stack on same PR`
- CRITICALITY: ENGINEERING_CRITICAL
- EXECUTION_MODE: MANUAL
- BASE_BRANCH: `main`
- BASE_MAIN_SHA: `1d9340248b11569f7c7c4f02ac429c7d8c66ff81`
- PR: #615, draft/open
- REPORT_BASIS_HEAD_AT_START: `47008276b238ec5a95bf05375abccc427ec1c6e6`
- BRANCH_RELATION_AT_START: ahead 8 / behind 0
- REVIEWS_AT_START: 0
- REVIEW_THREADS_AT_START: 0
- COMMIT_STATUSES_AT_START: 0 returned
- PR_WORKFLOW_RUNS_AT_START: 0 returned
- MERGE_AUTHORITY: OWNER_ONLY / NOT_GRANTED

## Stage coordination decision

The initially planned mechanism-workspace consumer was `BLOCKED_BY_ACTIVE_CLAIM`:

- PR #479 owns `tabs/vibration-integrity-tab.js` (FIT top-level workspace);
- PR #506 owns `tabs/engineering-calculations-tab.js`, `tabs/vibration-aiv-qualification-tab.js`, and AIV runtime paths;
- PR #508 owns `tabs/vibration-integrity-mechanisms.js` and SBC facility/view paths.

PR615 did not edit through those claims. The earlier Stage-1 statement that the shared engineering tab had no active claimant was found stale and has been corrected in the living work report/status/claim records.

Stage 2 therefore executed the next unblocked P0 correction: explicit engineering source identity.

## Source authority and scope

Primary publication identity is grounded to the Energy Institute publication/sample:

```text
publisher       = Energy Institute
publication     = Guidelines for the avoidance of vibration induced fatigue failure in process pipework
edition         = 2nd
publicationDate = 2008-01
ISBN            = 9780852934630
```

The official sample contents establishes technical modules T1 through T13. It does not independently establish every current repository mechanism subsection/flowchart mapping.

The implementation therefore keeps distinct typed fields:

```text
technicalModule
sectionId
flowchartId
equationId
tableId
figureId
printedPage
pdfPage
```

A dotted section such as `T2.4` cannot be accepted as a hyphenated flowchart identifier such as `T2-4`.

Repository mechanism labels are retained only as `RECONCILIATION_REQUIRED` evidence until controlled-source reconciliation closes them.

Thermowell remains explicit `CONFLICTED`: EI T4 and the repository `ASME PTC 19.3 TW-2016` label are retained separately and are not silently combined.

## Implemented

### Core source contract

Added:

- `converters/vibration/source/method-source-record.js`
- `converters/vibration/source/registry.js`

`EngineeringMethodSource.v1` provides:

- typed module/section/flowchart/equation/table/figure/page fields;
- explicit source status and locator-basis enums;
- unknown-field rejection;
- fail-closed page and locator-format checks;
- `CONTROLLED -> CONTROLLED_SOURCE` enforcement;
- source identity authority fixed to `SOURCE_IDENTITY_ONLY`.

The vibration registry provides:

- controlled EI T1-T13 technical-module records;
- repository T2 mechanism labels as `RECONCILIATION_REQUIRED`;
- resolved T3 SBC technical-module binding;
- explicit thermowell source conflict;
- explicit unresolved generic post-modification-verification source;
- fail-closed `RESOLVED` bindings unless all bound sources are actually `CONTROLLED`.

### Production integration

Modified only PR615-owned roadmap presentation paths:

- `converters/vibration/roadmap/registry.js`
- `tabs/vibration-roadmap-panel.js`

Roadmap lifecycle nodes now distinguish T5, T6, T12, and T13 instead of compressing those obligations into generic placeholders.

Each roadmap node carries a source binding or explicit unresolved/conflicted state. Source status is operator-visible in the panel and cannot modify the node's engineering/result status.

## Authority trace

```text
Energy Institute publication / controlled source
  -> EngineeringMethodSource.v1 registry
  -> roadmap source binding
  -> VibrationRoadmapProjection.v1
  -> read-only right-panel source label
```

Stage 2 changes source identity metadata and visual publication only. It does not change applicability, equations, LOF, mechanism reduction, EI main-line aggregation, qualification, screening authority, or design authority.

## Prediction / falsifier result

Prediction result: PASS on focused reconstructed execution.

- every roadmap node has explicit source state;
- T1/T5-T13 lifecycle nodes have distinct module custody;
- T2 dotted section labels remain separate from flowchart identity;
- thermowell conflict is visible;
- source state does not change result/applicability status.

No falsifier was observed in the executed focused tests.

## Validation evidence

Executed in the available local Node runtime using the exact Stage-2 implementation surface before GitHub publication:

```text
node --check source + roadmap + panel         PASS
vibration-method-source.test.mjs              PASS 6/6
vibration-roadmap-source-identity.test.mjs    PASS 4/4
STAGE-2 TOTAL                                 PASS 10/10
new/modified Stage-2 JS modules <300 lines    PASS
```

Evidence dimensions:

```text
STATUS       PASS
OBSERVATION  LOCAL_EXECUTION on reconstructed exact implementation surface
ORACLE       IMPLEMENTATION_COUPLED for contract regressions
             AUTHORITATIVE_REFERENCE for EI publication/T1-T13 taxonomy
```

Existing Stage-1 roadmap tests were source-inspected for compatibility; they were not represented as rerun on the Stage-2 head.

Truthful remaining gates:

- repository-native exact-checkout current-head suite: NOT_RUN / ENVIRONMENT_BLOCKED;
- served Chromium source-label/project acceptance: NOT_RUN;
- real controlled `.eit` native-checkout round trip: NOT_RUN;
- independent engineering review: NOT_RUN.

No workflow was created or modified, and an empty hosted status is not treated as PASS.

## Negative assurance

Stage 2 did not modify:

- `tabs/engineering-calculations-tab.js`;
- FIT/AIV/SBC mechanism workspace files claimed by PR #479/#506/#508;
- engineering equations or correlations;
- mechanism applicability;
- mechanism result reduction;
- EI main-line aggregation;
- persisted current-result authority;
- generic multi-module `.eit` export;
- workflow files.

## Appendix A

`NOT_REQUIRED_FOR_CONTINUATION` — same active implementation agent and PR; this was not a takeover. A future takeover must re-ground and pass the repository-specific qualification gate before engineering-critical production mutation.

## Stage disposition

`COMPLETE_FOR_DECLARED_STAGE_SCOPE / PR_REMAINS_DRAFT`

## EXACT_NEXT_ACTION

Re-ground current main and active claims. If the intended result/aggregation paths are unclaimed, the next common engineering stack is `MechanismNumericResult.v1` plus `MechanismLineResult.v1` and a fail-closed reducer interface; only after that may EI main-line aggregation be changed to consume qualified mechanism-level results. Do not edit PR #479/#506/#508 mechanism-workspace paths while their claims remain active. Generic `.eit` export remains deferred.
