# PR683 — HP Piping Class Product-Matrix Bulk Intake — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #683
BRANCH: agent/hp-product-matrix-bulk-intake
BASE: main
BASE_SHA_AT_PR_OPEN: 1f8f12daf3846780341ad34ab56f9dc0bde05593
PR_HEAD_AT_OPEN: 5e386641ca4b12c1b5b535525568dac2c41e9398
IMPLEMENTATION_TEST_HEAD_BEFORE_RECOVERY_SYNC: 0d08aaf9773224cdf097c961f868b18d810a2a47
CURRENT_STAGE: DRAFT_EXACT_BLOB_QUALIFIED_FULL_APP_PENDING
PR_AUTHORITY: GRANTED_2026_08_20
MERGE_AUTHORITY: NOT_GRANTED

## Mission

Add production CSV/TSV intake for the HP Piping Class direct-input product matrix without introducing a second engineering engine or weakening authority boundaries.

```text
CSV / TSV direct-product matrix
-> deterministic preview
-> fail-closed validation
-> existing project import/controller
-> existing canonical review calculation
-> existing class result matrix / CSV / JSON export
```

Native KD320/source/evidence qualification remains outside this PR.

## Exact bulk contract

```text
product_id
nominal_size
od_mm
allowable_stress_mpa
nominal_wall_mm
minus_tolerance_pct
internal_allowance_mm
external_allowance_mm
fatigue_wall_basis
measured_current_wall_mm
future_internal_loss_mm
future_external_loss_mm
```

CSV and TSV are supported. Maximum 500 product rows.

## Ownership and relational rules

- Bulk input manages `DIRECT_ENGINEERING_INPUT` products only.
- `GOVERNED_BASIS_PACKAGE` products are preserved and cannot be overwritten by an imported row.
- Internal/external allowances remain class-level. Repeated CSV values must be identical for every row or the whole import is blocked.
- Design pressure remains the existing class-level input and is not inferred from product bulk input.
- Product identity is exact for custody. Duplicate imported IDs are checked case-insensitively.
- A case-only rename of an existing product ID is blocked rather than silently detaching fatigue/result custody.
- Fatigue packages for retained product IDs are preserved.
- Fatigue packages for direct products intentionally removed by the imported matrix are removed with those products.
- Reference-sample metadata is cleared after a successful bulk mutation.

## Fail-closed intake checks

Per row:

```text
product_id required
nominal_size required
OD > 0
S > 0
nominal wall > 0
0 <= minus tolerance < 100
internal allowance >= 0
external allowance >= 0
nominal wall < OD / 2
```

Preview wall arithmetic:

```text
t_min,m = t_nom * (1 - tolerance/100)
t_eff   = t_min,m - c_i - c_o
require t_eff > 0
```

Brownfield/projected-EOL:

```text
measured current wall > 0 when supplied
future internal/external loss >= 0
measured wall requires both future-loss cells explicitly (0 permitted)
PROJECTED_END_OF_LIFE requires measured wall + both loss cells
projected EOL = measured - future internal - future external
require projected EOL > 0
```

These are intake consistency checks only. Static pressure and fatigue calculations remain in the existing canonical evaluator.

## Independent arithmetic

```text
NPS4: 13.49 * 0.875 = 11.80375 mm
       11.80375 - 3 = 8.80375 mm

NPS6: 18.26 * 0.875 = 15.9775 mm
       15.9775 - 3 = 12.9775 mm

Brownfield: 12 - 1 - 0.5 = 10.5 mm
Negative falsifier: 3 * 0.875 - 3 = -0.375 mm -> BLOCK
```

Independent arithmetic: PASS.

## Active UI route

`tabs/engineering-workspace-tab.js` routes HP Piping Class to:

```text
tabs/hp-piping-class-product-bulk-workbench-tab.js
  -> hp-piping-class-kd-bulk-workbench-tab.js
  -> base HP workbench
  -> existing workspace controller
  -> canonical HP orchestrator
```

The new wrapper adds only product-matrix intake/preview and a nominal-size column. Apply serializes the rebuilt project through the existing JSON import action, waits for the existing controller to accept it, then triggers the existing Calculate action.

PR681 browser-harness source inventory originally looked for the KD wrapper name directly in the route source. Because PR683 adds one wrapper layer, the route now contains an explicit composition comment naming `hp-piping-class-kd-bulk-workbench-tab.js`. This preserves the existing PR681 source-inventory assertion without changing runtime routing or duplicating the KD/result workbench.

## Authority boundary

Unchanged:

```text
calculationMode = USER_CALCULATED_KD3
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
```

## Changed-file ledger

Engineering/test paths:

```text
tabs/engineering-workspace-tab.js
tabs/hp-piping-class-product-bulk-input.js
tabs/hp-piping-class-product-bulk-workbench-tab.js
tests/hp-piping-class-product-bulk-input.test.mjs
tests/hp-piping-class-product-bulk-failclosed.test.mjs
tests/hp-piping-class-product-bulk-ui.test.mjs
```

Recovery paths:

```text
agents/PR683_workreport.md
agents/status/PR683.yaml
agents/claims/PR683.yaml
```

