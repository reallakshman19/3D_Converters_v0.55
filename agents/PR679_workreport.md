# PR679 — HP Class Results Export and Round-Trip Verification

## Recovery header
- REPOSITORY: `reallaksh19/3D_Converters`
- PR: `#679`
- BRANCH: `agent/hp-class-results-export-roundtrip`
- BASE_AFTER_REPLAY: `main@f19a050f8c542ce07e72d1c00af86142de92257f`
- TITLE: `feat(hp): add class-wide result export and round-trip verification`
- STATE: `OPEN_DRAFT_HANDOVER_READY_PENDING_FINAL_RECHECK`
- MERGE_AUTHORITY: `OWNER_GRANTED_2026-08-20_MERGE_PROCEED_NEXT`

## Objective
Turn the merged PR677 engineering-readable HP product ledger into a class-wide review deliverable without changing engineering equations or qualification authority.

Production increment:
1. one normalized class result bundle;
2. class-wide product matrix;
3. review-only sort/filter views;
4. comprehensive CSV export;
5. structured JSON export;
6. parser-backed round-trip verification before download.

## Current-main replay incident
The branch was initially allocated from `main@9404e7d0da6a47337ee3910c9d86bcf4ce1a979f` (PR677).

While implementation was in progress, main advanced to:

```text
f19a050f8c542ce07e72d1c00af86142de92257f
feat(vibration): add controlled-source campaign runner (#675)
```

The incoming commit was inspected and was vibration controlled-source campaign work only; it did not touch the HP/UI/export paths in this PR.

The HP branch was therefore reset/replayed onto exact `main@f19a050f...` and all six implementation/test files were republished byte-identically. Post-replay comparison was:

```text
ahead  6
behind 0
merge base f19a050f8c542ce07e72d1c00af86142de92257f
```

No vibration campaign file is modified by PR679.

## Export contract
Schema:

```text
hp-piping-class-result-export/v1
```

The export is derived only from a completed canonical HP Piping Class orchestrator result. It is rejected when `result.ok !== true`.

### Product projection
Each product row retains, where available:
- product identity / basis / engineering state;
- calculation success;
- static result;
- pressure-design, minimum and nominal required wall;
- minimum manufactured and effective net wall;
- calculated pressure rating and pressure-rating margin;
- wall-state BOL/EOL/projected-EOL values;
- selected fatigue wall;
- cumulative fatigue usage;
- evidence advisory count / independent-check flag;
- maximum per-cycle usage and its cycle ID.

### Cycle projection
Each fatigue-cycle row retains:
- product / cycle / location / state pair;
- applied cycles `n`;
- pressure range;
- CORE Salt;
- optional user Salt and QA comparison state;
- external Seq;
- external N;
- zero-damage flag;
- cycle usage `Ui`;
- cycle evidence status.

### Review-priority reporting
The matrix uses this deterministic display priority:

```text
BLOCKED
STATIC_FAIL
FATIGUE_EXCEEDS_UNITY
FATIGUE_EVALUATED
STATIC_ONLY
```

This is explicitly a **reporting aid only**. It is not an ASME governing rule, Code acceptance criterion, component qualification decision, or design-release authority.

## Round-trip behavior
JSON:
- serialize canonical bundle;
- parse schema;
- compare complete normalized payload.

CSV:
- fixed canonical typed header;
- long form (`PRODUCT_CYCLE`, or `PRODUCT` when no fatigue cycles);
- parse booleans/numbers/integers with fail-closed validation;
- compare parsed rows with the normalized long-form source rows.

The UI executes the verifier before CSV/JSON download. If either round trip fails, download does not proceed.

## Active product UI
The currently routed HP workbench wrapper remains:

```text
tabs/hp-piping-class-kd-bulk-workbench-tab.js
```

