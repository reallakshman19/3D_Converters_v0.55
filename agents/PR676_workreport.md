# PR676 — Engineering Console Runtime Array Contract

## Recovery header
- REPOSITORY: `reallaksh19/3D_Converters`
- PR: `#676`
- BRANCH: `agent/engineering-console-runtime-array-contract`
- BASE_AT_ALLOCATION: `main@a97a44c92377c2fb8953fd5d212c0f53067b132f`
- TITLE: `fix(engineering): repair console array contract and catalogue startup`
- STATE: `OPEN_READY_FOR_OWNER_AUTHORIZED_MERGE`
- PR_AUTHORITY: `GRANTED_2026-08-20`
- MERGE_AUTHORITY: `GRANTED_2026-08-20`

## Problem proven on base
The default registry includes active `VIB.AIV.ACOUSTIC`, whose input `inventoryCompletenessAttestations` is declared as `type: 'array'`.

Base runtime defects:
1. `registry.js` did not allow `array` in `FIELD_TYPES`.
2. `input-resolution.js` sent `array` through scalar normalization, corrupting valid arrays to `null`.
3. generic console draft/parser did not serialize or parse `array` as JSON.
4. generic console form rendered `array` as a scalar text input.
5. `tests/engineering-calculation-core.test.mjs` still treated AIV as blocked and asserted stale catalogue counts/API grammar.

Because the default registry is constructed centrally, defect 1 can prevent Engineering Calculations catalogue startup rather than merely affecting one AIV control.

## Implemented repair
### Registry
`array` is now an accepted first-class field type for inputs and outputs.

### Input resolution
`array` values:
- must be actual arrays at the API boundary;
- are cloned into canonical/resolved inputs;
- are no longer routed through scalar normalization.

### Generic console
`array` values:
- serialize to formatted JSON in drafts;
- parse only from JSON arrays;
- render as JSON textarea controls, like object/table aggregates.

### Core regression reconciliation
The core regression now:
- uses the current registry factory signature;
- supplies all required definition contract fields;
- exercises an `array` input/output through the synthetic engine;
- verifies current HP production-review IDs are discoverable;
- verifies AIV is `SCREENING`, not `BLOCKED`;
- derives family/catalogue counts from current registry data instead of frozen old totals;
- uses `VIB.CAVITATION.FLASHING` as a genuinely blocked mechanism;
- proves AIV attestation arrays survive central resolution;
- proves non-array attestation input fails central normalization;
- retains B31.3, empirical, FIT, unit-resolution and batch-isolation coverage.

## HP production paths protected
The catalogue regression explicitly expects:
```text
PIPE.B313.CH9.STRAIGHT_PRESSURE_REVIEW
PIPE.B313.CH9.WALL_STATE_REVIEW
PIPE.B313.CH9.FATIGUE_USER_REVIEW
```

No HP numerical equations or authority flags are changed.

## Changed-file ledger
Runtime:
1. `converters/engineering-calculations/registry.js`
2. `converters/engineering-calculations/input-resolution.js`
3. `tabs/engineering-calculation-console-model.js`
4. `tabs/engineering-calculation-console-sections.js`

Tests:
5. `tests/engineering-calculation-console-model.test.mjs`
6. `tests/engineering-calculation-core.test.mjs`

Recovery:
7. `agents/PR676_workreport.md`

## Final pre-merge state
```text
head                                             b254c87d236e017504e5039278f71c1ac8453ba1
mergeable                                        true
branch relation                                  ahead 8 / behind 0
changed files                                    7 intended
GitHub commit status checks                      0 / NOT_RUN
PR-triggered workflow runs                       0 / NOT_RUN
submitted reviews                                0
inline review threads                            0
```

## Validation ledger
```text
base defect source proof                            PASS
registry -> resolver -> console end-to-end review   PASS / source-level
branch scope against allocation base                PASS / intended paths only
container native clone                              FAIL / DNS cannot resolve github.com
native Node focused tests                           NOT_RUN / no native checkout
full repository regression                          NOT_RUN
browser validation                                  NOT_RUN
GitHub hosted checks                                NOT_RUN / no checks or PR workflows present
```

Do not convert `NOT_RUN` to PASS.

## Scope exclusions
- no KD320 native implementation;
- no Code/source evidence or checker gates;
- no HP engineering formula change;
- no vibration right-rail behavior change;
- no AIV numerical-method change;
- no design-authority promotion.

## Merge instruction
Owner instructed to proceed with the production stabilization PR and merge it before starting the HP productive UI increment. Merge only against the final rechecked head SHA.

## Appendix A — takeover questions
1. Why did adding `array` only to `FIELD_TYPES` not fully fix the defect?
2. What would `input-resolution.js` have done to an array before this PR?
3. How does the generic console edit an `array` after this PR?
4. Which active definition exposed the broken array contract?
5. Which three HP production-review IDs must remain discoverable?
6. Which vibration mechanism is used as the genuinely blocked regression case?
7. Were native Node tests executed? No; why?
8. Did this PR change any engineering equation or authority state? No.
