# PR685 — HP Product-Matrix FULL_APP Browser Qualification — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #685
BRANCH: agent/hp-product-bulk-full-app-qualification
BASE: main
BASE_SHA_AT_START: 60e057a864194ce65ac10b18895c9098f6d65e23
IMPLEMENTATION_HEAD_AT_PR_OPEN: c19965281e58a22500c4e07527562a6f5c0a1f9e
PREDECESSOR_PR: 683 (MERGED)
PREDECESSOR_MERGE: 60e057a864194ce65ac10b18895c9098f6d65e23
CURRENT_STAGE: DRAFT_PR_FULL_APP_NATIVE_EXECUTION_PENDING
MERGE_AUTHORITY: NOT_GRANTED

## Mission

Make the newly merged HP product-matrix workflow part of the production browser qualification contract without replacing or weakening the PR681 browser lane.

The combined command is now:

```text
npm run verify:hp-production-browser
  -> verify:hp-production-browser:base
  -> verify:hp-production-browser:matrix
```

Both lanes must succeed. The existing PR681 runner remains unchanged.

## New companion browser lane

`scripts/validate-hp-piping-class-product-matrix-browser.mjs`

uses Node built-ins plus Chromium DevTools Protocol only. It does not add Playwright or Puppeteer.

### FULL_APP sequence encoded

```text
Engineering Calculations
-> HP Piping Class
-> load NPS4 reference
-> Design Basis
-> paste 2-product matrix
-> Validate matrix
-> verify preview arithmetic
-> Apply through existing controller/import bridge
-> inspect persisted controller project
-> verify authority + fatigue custody
-> verify LOW/HIGH/C1 preserved
-> apply NPS4 Seq/N bulk row
-> Review Envelope
-> verify 2 product result rows
-> verify NPS4/NPS6 pressure ratings
-> verify CSV/JSON round trip + downloads
-> edit NPS6 wall and prove stale-result invalidation
-> restore NPS6 wall and recalculate
-> 375x900 result-table containment
-> 375x900 product-matrix containment
-> require zero Chromium runtime exceptions
```

## Exact product matrix

```csv
product_id,nominal_size,od_mm,allowable_stress_mpa,nominal_wall_mm,minus_tolerance_pct,internal_allowance_mm,external_allowance_mm,fatigue_wall_basis,measured_current_wall_mm,future_internal_loss_mm,future_external_loss_mm
NPS4-S160,NPS 4,114.3,138,13.49,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,
NPS6-XXS,NPS 6,168.3,138,18.26,12.5,3,0,END_OF_LIFE_EFFECTIVE,,,
```

## Independent arithmetic basis

NPS4:

```text
t_min,m = 13.49 * 0.875 = 11.80375 mm
t_eff   = 11.80375 - 3 = 8.80375 mm
P_rating = 23.086120852009273 MPa
margin   = 1.1543060426004637
```

NPS6:

```text
t_min,m = 18.26 * 0.875 = 15.9775 mm
t_eff   = 15.9775 - 3 = 12.9775 mm
P_rating = 23.114228963951774 MPa
margin   = 1.1557114481975888
```

The browser checks visible rounded values `23.08612` and `23.11423`.

## Receipt semantics

The companion receipt schema is:

`HpPipingClassProductMatrixBrowserReceipt.v1`

It initializes:

```text
fullActiveWorkbenchNavigation = false
productMatrixFullAppQualified = false
numericalAuthority = UNCHANGED
```

Only successful completion of the real routed FULL_APP path sets both navigation/qualification flags true. `self-test` never sets them.

## Authority boundary

Unchanged and asserted in the browser/project receipt:

```text
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
numericalAuthority = UNCHANGED
```

This PR contains no engineering equations, coefficients, Code data, source qualification, KD320 implementation, product calculator changes, or design-authority promotion.

## Changed-file ledger at PR open

