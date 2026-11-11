# PR734 Work Report — P4 legacy BS5500 workbook benchmark

## Mission

Faithfully migrate the formula programs recovered from the owner-supplied `flange design to BS5500.xls` into a separately named non-authorizing benchmark kernel. Do not claim current Code authority and do not central-register the result.

## Baseline

```text
repository  reallaksh19/3D_Converters
stack base  PR733 @ 948c539c2a6803d324e14a626e1834a05c259377
branch      feat/engcalc-p4-legacy-bs5500-benchmark-20260904
PR          #734
mode        AUTO
```

## Source basis

PR733 recovered all 50 BIFF8 formula records from the legacy workbook and replayed them against stored workbook values with 50/50 matches at relative tolerance `1e-12`. PR734 uses that formula map as its migration source.

The benchmark deliberately retains workbook constants/branches rather than normalizing them to modern or remembered equations. This includes `0.785`, `3.14`, `6.28`, the ring-joint `N/8` branch, the non-ring-joint `min(bo, 2.52*sqrt(bo))` branch, and the recovered shape-factor coefficient formulas.

## Delivered

1. `converters/engineering-calculations/flange/legacy-bs5500-workbook.js`
   - explicit SI inputs;
   - internal conversion to the workbook's mm/N/N·mm/N/mm² basis;
   - gasket geometry and reaction diameter;
   - pressure/gasket loads and moment arms;
   - bolt area/load chain;
   - recovered shape and correction factors;
   - operating and bolt-up flange stress components;
   - fail-closed geometry/input validation;
   - no acceptance evaluation or authority promotion.
2. `tests/flange-legacy-bs5500-workbook.test.mjs`
   - recovered source fixture;
   - spiral/ring-joint width branches;
   - applied moment propagation;
   - correction-factor floor and >1 case;
   - zero-pressure bolt-up case;
   - singular geometry rejection;
   - dimensional/API authority checks.
3. `docs/engineering-calculations/flange-legacy-bs5500-benchmark-source-register.md`
   - source custody and authority limits;
   - dimensional interpretation of the reduced stress moment.

## Dimensional review correction

The workbook's stress-calculation `M = physical flange moment * Cf / B` is dimensionally force. During implementation review this was explicitly prevented from becoming an API unit error. The kernel exposes `reducedMomentN`; it does not call that intermediate `momentNm`.

## Validation truth

The locally executed source and test files were verified to be byte-identical to the GitHub branch blobs before execution:

```text
source blob  bc5e4778efe26e6c1fa345deda81ef20367e0dad
 test blob   0a05ba7f80545c2bd4d51b16cfe3323d4f596512
Node         v22.16.0
```

Observed result:

```text
focused P4 benchmark suite    PASS 13/13 / SOURCE_RECONSTRUCTED_EXACT_GITHUB_BLOBS
source syntax                 PASS / SOURCE_RECONSTRUCTED_EXACT_BLOB
test syntax                   PASS / SOURCE_RECONSTRUCTED_EXACT_BLOB
new-source physical lines     PASS / 206 < 300
native PR-head checkout       NOT_RUN / ENVIRONMENT_BLOCKED
GitHub PR-head workflow runs  NOT_RUN / ZERO_RUNS_RETURNED
independent engineering review NOT_RUN
```

No `NOT_RUN` item is represented as PASS.

## Authority

```text
sourceAuthority          LEGACY_BENCHMARK_ONLY
acceptanceEvaluated      false
codeCompliance           false
canUseForDesignAuthority false
governingEligible        false
```

No real standard master value, material allowable, gasket factor, flange constant or acceptance limit is promoted. The fixture is regression evidence only.

## Related gates

```text
PR731 P2 exact execution          NOT_RUN / ENVIRONMENT_BLOCKED
PR732 P3 supporting execution     PASS 18/18 / SOURCE_RECONSTRUCTED
PR732 P3 exact native execution   NOT_RUN / ENVIRONMENT_BLOCKED
P5 rigidity                       BLOCKED_UNCHECKED_SOURCE_AND_EQUATIONS
```

## Exact next action

Attempt exact PR734 checkout execution:

```bash
node --test tests/flange-legacy-bs5500-workbook.test.mjs
```

If exact execution remains unavailable, preserve `NOT_RUN`. Do not central-register this legacy benchmark. The next source-development decision is either obtain a controlled current detailed-flange strength basis, or explicitly sequence into P6 gasket/sealing screening while P5 remains blocked.

## Merge

Draft. `MERGE_AUTHORITY = OWNER_ONLY_NOT_GRANTED`.