PR679 adds to the Review Envelope:
- class-wide result matrix;
- filter: all / needs attention / blocked / static fail / U>1 / fatigue evaluated / static only;
- sort: review priority / cumulative U descending / pressure-rating margin ascending / product ID;
- Export results CSV;
- Export results JSON;
- Verify round trip;
- visible round-trip PASS/FAIL state.

Any engineering-input mutation clears the cached review result and round-trip state. Sort/filter actions do not mutate project engineering state.

## Exact changed-file ledger
Implementation:
1. `tabs/hp-piping-class-kd-bulk-workbench-tab.js`
2. `tabs/hp-piping-class-production-review-view.js`
3. `tabs/hp-piping-class-result-export.js`

Tests:
4. `tests/hp-piping-class-kd-bulk-ui.test.mjs`
5. `tests/hp-piping-class-production-review-view.test.mjs`
6. `tests/hp-piping-class-result-export.test.mjs`

Recovery:
7. `agents/PR679_workreport.md`

## Exact implementation/test blob ledger
```text
tabs/hp-piping-class-kd-bulk-workbench-tab.js
  0f6653ac2d52becf833406e17ee87c237c4304de

tabs/hp-piping-class-production-review-view.js
  fc3e0fffa6badc16c11aace03f1a42d6cf68209d

tabs/hp-piping-class-result-export.js
  3f06e4705f6ee7ca20301ebf55d2169d52a3e9b6

tests/hp-piping-class-kd-bulk-ui.test.mjs
  b4759082e528db04b38950630ddc8c8b3c70ecb5

tests/hp-piping-class-production-review-view.test.mjs
  625e57527e4a9f3c8916aba72ad4ebaa30688199

tests/hp-piping-class-result-export.test.mjs
  8a43bcb16b54085af7df226e17c859109a7482f5
```

## Validation ledger
Exact authored source/test files were executed in a local repo-shaped fixture.

```text
result export contract / round-trip tests    PASS 4/4
production review view tests                 PASS 6/6
active bulk-workbench wiring tests           PASS 8/8
focused total                                PASS 18/18
classification                               IMPLEMENTATION_COUPLED_LOCAL_EXECUTION
JSON round-trip falsifier                     PASS
CSV round-trip falsifier                      PASS
malformed CSV header rejection                PASS
wrong JSON schema rejection                   PASS
incomplete-result export rejection            PASS
branch replay onto current main               PASS
post-replay branch scope                      PASS / 6 intended files before recovery
full repository-native suite                  NOT_RUN
browser interaction validation                NOT_RUN
hosted PR status/workflows/reviews            PENDING_FINAL_RECHECK
```

Do not convert any `NOT_RUN` item to PASS.

## Authority boundary
PR679 does **not** change:
- B31.3 / VIII-3 engineering equations;
- native CORE KD320 qualification or execution;
- Code compliance state;
- design authority state;
- controlled-source receipts;
- evidence-admission rules;
- independent-check requirements;
- master engineering values;
- vibration campaign behavior.

Required retained policy:

```text
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
```

The exported bundle clones the orchestrator authority state; exporting a result cannot promote authority.

## Merge instruction
Owner explicitly instructed `merge, proceed next` for this bounded production increment. Merge only after:
1. exact final head is re-read;
2. branch is not behind current main;
3. mergeability is true;
4. hosted statuses/workflow runs are inspected;
5. reviews/review threads are inspected;
6. draft is marked ready;
7. merge uses `expected_head_sha`.

## Appendix A — takeover questions
1. What is the export schema version?
2. Why is review-priority ordering not an engineering governing rule?
3. Which result object is the sole numerical source for matrix and exports?
4. What prevents CSV/JSON download if serialization drifts?
5. What happens to cached export verification after an engineering edit?
6. How are products without fatigue cycles represented in CSV?
7. Which numerical fields prove static pressure and fatigue chains are retained?
8. Did PR679 implement any KD320 equation? No.
9. Did PR679 establish Code compliance or design authority? No.
10. Which validations are still `NOT_RUN`? Full repository-native suite and browser interaction validation.