```text
package.json
scripts/validate-hp-piping-class-product-matrix-browser.mjs
tests/hp-piping-class-product-matrix-browser-script.test.mjs
```

Recovery files after PR creation:

```text
agents/PR685_workreport.md
agents/status/PR685.yaml
agents/claims/PR685.yaml
```

## Executed validation

```text
main grounding                                    PASS / main@60e057a864194ce65ac10b18895c9098f6d65e23
initial branch ancestry                           PASS / ahead 2, behind 0
initial changed paths                             PASS / 3 intended
companion runner syntax                           PASS
companion static browser/journey regression       PASS 9/9
real Chromium CDP companion self-test             PASS
Chromium runtime exceptions in self-test          0
exact local runner Git blob                       PASS / 949213b0692014d125af2c145a68162ef5935a6d
exact local test Git blob                         PASS / 6061a6abd4db0c7377711ee63a9620cf50447bec
independent NPS4/NPS6 arithmetic                  PASS
```

The local exact-file rerun was performed in repository-equivalent `scripts/` and `tests/` paths. An earlier `/tmp` direct test invocation failed only because its relative `../scripts/...` source path resolved to `/scripts/...`; after restoring repository-equivalent layout, all 9 tests passed. That layout mistake is not counted as a product/test failure.

## NOT_RUN / unresolved execution evidence

```text
new product-matrix routed FULL_APP journey        NOT_RUN / native checkout unavailable
combined npm verify:hp-production-browser         NOT_RUN / native checkout unavailable
existing PR681 base browser lane rerun             NOT_RUN / unchanged in this PR
full repository regression                         NOT_RUN
```

The runtime has Chromium but cannot obtain the native repository checkout/archive through direct GitHub network access. The GitHub connector also rejects repository tarball endpoints. No source-injection or transport self-test is promoted to FULL_APP PASS.

## Hosted reconciliation

At PR head `7b91eca66ab9be20a6de97510755eae62973d65d` before final recovery-only synchronization:

```text
PR                                              #685
state                                           open / draft
mergeable                                       true
base                                             main@60e057a864194ce65ac10b18895c9098f6d65e23
branch ancestry                                  ahead 5 / behind 0
changed paths                                    6 intended
implementation/test/package paths                3
recovery paths                                   3
commit status checks                             0 returned -> NOT_RUN
PR-triggered workflow runs                       0 returned -> NOT_RUN
reviews                                          0
review threads                                   0
```

Subsequent commits that only synchronize this workreport/status do not change the qualification implementation basis.

## Gate to claim FULL_APP PASS

A native checkout must run:

```text
npm run verify:hp-production-browser
```

The product-matrix receipt must report:

```json
{
  "status": "PASS",
  "fullActiveWorkbenchNavigation": true,
  "productMatrixFullAppQualified": true,
  "authority": {
    "nativeCoreKd3Qualified": false,
    "codeCompliance": false,
    "canUseForDesignAuthority": false
  }
}
```

and the original PR681 lane must also PASS in the same combined command.

## Next action

1. In any native checkout, run the combined browser command and retain both receipts/screenshots.
2. Keep FULL_APP as NOT_RUN until that receipt exists.
3. Reconcile the exact PR head again before any merge.
4. Do not merge without explicit owner merge authorization.

## Appendix A — takeover qualification

1. Why is the product-matrix browser journey a companion lane instead of replacing PR681's runner?
2. Why must `productMatrixFullAppQualified` remain false in Chromium self-test mode?
3. What proves the matrix mutation went through the existing workspace controller rather than a parallel state path?
4. Why is preserving NPS4 `fatigueEvidence` after adding NPS6 an important relational-custody assertion?
5. What independent values should appear for NPS6 `t_min,m`, `t_eff`, `P_rating`, and rating margin?
6. Why does the stale-result falsifier edit product index 1 rather than reusing the original NPS4 check?
7. Why are result-table and product-preview-table mobile containment checked independently?
8. What exact evidence is required before setting `productMatrixFullAppQualified=true`?
