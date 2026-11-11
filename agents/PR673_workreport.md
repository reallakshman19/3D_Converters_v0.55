# PR673 — HP Production Review Execution

## Recovery header
- PR: `#673`
- REPOSITORY: `reallaksh19/3D_Converters`
- BRANCH: `agent/hp-production-review-execution`
- BASE_AT_ALLOCATION: `main@a2dc24c27c791355044ae64939647a7c78804aca`
- TITLE: `feat(hp): enable production engineering-review execution`
- INTENT: contribute useful HP calculations to the production runtime now; defer qualification gates/evidence completion
- STATE: `READY_FOR_OWNER_AUTHORIZED_MERGE`
- PR_AUTHORITY: `GRANTED_2026-08-20`
- MERGE_AUTHORITY: `GRANTED_2026-08-20`

## Handover in 60 seconds
PR673 adds a production engineering-review execution route without weakening the existing formal evidence/qualification route. Mathematical and structural inconsistencies still fail closed. Missing provenance, checker, method/source identity, and master-store custody are advisory in the production-review path. Native CORE KD320 remains unqualified/not executed, and Code/design authority remain false.

## Production calculation IDs
```text
PIPE.B313.CH9.STRAIGHT_PRESSURE_REVIEW
PIPE.B313.CH9.WALL_STATE_REVIEW
PIPE.B313.CH9.FATIGUE_USER_REVIEW
```

All three are registered as executable `IMPLEMENTED` calculations with no qualification-mode gate and with:
```text
codeCompliance           false
canUseForDesignAuthority false
```

## HP Piping Class product path
`hp-piping-class-orchestrator.js` routes fatigue to:
```text
PIPE.B313.CH9.FATIGUE_USER_REVIEW
```

Static and wall calculations continue to use the existing Chapter IX numerical kernels.

The workbench now separates calculation integrity from later evidence completion:
```text
mathematical/input inconsistency       -> BLOCK
structural project inconsistency       -> BLOCK
authority-promotion attempt            -> BLOCK
missing method/source identity         -> ADVISORY
missing provenance/checker custody     -> ADVISORY
master-store custody not loaded/match  -> ADVISORY during calculation
```

Creating/binding a new governed basis package still requires the canonical master store.

## Evidence policy
`evaluateChapterIxUserCalculatedFatigueSpectrum()` supports:
```text
evidencePolicy = REQUIRED   # existing/default formal route
evidencePolicy = ADVISORY   # production-review route
```

`ADVISORY` relaxes provenance/checker gating only. It does not relax numerical or relational checks.

## Hard failures retained
- invalid schema/canonical units;
- invalid design pressure, allowances, diameter, stress, wall or tolerance;
- invalid wall-state projection;
- missing/duplicate governed cycle rows;
- missing result location/state identity;
- state-pair mismatch;
- invalid/non-finite Seq;
- invalid optional user Salt/mean stress/beta/Sa-prime;
- user Salt mismatch against CORE pressure-cycle Salt beyond repository QA tolerance;
- `Seq=0` with nonzero CORE Salt;
- missing/nonpositive permissible cycles `N` for nonzero damage;
- authority promotion (`nativeCoreKd3Qualified`, `codeCompliance`, `canUseForDesignAuthority`).

## Advisory-only examples
```text
METHOD_IDENTITY_REQUIRED
USER_FATIGUE_BASIS_REQUIRED
USER_FATIGUE_CHECKER_NOT_INDEPENDENT
USER_FATIGUE_CHECK_CUSTODY_INCOMPLETE
MASTER_STORE_NOT_LOADED
GOVERNED_BASIS_CUSTODY_BLOCKED
```

## Frozen numerical reference
NPS4 retained software arithmetic:
```text
D                    114.3 mm
P                    20 MPa
S                    138 MPa
nominal wall         13.49 mm
minus tolerance      12.5 %
internal allowance   3 mm
external allowance   0 mm

t_pressure           7.7103934983403475 mm
t_required_min       10.710393498340348 mm
t_required_nominal   12.240449712388969 mm
t_min_manufactured   11.80375 mm
t_eff_EOL            8.80375 mm
P_rating             23.086120852009273 MPa
rating margin        1.1543060426004637
```

Pressure-cycle references:
```text
5 -> 30 MPa  Salt = 87.91596640349115 MPa
2 -> 20 MPa  Salt = 63.29949581051363 MPa
```

Miner examples:
```text
n=10000, N=20000 -> U=0.5
n=500,   N=10000 -> U=0.05
```

## Changed-file ledger
Runtime:
1. `converters/engineering-calculations/adapters/b313-chapter-ix-production-review.js`
2. `converters/engineering-calculations/default-registry.js`
3. `converters/b313-chapter-ix/user-calculated-fatigue.js`
4. `converters/b313-chapter-ix/hp-piping-class-project.js`
5. `converters/b313-chapter-ix/hp-piping-class-orchestrator.js`
6. `tabs/hp-piping-class-workspace-controller.js`

Tests:
7. `tests/b313-chapter-ix-production-review.test.mjs`
8. `tests/hp-piping-class-orchestrator-contract.test.mjs`
9. `tests/hp-piping-class-master-controller.test.mjs`

Recovery:
10. `agents/PR673_workreport.md`

## Validation ledger
```text
independent NPS4 hand arithmetic                  PASS
independent 5->30 MPa Salt arithmetic             PASS
independent 2->20 MPa Salt arithmetic             PASS
source-scope comparison against main              PASS
old workbench fatigue-ID search                   PASS / only known contract test updated
native node test execution                        NOT_RUN / native checkout unavailable
full repository regression suite                  NOT_RUN / native checkout unavailable
browser/UI interaction suite                      NOT_RUN
PR mergeability precheck                          PASS / mergeable=true at head 8e5c04a350a8a7f84e96d74f062c4596cc400045
commit status entries                             0 returned -> NOT_RUN / no status checks present
PR-triggered workflow runs                        0 returned -> NOT_RUN / no workflow runs present
reviews                                           0
review threads                                    0
```

Do not convert `NOT_RUN` to PASS.

## Pre-existing base defects observed, not fixed here
1. `tests/engineering-calculation-core.test.mjs` has a stale catalogue count assertion.
2. `converters/engineering-calculations/registry.js` lacks `array` in `FIELD_TYPES` while active AIV declares an array input.

## Authority boundary
```text
nativeCoreKd3Qualified        false
codeCompliance                false
canUseForDesignAuthority      false
formal evidence-required ID   preserved
production review ID          advisory evidence policy
project method identity       advisory in production review
master custody precheck       advisory during calculation
```

## Merge instruction
Owner explicitly instructed: `create PR (always), then merge. Merge now` on 2026-08-20. Merge is authorized. Outstanding `NOT_RUN` items remain disclosed and are not represented as PASS.

## Appendix A — takeover questions
1. Why is a separate production-review adapter preferable to weakening benchmark adapters in place?
2. Which three calculation IDs are production-executable?
3. What does `evidencePolicy=ADVISORY` relax, and what does it not relax?
4. Does missing `calculationBasis` block production-review fatigue? No.
5. Does it still block the formal USER_CALCULATED_KD3 intake? Yes.
6. Why must Salt mismatch remain a hard failure?
7. Which method-identity condition is advisory under `PRODUCTION_REVIEW`?
8. Does unloaded master-store custody block calculation from an already embedded governed basis? No.
9. Does creating/binding a new governed basis still require a loaded master store? Yes.
10. What authority flags remain false?
11. Which validation items remain `NOT_RUN`?