# PR677 — HP Production Review UI

## Recovery header
- REPOSITORY: `reallaksh19/3D_Converters`
- PR: `#677`
- BRANCH: `agent/hp-production-ui-review-envelope`
- BASE_AT_ALLOCATION: `main@c2f979a67f6a5b074fbe593424208b1a10a510e0`
- TITLE: `feat(hp): make production review results engineering-readable`
- STATE: `OPEN_PENDING_FINAL_MERGE_RECHECK`
- PR_AUTHORITY: `GRANTED_2026-08-20`
- MERGE_AUTHORITY: `GRANTED_2026-08-20`

## Active-route grounding
The Engineering workspace routes HP Piping Class to:
```text
tabs/hp-piping-class-kd-bulk-workbench-tab.js
  -> wraps tabs/hp-piping-class-workbench-tab.js
```

The older `hp-piping-class-tab.js` compatibility renderer is not the production target of this PR.

## Existing production capability preserved
The active workbench already provided:
- product matrix and wall custody;
- explicit operating-state editor;
- governed pressure-cycle editor;
- CORE pressure range/Salt display;
- compact external Seq/N working table;
- `Ui=n/N` display;
- collapsed calculation-basis/audit custody;
- CSV/TSV bulk Seq/N import in the active wrapper.

This PR does not duplicate or replace those flows.

## Production UI contribution
### 1. Blocker vs advisory readiness
The active wrapper now runs the existing project validator with:
```text
validationPolicy = PRODUCTION_REVIEW
```

The UI separately renders:
- structural/numerical project issues as calculation blockers;
- method-identity gaps such as `METHOD_IDENTITY_REQUIRED` as advisories that do not block engineering-review execution.

### 2. Detailed numerical result ledger
After an explicit review calculation, the Review Envelope receives a detailed presentation replay from the same canonical evaluator.

Per product the ledger exposes:

Static / pressure:
- pressure-design thickness;
- required minimum thickness;
- required nominal thickness;
- minimum as-manufactured thickness;
- effective net wall;
- calculated pressure rating;
- pressure-rating margin;
- minimum-wall margin.

Wall state:
- nominal wall;
- minimum as-manufactured wall;
- begin-of-life conservative wall;
- reserved service loss;
- end-of-life effective wall;
- measured current wall where present;
- future service loss where present;
- projected end-of-life wall where present.

Fatigue cycle:
- cycle identity/state pair;
- applied lifetime cycles n;
- pressure range;
- CORE Salt;
- optional user Salt;
- Salt QA status;
- external Seq;
- external permissible cycles N;
- Ui=n/N.

Aggregate presentation includes cumulative U, static state, selected fatigue wall and advisory evidence count.

### 3. Stale-result containment
The detailed presentation snapshot is cleared when base engineering inputs or structural project state changes. It refreshes only after the base workbench's explicit `calculate` action, sample calculation, or existing bulk `Apply + calculate` route.

## Implementation architecture
New pure presentation module:
```text
tabs/hp-piping-class-production-review-view.js
```

The active bulk-workbench wrapper imports the existing canonical:
```text
validateHpPipingClassProject
evaluateHpPipingClassProject
```

No engineering equation is duplicated in the UI.

## Changed-file ledger
Runtime/UI:
1. `tabs/hp-piping-class-kd-bulk-workbench-tab.js`
2. `tabs/hp-piping-class-production-review-view.js`

Tests:
3. `tests/hp-piping-class-kd-bulk-ui.test.mjs`
4. `tests/hp-piping-class-production-review-view.test.mjs`

Recovery:
5. `agents/PR677_workreport.md`

## Validation ledger
```text
active production route grounding                  PASS
source-level blocker/advisory separation review    PASS
source-level result-field mapping review            PASS
branch scope vs allocation base                     PASS / intended 4 engineering/test files before recovery
focused test coverage authored                      YES
native Node execution                               NOT_RUN / native checkout unavailable
full repository regression                          NOT_RUN
browser interaction validation                      NOT_RUN
GitHub hosted checks/reviews                         PENDING_FINAL_RECHECK
```

Do not convert NOT_RUN to PASS.

## Authority boundary
Unchanged:
```text
nativeCoreKd3Qualified        false
codeCompliance                false
canUseForDesignAuthority      false
calculation authority         ENGINEERING REVIEW ONLY
```

No Code/source evidence or checker gate is promoted by this UI.

## Merge instruction
Owner authorized this production UI increment and merge after the prior runtime stabilization merge. Merge only after final exact-head, mergeability, status/workflow, review-thread and branch-relation recheck.

## Appendix A — takeover questions
1. Which module is the active HP Piping Class route from Engineering workspace?
2. What pre-existing native editors/bulk functionality must remain intact?
3. Which validation policy powers the new readiness panel?
4. What is the difference between `issues` and `advisories` under that policy?
5. Which static pressure quantities are now visible in the detailed ledger?
6. Which wall-state quantities are now visible?
7. Which per-cycle fatigue quantities are now visible?
8. Why does the wrapper replay the canonical evaluator rather than calculate formulas in the UI?
9. What user action refreshes the detailed result ledger?
10. What edit invalidates it?
11. Were native/browser tests run? No; why?
12. Which authority flags remain false?