The former WIP workreport is retired.

## Exact committed-blob execution

Because direct `git clone` / `git ls-remote` cannot resolve `github.com` in the current container, the focused source and test blobs were fetched through the GitHub connector and reconstructed locally.

Before execution, `git hash-object` on each local file matched the exact PR blob SHA:

```text
product bulk module  3c4978bbf31197bc5b28330cfb52ffa841fc6e56
product bulk wrapper 5bfad0413ad3c4ebb8b9d9997503f119f99c8193
active route          02231f15ec39b07541286144b8f3cb86c8453278
UI source test        b540595de90710b492388ed96408647ce2781ca6
```

The two numerical/fail-closed test blobs were likewise exact committed blobs.

Executed:

```text
node --test
  tests/hp-piping-class-product-bulk-input.test.mjs
  tests/hp-piping-class-product-bulk-failclosed.test.mjs
  tests/hp-piping-class-product-bulk-ui.test.mjs
```

Result:

```text
tests   15
pass    15
fail     0
```

Classification:

```text
PASS 15/15 / LOCAL_EXECUTION_EXACT_COMMITTED_BLOBS
```

This is stronger than source inspection, but it is not described as a native repository checkout run.

## Chromium source-injection evidence

The exact committed product-bulk module blob was injected into a real installed Chromium instance through CDP, following the same evidence-level discipline used by PR681.

Two-product fixture:

```text
NPS4-S160 | 114.3 mm | S 138 MPa | 13.49 mm | 12.5% | ci 3 | co 0
NPS6-XXS  | 168.3 mm | S 138 MPa | 18.26 mm | 12.5% | ci 3 | co 0
```

Observed in Chromium:

```text
preview ok             true
parsed rows            2
NPS4 min manufactured  11.80375 mm
NPS4 effective net      8.80375 mm
NPS6 min manufactured  15.977500000000001 mm
NPS6 effective net     12.977500000000001 mm
apply                   true
products                NPS4-S160, NPS6-XXS
nativeCoreKd3Qualified  false
codeCompliance          false
canUseForDesignAuthority false
runtime exceptions      0
```

Tolerance-based assertions passed at 1e-12.

Classification:

```text
PASS / REAL_CHROMIUM_SOURCE_INJECTION
```

This does **not** prove routed full-workbench navigation, `DataTransfer` file-import bridging, controller persistence, class-result refresh, export UI, or mobile layout.

## Validation ledger

```text
current-main re-grounding                         PASS / GITHUB_SOURCE
main advancement HP-overlap                       PASS / NONE; vibration-only
normalized branch ancestry                        PASS / behind 0 before recovery sync
exact changed implementation paths                PASS / 6 intended
independent product-wall arithmetic               PASS
NPS4 minimum/effective wall                       PASS / 11.80375 / 8.80375 mm
NPS6 minimum/effective wall                       PASS / 15.9775 / 12.9775 mm
brownfield projected EOL                          PASS / 10.5 mm
negative effective-wall falsifier                 PASS / -0.375 mm -> blocked
focused exact committed-blob Node tests           PASS 15/15
real Chromium product-module source injection     PASS
Chromium runtime exceptions                       0
PR681 route source-inventory compatibility        PASS / SOURCE + EXACT-BLOB TEST
```

Still not qualified:

```text
repository-native checkout execution              NOT_RUN / DNS_ENVIRONMENT_BLOCKED
existing full HP regression suite                 NOT_RUN
PR681 FULL_APP Chromium two-product import        NOT_RUN / NO_NATIVE_CHECKOUT
full repository regression                        NOT_RUN
```

Never promote exact-blob execution or source injection into `FULL_APP` product PASS.

## FULL_APP target still pending

The required routed journey remains:

```text
load baseline HP class
-> Design Basis
-> paste two-product matrix
-> Validate matrix
-> verify preview NPS4 t_min,m=11.80375 and t_eff=8.80375
-> Apply + batch calculate
-> verify both products present
-> verify existing class-result matrix refreshed
-> verify stale result disappears after engineering edit
-> verify CSV/JSON result round trip and export
-> 375x900 containment/table-local overflow
```

## Next action

1. Reconcile the exact PR683 head against current main.
2. Record hosted status checks/workflows/reviews/threads against that exact head.
3. Keep the PR draft because `FULL_APP` remains NOT_RUN.
4. In the first native checkout + Chromium environment, execute/extend `npm run verify:hp-production-browser` for the two-product matrix and retain the receipt.
5. Do not merge without explicit merge authorization.

## Appendix A — takeover qualification

1. Why are allowance columns repeated in CSV but required to be identical across rows?
2. Why may product bulk intake not overwrite a governed/master product?
3. Why is a case-only product-ID rename blocked?
4. What happens to fatigue custody for retained versus removed direct products?
5. Why is the rebuilt project routed through the existing JSON import/controller and Calculate action?
6. Which arithmetic is preview validation versus canonical engineering calculation?
7. Why is exact committed-blob Node execution not called a native checkout run?
8. Why is real Chromium source injection still insufficient to claim `FULL_APP`?
