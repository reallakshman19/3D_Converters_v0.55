# PR681 — HP Piping Class Production Browser Qualification — Work Report

HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR: #681
BRANCH: agent/hp-production-browser-qualification
BASE: main
BASE_SHA_AT_BRANCH: 68511e14b594eab9e21d06da3ddfc0836e92295b
CURRENT_STAGE: OWNER_AUTHORIZED_READY_TO_MERGE

## Handover in 60 Seconds

This PR adds the browser/runtime qualification harness for the production HP Piping Class flow delivered by PR673/676/677/679. It does not change the HP calculation kernels, workbench behavior, evidence policy, native KD320 status, Code compliance, or design authority.

The new command is:

```text
npm run verify:hp-production-browser
```

The runner uses Node built-ins plus Chromium's Chrome DevTools Protocol. It does not add Playwright or Puppeteer.

## Qualification Modes

The emitted receipt schema is:

```text
HpPipingClassProductionBrowserReceipt.v1
```

Mode meanings are deliberately non-interchangeable:

```text
FULL_APP
  actual repository served locally
  actual Engineering Calculations -> HP Piping Class route
  actual production controls exercised
  fullActiveWorkbenchNavigation=true

SOURCE_INJECTION
  exact result/export source modules injected into real Chromium
  validates rendered result/export behavior
  does NOT prove routed full-workbench navigation
  fullActiveWorkbenchNavigation=false

SELF_TEST_ONLY
  validates Chromium/CDP transport infrastructure only
  no HP product qualification claim
  fullActiveWorkbenchNavigation=false
```

A lower mode must never be reported as FULL_APP.

## Full-App Journey Encoded

```text
Engineering Calculations
  -> HP Piping Class active subtab
  -> load NPS4_S160_PRESSURE_FATIGUE_REGRESSION
  -> verify LOW/HIGH operating states and governed C1
  -> KD Review
  -> paste exact five-column bulk Seq/N contract
  -> validate table
  -> apply + calculate
  -> Review Envelope
  -> verify P-rating / margin / cumulative U / CORE Salt
  -> exercise filter + sort
  -> verify CSV + JSON round trip
  -> invoke CSV + JSON exports
  -> mutate nominal wall
  -> prove prior production result disappears
  -> restore + recalculate
  -> 375x900 mobile containment check
```

Exact bulk fixture:

```csv
cycle_id,location_id,user_salt_mpa,seq_mpa,permissible_cycles
C1,BORE_INNER_SURFACE,63.29949581051363,70,10000
```

Reference numerical UI tokens required by the full-app qualification:

```text
P-rating             23.08612 MPa
P-rating margin       1.154306
cumulative U           0.050000
CORE Salt              63.299496 MPa
```

These are existing reference-regression values; this PR does not introduce or alter the calculations.

## Mobile / Overflow Contract

At a 375x900 emulated viewport:

```text
document horizontal overflow <= 2 px
class result table wrapper scrollWidth > clientWidth
HP root width <= viewport + 2 px
```

The intended behavior is table-local horizontal scrolling, not page-level horizontal escape.

## Export Contract

The browser journey explicitly clicks:

```text
Verify round trip
Export results CSV
Export results JSON
```

The runner instruments anchor-download names and requires both `.hp-review-results.csv` and `.hp-review-results.json` to be invoked only after the production round-trip verifier reports PASS.

## Authority Boundary

Unchanged:

```text
nativeCoreKd3Qualified = false
codeCompliance = false
canUseForDesignAuthority = false
numericalAuthority = UNCHANGED
```

Browser qualification is software/product evidence only. It does not establish ASME Code compliance or design authority.

## Changed Files

Implementation/test:

```text
package.json
scripts/validate-hp-piping-class-production-browser.mjs
tests/hp-piping-class-production-browser-script.test.mjs
```

Recovery:

```text
agents/PR681_workreport.md
agents/status/PR681.yaml
agents/claims/PR681.yaml
```

No production HP calculation/UI source file is modified.

## Validation Ledger

Executed in current environment:

```text
runner JavaScript syntax                           PASS / LOCAL_EXECUTION
browser-runner contract tests                      PASS 8/8 / LOCAL_EXECUTION
Chromium CDP transport self-test                    PASS / REAL_CHROMIUM
Chromium runtime exceptions in self-test            0
375x900 viewport emulation in self-test             PASS
branch source grounding                             PASS / GITHUB_SOURCE_INSPECTION
changed-path reconciliation                         PASS / SIX INTENDED PATHS
```

Hosted state observed before final recovery sync:

```text
commit status entries                               0 -> NOT_RUN
PR-triggered workflow runs                          0 -> NOT_RUN
reviews                                             0
review threads                                      0
mergeable                                           true
branch behind main                                  0
```

Not run and must remain explicit:

```text
FULL_APP HP production browser journey              NOT_RUN / NO_NATIVE_CHECKOUT
SOURCE_INJECTION exact repo-source browser run       NOT_RUN / NO_NATIVE_CHECKOUT
full repository regression suite                    NOT_RUN
```

Current environment has `/usr/bin/chromium`, but direct native checkout remains blocked because `github.com` cannot be resolved from the container. The self-test therefore validates the CDP harness, not the HP product flow.

## Receipt Location

At execution time:

```text
artifacts/hp-piping-class-production-browser/production-browser-receipt.json
```

Screenshots are written to the same artifact directory. Generated artifacts are intentionally not committed by this PR.

## Exact Next Action

1. re-read PR681 exact head after this recovery sync;
2. confirm changed-file set remains these six paths and branch remains behind=0;
3. confirm mergeability and no new hosted review/check state appeared;
4. mark ready for review;
5. squash merge only against that exact head under the owner's merge authorization;
6. in the first environment with a native checkout + Chromium, execute `npm run verify:hp-production-browser` and retain the FULL_APP receipt.

## Appendix A — Takeover Questions

1. Can you explain why `SELF_TEST_ONLY` cannot support a production-workflow PASS claim?
2. Can you identify the exact active route that must be exercised in FULL_APP mode?
3. Can you explain why export invocation is gated behind `verifyHpPipingClassResultRoundTrip()`?
4. Can you show how stale results are invalidated after a project edit?
5. Can you distinguish table-local horizontal overflow from document-level overflow at 375 px?
6. Can you confirm browser qualification leaves native KD320, Code compliance, and design authority unchanged?
